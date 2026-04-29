import base64
import io

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, UploadFile
from PIL import Image

from ..schemas.stroke import Metrics, PipelineResponse, PipelineSteps, Stroke
from ..services.background_remover import remove_background
from ..services.contour_extractor import extract_contours
from ..services.stroke_processor import (
    normalize_contours,
    sample_color,
    simplify_contours,
)

router = APIRouter()


def _to_b64(arr: np.ndarray) -> str:
    if arr.ndim == 2:
        pil = Image.fromarray(arr, mode="L")
    elif arr.shape[2] == 4:
        pil = Image.fromarray(arr, mode="RGBA")
    else:
        pil = Image.fromarray(arr, mode="RGB")
    buf = io.BytesIO()
    pil.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@router.post("/pipeline/image", response_model=PipelineResponse)
async def process_image(
    image: UploadFile = File(...),
    remove_bg: bool = Form(True),
    extract_internal: bool = Form(False),
    alpha_threshold: int = Form(128),
    canny_low: int = Form(50),
    canny_high: int = Form(150),
    min_contour_area: int = Form(100),
    simplify: bool = Form(True),
    simplify_epsilon: float = Form(2.0),
    max_stroke_count: int = Form(30),
    min_stroke_length: int = Form(3),
):
    content = await image.read()
    pil_image = Image.open(io.BytesIO(content)).convert("RGB")
    original_rgb = np.array(pil_image)

    original_b64 = _to_b64(original_rgb)

    if remove_bg:
        pil_rgba = remove_background(pil_image)
        rgba_image = np.array(pil_rgba)
    else:
        alpha_channel = np.full(original_rgb.shape[:2], 255, dtype=np.uint8)
        rgba_image = np.dstack([original_rgb, alpha_channel])

    removed_bg_b64 = _to_b64(rgba_image)

    contours, mask, contour_overlay = extract_contours(
        rgba_image=rgba_image,
        alpha_threshold=alpha_threshold,
        extract_internal=extract_internal,
        canny_low=canny_low,
        canny_high=canny_high,
        min_contour_area=min_contour_area,
    )

    mask_b64 = _to_b64(mask)
    contour_overlay_b64 = _to_b64(contour_overlay)

    simplified = simplify_contours(
        contours=contours,
        simplify=simplify,
        simplify_epsilon=simplify_epsilon,
        min_stroke_length=min_stroke_length,
        max_stroke_count=max_stroke_count,
    )

    simplified_overlay = original_rgb.copy()
    for c in simplified:
        pts = c.reshape(-1, 1, 2).astype(np.int32)
        cv2.polylines(simplified_overlay, [pts], isClosed=True, color=(255, 0, 0), thickness=2)
    simplified_overlay_b64 = _to_b64(simplified_overlay)

    colors = [
        sample_color(c, original_rgb, rgba_image, alpha_threshold)
        for c in simplified
    ]

    normalized = normalize_contours(simplified, coord_size=256, padding=10)

    drawing = []
    for pts, color in zip(normalized, colors):
        xs = [round(float(x), 2) for x in pts[:, 0]]
        ys = [round(float(y), 2) for y in pts[:, 1]]
        drawing.append(Stroke(points=(xs, ys), color=color))

    total_pts = sum(len(s.points[0]) for s in drawing)
    color_count = len(set(s.color for s in drawing))
    metrics = Metrics(
        strokeCount=len(drawing),
        totalPointCount=total_pts,
        averagePointPerStroke=round(total_pts / len(drawing), 2) if drawing else 0.0,
        colorCount=color_count,
    )

    return PipelineResponse(
        steps=PipelineSteps(
            original=original_b64,
            removed_bg=removed_bg_b64,
            mask=mask_b64,
            contour_overlay=contour_overlay_b64,
            simplified_overlay=simplified_overlay_b64,
        ),
        drawing=drawing,
        metrics=metrics,
    )
