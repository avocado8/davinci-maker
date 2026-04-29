import cv2
import numpy as np
from typing import List, Tuple

PALETTE_COLORS = [
    {"name": "검정", "rgb": (0, 0, 0)},
    {"name": "빨강", "rgb": (239, 68, 68)},
    {"name": "파랑", "rgb": (59, 130, 246)},
    {"name": "초록", "rgb": (34, 197, 94)},
    {"name": "노랑", "rgb": (234, 179, 8)},
]


def simplify_contours(
    contours: List[np.ndarray],
    simplify: bool = True,
    simplify_epsilon: float = 2.0,
    min_stroke_length: int = 3,
    max_stroke_count: int = 30,
) -> List[np.ndarray]:
    result = []
    for contour in contours:
        if simplify:
            approx = cv2.approxPolyDP(contour, simplify_epsilon, closed=True)
        else:
            approx = contour
        if len(approx) >= min_stroke_length:
            result.append(approx)

    if len(result) > max_stroke_count:
        result = sorted(result, key=cv2.contourArea, reverse=True)[:max_stroke_count]

    return result


def _rgb_to_lab(rgb: Tuple[int, int, int]) -> np.ndarray:
    pixel = np.uint8([[[rgb[0], rgb[1], rgb[2]]]])
    lab = cv2.cvtColor(pixel, cv2.COLOR_RGB2LAB)
    return lab[0][0].astype(float)


def map_to_palette(rgb: Tuple[int, int, int]) -> Tuple[int, int, int]:
    lab = _rgb_to_lab(rgb)
    min_dist = float("inf")
    best: Tuple[int, int, int] = PALETTE_COLORS[0]["rgb"]
    for color in PALETTE_COLORS:
        dist = float(np.linalg.norm(lab - _rgb_to_lab(color["rgb"])))
        if dist < min_dist:
            min_dist = dist
            best = color["rgb"]
    return best


def sample_color(
    contour: np.ndarray,
    original_rgb: np.ndarray,
    rgba_image: np.ndarray,
    alpha_threshold: int = 128,
) -> Tuple[int, int, int]:
    M = cv2.moments(contour)
    if M["m00"] != 0:
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
    else:
        pts = contour.reshape(-1, 2)
        cx = int(pts[:, 0].mean())
        cy = int(pts[:, 1].mean())

    h, w = original_rgb.shape[:2]
    cx = max(0, min(cx, w - 1))
    cy = max(0, min(cy, h - 1))

    if rgba_image.shape[2] == 4 and int(rgba_image[cy, cx, 3]) < alpha_threshold:
        return (0, 0, 0)

    r, g, b = int(original_rgb[cy, cx, 0]), int(original_rgb[cy, cx, 1]), int(original_rgb[cy, cx, 2])
    return map_to_palette((r, g, b))


def normalize_contours(
    contours: List[np.ndarray],
    coord_size: int = 256,
    padding: int = 10,
) -> List[np.ndarray]:
    if not contours:
        return []

    all_pts = np.vstack([c.reshape(-1, 2) for c in contours]).astype(float)
    x_min, y_min = all_pts.min(axis=0)
    x_max, y_max = all_pts.max(axis=0)

    obj_w = x_max - x_min
    obj_h = y_max - y_min

    available = coord_size - 2 * padding
    scale = available / max(obj_w, obj_h, 1.0)

    scaled_w = obj_w * scale
    scaled_h = obj_h * scale
    offset_x = padding + (available - scaled_w) / 2
    offset_y = padding + (available - scaled_h) / 2

    normalized = []
    for contour in contours:
        pts = contour.reshape(-1, 2).astype(float)
        pts = (pts - [x_min, y_min]) * scale + [offset_x, offset_y]
        normalized.append(pts)

    return normalized
