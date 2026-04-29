import { useRef, useState } from "react";
import { runImagePipeline, runSvgPipeline } from "../api";
import StrokePreviewCanvas, {
  type StrokePreviewCanvasHandle,
} from "../components/StrokePreviewCanvas";
import type { Drawing, Metrics, PipelineParams } from "../types";

const DEFAULT_IMAGE_PARAMS: PipelineParams = {
  remove_bg: true,
  extract_internal: false,
  alpha_threshold: 128,
  canny_low: 50,
  canny_high: 150,
  min_contour_area: 100,
  simplify: true,
  simplify_epsilon: 2.0,
  max_stroke_count: 30,
  min_stroke_length: 3,
};

function MetricsDisplay({ metrics }: { metrics: Metrics }) {
  return (
    <div className="compare-metrics">
      <div className="compare-metric">
        <span>스트로크 수</span><strong>{metrics.strokeCount}</strong>
      </div>
      <div className="compare-metric">
        <span>총 점 수</span><strong>{metrics.totalPointCount}</strong>
      </div>
      <div className="compare-metric">
        <span>색상 수</span><strong>{metrics.colorCount}</strong>
      </div>
    </div>
  );
}

export default function ComparisonPage() {
  const [keyword, setKeyword] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drawing1, setDrawing1] = useState<Drawing>([]);
  const [drawing2, setDrawing2] = useState<Drawing>([]);
  const [metrics1, setMetrics1] = useState<Metrics | null>(null);
  const [metrics2, setMetrics2] = useState<Metrics | null>(null);
  const [hasResult, setHasResult] = useState(false);

  const canvas1Ref = useRef<StrokePreviewCanvasHandle>(null);
  const canvas2Ref = useRef<StrokePreviewCanvasHandle>(null);

  const handleRun = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setError(null);

    const tasks: Promise<void>[] = [];

    if (imageFile) {
      tasks.push(
        runImagePipeline(imageFile, DEFAULT_IMAGE_PARAMS)
          .then((r) => {
            setDrawing1(r.drawing);
            setMetrics1(r.metrics);
          })
          .catch((e) => {
            throw new Error(`방법 1 오류: ${e instanceof Error ? e.message : e}`);
          })
      );
    }

    tasks.push(
      runSvgPipeline({ keyword: keyword.trim(), min_stroke_length: 2 })
        .then((r) => {
          setDrawing2(r.drawing);
          setMetrics2(r.metrics);
        })
        .catch((e) => {
          throw new Error(`방법 2 오류: ${e instanceof Error ? e.message : e}`);
        })
    );

    try {
      await Promise.all(tasks);
      setHasResult(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  const handleExportBoth = () => {
    const download = (filename: string, drawing: Drawing) => {
      const blob = new Blob([JSON.stringify(drawing, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };
    if (drawing1.length > 0) download("drawing_image.json", drawing1);
    if (drawing2.length > 0) download("drawing_svg.json", drawing2);
  };

  const canRun = keyword.trim().length > 0;

  return (
    <div className="compare-page">
      <div className="compare-controls">
        <input
          type="text"
          className="keyword-input compare-keyword"
          placeholder="주제어 입력 (예: 사과)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canRun && !loading && handleRun()}
        />
        <button className="run-btn compare-run-btn" disabled={!canRun || loading} onClick={handleRun}>
          {loading ? "실행 중..." : "비교 실행"}
        </button>
        {hasResult && (
          <button className="export-btn" onClick={handleExportBoth}>
            JSON Export
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="compare-grid">
        {/* Method 1 */}
        <div className="compare-col">
          <h3 className="compare-col-title">방법 1 — 이미지</h3>
          <label className="compare-upload">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <span className="compare-upload-label">
              {imageFile ? imageFile.name : "이미지 선택 (선택)"}
            </span>
          </label>
          {metrics1 && <MetricsDisplay metrics={metrics1} />}
          {drawing1.length > 0 ? (
            <StrokePreviewCanvas ref={canvas1Ref} drawing={drawing1} />
          ) : (
            <div className="compare-empty">결과 없음</div>
          )}
        </div>

        {/* Method 2 */}
        <div className="compare-col">
          <h3 className="compare-col-title">방법 2 — AI SVG</h3>
          {metrics2 && <MetricsDisplay metrics={metrics2} />}
          {drawing2.length > 0 ? (
            <StrokePreviewCanvas ref={canvas2Ref} drawing={drawing2} />
          ) : (
            <div className="compare-empty">결과 없음</div>
          )}
        </div>
      </div>
    </div>
  );
}
