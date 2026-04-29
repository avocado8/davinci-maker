import JSZip from "jszip";
import { useMemo, useRef, useState } from "react";
import { runImagePipeline } from "../api";
import ImagePipelinePanel from "../components/ImagePipelinePanel";
import PipelineStepViewer from "../components/PipelineStepViewer";
import StrokeEditor from "../components/StrokeEditor";
import type { StrokePreviewCanvasHandle } from "../components/StrokePreviewCanvas";
import type { Drawing, Metrics, PipelineParams, PipelineSteps } from "../types";

export default function ImagePipelinePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<PipelineSteps | null>(null);
  const [drawing, setDrawing] = useState<Drawing>([]);
  const [originalDrawing, setOriginalDrawing] = useState<Drawing>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [lastParams, setLastParams] = useState<PipelineParams | null>(null);
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

  const handleRun = async (file: File, params: PipelineParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await runImagePipeline(file, params);
      setSteps(result.steps);
      setDrawing(result.drawing);
      setOriginalDrawing(result.drawing);
      setLastFile(file);
      setLastParams(params);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => setDrawing(originalDrawing);

  const handleExport = async () => {
    if (!lastFile || !lastParams) return;

    const zip = new JSZip();
    const timestamp = new Date().toISOString();
    const folderName = `experiment_${timestamp.replace(/[:.]/g, "-")}`;
    const folder = zip.folder(folderName)!;

    const imgBuffer = await lastFile.arrayBuffer();
    folder.file("input_image.png", imgBuffer);

    folder.file(
      "params.json",
      JSON.stringify(
        {
          timestamp,
          method: "image",
          input_filename: lastFile.name,
          params: lastParams,
        },
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
          <ImagePipelinePanel onRun={handleRun} loading={loading} />
        </aside>

        <main className="content">
          {error && <div className="error-banner">{error}</div>}
          {loading && (
            <div className="loading-banner">
              파이프라인 실행 중... (배경 제거 시 수 초 소요될 수 있습니다)
            </div>
          )}
          <PipelineStepViewer
            steps={steps}
            drawing={drawing}
            metrics={metrics}
            canvasRef={canvasRef}
            onExport={steps ? handleExport : undefined}
          />
          <StrokeEditor
            drawing={drawing}
            onChange={setDrawing}
            onReset={steps ? handleReset : undefined}
          />
        </main>
    </div>
  );
}
