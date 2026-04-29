export type Stroke = {
  points: [number[], number[]];
  color: [number, number, number];
};

export type Drawing = Stroke[];

export const PALETTE_COLORS: Array<{ name: string; rgb: [number, number, number] }> = [
  { name: "검정", rgb: [0, 0, 0] },
  { name: "빨강", rgb: [239, 68, 68] },
  { name: "파랑", rgb: [59, 130, 246] },
  { name: "초록", rgb: [34, 197, 94] },
  { name: "노랑", rgb: [234, 179, 8] },
];

export type Metrics = {
  strokeCount: number;
  totalPointCount: number;
  averagePointPerStroke: number;
  colorCount: number;
};

export type PipelineSteps = {
  original: string;
  removed_bg: string;
  mask: string;
  contour_overlay: string;
  simplified_overlay: string;
};

export type PipelineResponse = {
  steps: PipelineSteps;
  drawing: Drawing;
  metrics: Metrics;
};

export type PipelineParams = {
  remove_bg: boolean;
  extract_internal: boolean;
  alpha_threshold: number;
  canny_low: number;
  canny_high: number;
  min_contour_area: number;
  simplify: boolean;
  simplify_epsilon: number;
  max_stroke_count: number;
  min_stroke_length: number;
};

export type SvgPipelineParams = {
  keyword: string;
  min_stroke_length: number;
};

export type SvgStrokePerPath = {
  path_index: number;
  color: [number, number, number];
  raw_points: [number[], number[]];
};

export type SvgPipelineSteps = {
  svg_raw: string;
  strokes_per_path: SvgStrokePerPath[];
};

export type SvgPipelineResponse = {
  steps: SvgPipelineSteps;
  drawing: Drawing;
  metrics: Metrics;
};
