import re
import xml.etree.ElementTree as ET
from typing import List, Tuple

try:
    from svgpathtools import parse_path as _svg_parse_path
    _HAS_SVGPATHTOOLS = True
except ImportError:
    _HAS_SVGPATHTOOLS = False

SVG_NS = "http://www.w3.org/2000/svg"

_PALETTE_HEX: dict[str, Tuple[int, int, int]] = {
    "#000000": (0, 0, 0),
    "#ef4444": (239, 68, 68),
    "#3b82f6": (59, 130, 246),
    "#22c55e": (34, 197, 94),
    "#eab308": (234, 179, 8),
}


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    h = hex_color.strip().lower()
    if h in _PALETTE_HEX:
        return _PALETTE_HEX[h]
    if not h.startswith("#"):
        return (0, 0, 0)
    try:
        if len(h) == 7:
            r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
        elif len(h) == 4:
            r, g, b = int(h[1] * 2, 16), int(h[2] * 2, 16), int(h[3] * 2, 16)
        else:
            return (0, 0, 0)
    except ValueError:
        return (0, 0, 0)
    from .stroke_processor import map_to_palette
    return map_to_palette((r, g, b))


def _sample_path_d(d: str, sample_interval: float = 5.0) -> List[Tuple[float, float]]:
    if not _HAS_SVGPATHTOOLS or not d.strip():
        return []
    try:
        path = _svg_parse_path(d)
        if not path:
            return []

        # Z command → path is explicitly closed
        is_closed = "z" in d.lower()
        n_segments = len(path)

        # For closed paths, skip the last segment (the straight Z-closing line)
        # and instead append the start point explicitly at the end.
        segments_to_sample = list(path[:-1]) if is_closed and n_segments > 1 else list(path)
        if not segments_to_sample:
            return []

        points: List[Tuple[float, float]] = []

        for seg_idx, segment in enumerate(segments_to_sample):
            is_last = seg_idx == len(segments_to_sample) - 1

            try:
                seg_length = segment.length()
            except Exception:
                seg_length = 1.0

            # t runs 0 ~ n_segments (one unit per segment); within each segment
            # we subdivide proportionally to length.
            n_pts = max(2, int(seg_length / sample_interval) + 1)

            # Exclude endpoint on non-last segments — it equals the next segment's start
            count = n_pts if is_last else n_pts - 1

            for j in range(count):
                t = j / (n_pts - 1)
                try:
                    pt = segment.point(t)
                    points.append((pt.real, pt.imag))
                except Exception:
                    continue

        # Explicitly close: last point == first point (no extra sampled segment)
        if is_closed and points:
            points.append(points[0])

        return points
    except Exception:
        return []


def _parse_polyline_points(points_str: str) -> List[Tuple[float, float]]:
    nums: List[float] = []
    for token in points_str.replace(",", " ").split():
        try:
            nums.append(float(token))
        except ValueError:
            continue
    return [(nums[i], nums[i + 1]) for i in range(0, len(nums) - 1, 2)]


def _tag(elem) -> str:
    t = elem.tag
    return t.split("}")[-1] if "}" in t else t


def _attr(elem, name: str, default: str = "") -> str:
    v = elem.get(name)
    if v is not None:
        return v
    v = elem.get(f"{{{SVG_NS}}}{name}")
    return v if v is not None else default


def _stroke_color(elem) -> str:
    """Extract stroke color from element attributes or style."""
    color = _attr(elem, "stroke", "")
    if not color:
        style = _attr(elem, "style", "")
        m = re.search(r"stroke\s*:\s*([^;]+)", style)
        if m:
            color = m.group(1).strip()
    return color or "#000000"


def _extract_svg(raw: str) -> str:
    """Strip markdown wrappers and extract SVG content."""
    raw = raw.strip()
    raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
    raw = re.sub(r"```$", "", raw).strip()
    m = re.search(r"<svg[\s\S]*?</svg>", raw, re.IGNORECASE)
    return m.group(0) if m else raw


def parse_svg(svg_string: str) -> List[dict]:
    """
    Parse SVG string and return list of {"color": (r,g,b), "points": List[Tuple[float,float]]}.
    Handles <path> and <polyline> elements only.
    """
    svg_string = _extract_svg(svg_string)

    try:
        root = ET.fromstring(svg_string)
    except ET.ParseError:
        return []

    results = []
    for elem in root.iter():
        tag = _tag(elem)
        if tag not in ("path", "polyline"):
            continue

        color = _hex_to_rgb(_stroke_color(elem))

        points: List[Tuple[float, float]] = []
        if tag == "path":
            d = _attr(elem, "d", "")
            points = _sample_path_d(d)
        else:
            pts_str = _attr(elem, "points", "")
            points = _parse_polyline_points(pts_str)

        if len(points) >= 2:
            results.append({"color": color, "points": points})

    return results
