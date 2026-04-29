import numpy as np
from fastapi import APIRouter, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel

from ..schemas.stroke import Metrics, Stroke, StrokePerPath, SvgPipelineResponse, SvgPipelineSteps
from ..services.stroke_processor import normalize_contours
from ..services.svg_parser import parse_svg

router = APIRouter()
client = AsyncOpenAI()

_SYSTEM_PROMPT = """You are an SVG illustrator. Draw simple, recognizable stroke-based illustrations.
Rules:
- viewBox must be "0 0 400 400"
- Use only <path> or <polyline> elements. No <rect>, <circle>, <ellipse>, <text>, or <image>.
- No fill. Only strokes. Every element must have fill="none".
- stroke color must be one of: #000000, #EF4444, #3B82F6, #22C55E, #EAB308
- stroke-width: 3
- Minimum 3 strokes, maximum 25 strokes.
- If you use <polyline> to draw a closed shape, repeat the first point at the end.
- Prefer <path> with Z command for closed shapes.
- Draw only the essential shape. Keep it simple enough to recognize at a glance.
- Output only the raw SVG string. No explanation, no markdown, no code block."""


class SvgPipelineRequest(BaseModel):
    keyword: str
    min_stroke_length: int = 2


@router.post("/pipeline/svg", response_model=SvgPipelineResponse)
async def process_svg(req: SvgPipelineRequest):
    if not req.keyword.strip():
        raise HTTPException(status_code=422, detail="keyword는 비워둘 수 없습니다.")

    # 1. Generate SVG
    try:
        response = await client.chat.completions.create(
            model="gpt-5.4-mini",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"Draw a simple stroke illustration of: {req.keyword}"},
            ],
            temperature=0.7,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI 오류: {e}")

    svg_raw = response.choices[0].message.content.strip()

    # 2. Parse SVG paths
    parsed = parse_svg(svg_raw)
    if not parsed:
        raise HTTPException(
            status_code=422,
            detail="SVG 파싱 실패: 유효한 path/polyline 요소가 없습니다.",
        )

    # 3. Build strokes_per_path (raw, before post-processing)
    strokes_per_path = [
        StrokePerPath(
            path_index=i,
            color=item["color"],
            raw_points=([p[0] for p in item["points"]], [p[1] for p in item["points"]]),
        )
        for i, item in enumerate(parsed)
    ]

    # 4. Filter by min_stroke_length only — no simplification for SVG paths
    valid_pairs: list[tuple[np.ndarray, tuple]] = []
    for item in parsed:
        pts = np.array(item["points"], dtype=np.float32).reshape(-1, 1, 2)
        if len(pts) >= req.min_stroke_length:
            valid_pairs.append((pts, item["color"]))

    if not valid_pairs:
        raise HTTPException(status_code=422, detail="유효한 stroke가 없습니다.")

    # 5. Normalize coordinates to 0~256 (reuse Phase 1 service)
    contours = [p[0] for p in valid_pairs]
    colors = [p[1] for p in valid_pairs]
    normalized = normalize_contours(contours, coord_size=256, padding=10)

    # 6. Build drawing
    drawing = [
        Stroke(
            points=([round(float(x), 2) for x in pts[:, 0]], [round(float(y), 2) for y in pts[:, 1]]),
            color=color,
        )
        for pts, color in zip(normalized, colors)
    ]

    # 7. Metrics
    total_pts = sum(len(s.points[0]) for s in drawing)
    metrics = Metrics(
        strokeCount=len(drawing),
        totalPointCount=total_pts,
        averagePointPerStroke=round(total_pts / len(drawing), 2) if drawing else 0.0,
        colorCount=len(set(s.color for s in drawing)),
    )

    return SvgPipelineResponse(
        steps=SvgPipelineSteps(svg_raw=svg_raw, strokes_per_path=strokes_per_path),
        drawing=drawing,
        metrics=metrics,
    )
