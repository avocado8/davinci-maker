import type { RefObject } from "react";
import type { Drawing, Metrics, SvgPipelineSteps } from "../types";
import StrokePreviewCanvas, { type StrokePreviewCanvasHandle } from "./StrokePreviewCanvas";

interface Props {
  keyword: string;
  steps: SvgPipelineSteps | null;
  drawing: Drawing;
  metrics: Metrics | null;
  canvasRef: RefObject<StrokePreviewCanvasHandle | null>;
  onExport?: () => void;
}

function downloadJSON(drawing: Drawing) {
  const blob = new Blob([JSON.stringify(drawing, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "drawing_svg.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function copyJSON(drawing: Drawing) {
  await navigator.clipboard.writeText(JSON.stringify(drawing, null, 2));
  alert("클립보드에 복사되었습니다.");
}

export default function SvgPipelineStepViewer({
  keyword,
  steps,
  drawing,
  metrics,
  canvasRef,
  onExport,
}: Props) {
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
        {/* Step 1 */}
        <div className="step-card">
          <h4>Step 1. 주제어</h4>
          <div className="keyword-display">{keyword}</div>
        </div>

        {/* Step 2 */}
        <div className="step-card step-svg-raw">
          <h4>Step 2. AI 생성 SVG 원문</h4>
          <pre className="svg-raw-preview">{steps.svg_raw}</pre>
        </div>

        {/* Step 3 */}
        <div className="step-card">
          <h4>Step 3. SVG 렌더링</h4>
          <div
            className="svg-render"
            dangerouslySetInnerHTML={{ __html: steps.svg_raw }}
          />
        </div>

        {/* Step 4 */}
        <div className="step-card step-path-list">
          <h4>Step 4. Path별 추출 결과</h4>
          <table className="path-table">
            <thead>
              <tr>
                <th>#</th>
                <th>색상</th>
                <th>점 수</th>
              </tr>
            </thead>
            <tbody>
              {steps.strokes_per_path.map((s) => {
                const [r, g, b] = s.color;
                return (
                  <tr key={s.path_index}>
                    <td>{s.path_index + 1}</td>
                    <td>
                      <span
                        className="color-swatch"
                        style={{ background: `rgb(${r},${g},${b})` }}
                      />
                    </td>
                    <td>{s.raw_points[0].length}pt</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Step 5 */}
        <div className="step-card step-json">
          <h4>Step 5. 정규화 좌표 (0~256)</h4>
          <pre className="json-preview">
            {JSON.stringify(drawing.slice(0, 2), null, 2)}
            {drawing.length > 2 && `\n... (${drawing.length - 2}개 더)`}
          </pre>
        </div>

        {/* Step 6 */}
        <div className="step-card">
          <h4>Step 6. 최종 렌더링</h4>
          <StrokePreviewCanvas ref={canvasRef} drawing={drawing} />
        </div>

        {/* Step 7 */}
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
