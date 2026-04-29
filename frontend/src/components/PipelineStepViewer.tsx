import type { RefObject } from "react";
import type { Drawing, Metrics, PipelineSteps } from "../types";
import StrokePreviewCanvas, { type StrokePreviewCanvasHandle } from "./StrokePreviewCanvas";

interface Props {
  steps: PipelineSteps | null;
  drawing: Drawing;
  metrics: Metrics | null;
  canvasRef: RefObject<StrokePreviewCanvasHandle | null>;
  onExport?: () => void;
}

function StepImage({ label, b64, alt }: { label: string; b64: string; alt: string }) {
  return (
    <div className="step-card">
      <h4>{label}</h4>
      <img src={`data:image/png;base64,${b64}`} alt={alt} className="step-img" />
    </div>
  );
}

function downloadJSON(drawing: Drawing) {
  const blob = new Blob([JSON.stringify(drawing, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "drawing.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function copyJSON(drawing: Drawing) {
  await navigator.clipboard.writeText(JSON.stringify(drawing, null, 2));
  alert("클립보드에 복사되었습니다.");
}

export default function PipelineStepViewer({ steps, drawing, metrics, canvasRef, onExport }: Props) {
  if (!steps) return null;

  return (
    <div className="pipeline-step-viewer">
      <div className="pipeline-step-header">
        <h2>파이프라인 결과</h2>
        {onExport && (
          <button className="export-btn" onClick={onExport}>
            실험 저장 (zip)
          </button>
        )}
      </div>

      <div className="steps-grid">
        <StepImage label="Step 1. 원본" b64={steps.original} alt="원본 이미지" />
        <StepImage label="Step 2. 배경 제거" b64={steps.removed_bg} alt="배경 제거 결과" />
        <StepImage label="Step 3. 마스크" b64={steps.mask} alt="알파 마스크" />
        <StepImage label="Step 4. Contour" b64={steps.contour_overlay} alt="Contour 추출" />
        <StepImage label="Step 5. 단순화" b64={steps.simplified_overlay} alt="단순화 결과" />

        <div className="step-card">
          <h4>Step 6. 최종 렌더링</h4>
          <StrokePreviewCanvas ref={canvasRef} drawing={drawing} />
        </div>

        <div className="step-card step-json">
          <h4>Step 7. JSON 출력</h4>
          <div className="json-actions">
            <button onClick={() => copyJSON(drawing)}>클립보드 복사</button>
            <button onClick={() => downloadJSON(drawing)}>다운로드</button>
          </div>
          <pre className="json-preview">
            {JSON.stringify(drawing.slice(0, 2), null, 2)}
            {drawing.length > 2 && `\n... (${drawing.length - 2}개 더)`}
          </pre>
        </div>
      </div>

      {metrics && (
        <div className="metrics">
          <h3>지표</h3>
          <div className="metrics-grid">
            <div className="metric-item">
              <span>스트로크 수</span>
              <strong>{metrics.strokeCount}</strong>
            </div>
            <div className="metric-item">
              <span>총 점 수</span>
              <strong>{metrics.totalPointCount}</strong>
            </div>
            <div className="metric-item">
              <span>평균 점/스트로크</span>
              <strong>{metrics.averagePointPerStroke.toFixed(1)}</strong>
            </div>
            <div className="metric-item">
              <span>색상 수</span>
              <strong>{metrics.colorCount}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
