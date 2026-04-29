import JSZip from "jszip";
import { useMemo, useRef, useState } from "react";
import { runSvgPipeline } from "../api";
import AiSvgPipelinePanel from "../components/AiSvgPipelinePanel";
import StrokeEditor from "../components/StrokeEditor";
import SvgPipelineStepViewer from "../components/SvgPipelineStepViewer";
import type { StrokePreviewCanvasHandle } from "../components/StrokePreviewCanvas";
import type { Drawing, Metrics, SvgPipelineParams, SvgPipelineSteps } from "../types";

export default function AiSvgPipelinePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<SvgPipelineSteps | null>(null);
  const [drawing, setDrawing] = useState<Drawing>([]);
  const [originalDrawing, setOriginalDrawing] = useState<Drawing>([]);
  const [lastKeyword, setLastKeyword] = useState("");
  const [lastParams, setLastParams] = useState<SvgPipelineParams | null>(null);
  const canvasRef = useRef<StrokePreviewCanvasHandle>(null);

  const metrics = useMemo<Metrics | null>(() => {
    if (!steps) return null;
    const totalPts = drawing.reduce((acc, s) => acc + s.points[0].length, 0);
    const colorSet = new Set(drawing.map((s) => s.color.join(",")));
    return {
      strokeCount: drawing.length,
      totalPointCount: totalPts,
      averagePointPerStroke:
        drawing.length > 0 ? Math.round((totalPts / drawing.length) * 10) / 10 : 0,
      colorCount: colorSet.size,
    };
  }, [drawing, steps]);

  const handleRun = async (params: SvgPipelineParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await runSvgPipeline(params);
      setSteps(result.steps);
      setDrawing(result.drawing);
      setOriginalDrawing(result.drawing);
      setLastKeyword(params.keyword);
      setLastParams(params);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!lastParams) return;

    const zip = new JSZip();
    const timestamp = new Date().toISOString();
    const folderName = `experiment_${timestamp.replace(/[:.]/g, "-")}`;
    const folder = zip.folder(folderName)!;

    folder.file(
      "params.json",
      JSON.stringify(
        { timestamp, method: "svg", keyword: lastKeyword, params: lastParams },
        null,
        2
      )
    );
    folder.file("output.json", JSON.stringify(drawing, null, 2));

    const dataUrl = canvasRef.current?.toDataURL() ?? "";
    if (dataUrl) {
      folder.file("preview.png", dataUrl.split(",")[1], { base64: true });
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${folderName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-layout">
      <aside className="sidebar">
        <AiSvgPipelinePanel onRun={handleRun} loading={loading} />
      </aside>

      <main className="content">
        {error && <div className="error-banner">{error}</div>}
        {loading && (
          <div className="loading-banner">SVG 생성 중... (수 초 소요될 수 있습니다)</div>
        )}
        <SvgPipelineStepViewer
          keyword={lastKeyword}
          steps={steps}
          drawing={drawing}
          metrics={metrics}
          canvasRef={canvasRef}
          onExport={steps ? handleExport : undefined}
        />
        <StrokeEditor
          drawing={drawing}
          onChange={setDrawing}
          onReset={steps ? () => setDrawing(originalDrawing) : undefined}
        />
      </main>
    </div>
  );
}
