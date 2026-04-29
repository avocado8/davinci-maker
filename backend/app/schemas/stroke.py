from typing import List, Tuple

from pydantic import BaseModel


class Stroke(BaseModel):
    points: Tuple[List[float], List[float]]
    color: Tuple[int, int, int]


class Metrics(BaseModel):
    strokeCount: int
    totalPointCount: int
    averagePointPerStroke: float
    colorCount: int


class PipelineSteps(BaseModel):
    original: str
    removed_bg: str
    mask: str
    contour_overlay: str
    simplified_overlay: str


class PipelineResponse(BaseModel):
    steps: PipelineSteps
    drawing: List[Stroke]
    metrics: Metrics


class StrokePerPath(BaseModel):
    path_index: int
    color: Tuple[int, int, int]
    raw_points: Tuple[List[float], List[float]]


class SvgPipelineSteps(BaseModel):
    svg_raw: str
    strokes_per_path: List[StrokePerPath]


class SvgPipelineResponse(BaseModel):
    steps: SvgPipelineSteps
    drawing: List[Stroke]
    metrics: Metrics
