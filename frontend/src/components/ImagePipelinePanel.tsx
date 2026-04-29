import { useRef, useState } from "react";
import type { PipelineParams } from "../types";

interface Props {
  onRun: (file: File, params: PipelineParams) => void;
  loading: boolean;
}

const DEFAULT_PARAMS: PipelineParams = {
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

export default function ImagePipelinePanel({ onRun, loading }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [params, setParams] = useState<PipelineParams>(DEFAULT_PARAMS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof PipelineParams>(key: K, value: PipelineParams[K]) =>
    setParams((prev) => ({ ...prev, [key]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;
    onRun(file, params);
  };

  return (
    <div className="panel">
      <h2>이미지 업로드</h2>
      <form onSubmit={handleSubmit}>
        <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
          {preview ? (
            <img src={preview} alt="미리보기" className="upload-preview" />
          ) : (
            <span>클릭하여 이미지 선택</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        <div className="params">
          <h3>파라미터</h3>

          <label className="param-check">
            <input
              type="checkbox"
              checked={params.remove_bg}
              onChange={(e) => set("remove_bg", e.target.checked)}
            />
            배경 제거 (rembg)
          </label>

          <label className="param-check">
            <input
              type="checkbox"
              checked={params.extract_internal}
              onChange={(e) => set("extract_internal", e.target.checked)}
            />
            내부선 추출 (Canny)
          </label>

          <label className="param-row">
            <span>Alpha Threshold: <b>{params.alpha_threshold}</b></span>
            <input
              type="range" min={0} max={255}
              value={params.alpha_threshold}
              onChange={(e) => set("alpha_threshold", Number(e.target.value))}
            />
          </label>

          {params.extract_internal && (
            <>
              <label className="param-row">
                <span>Canny Low: <b>{params.canny_low}</b></span>
                <input
                  type="range" min={0} max={255}
                  value={params.canny_low}
                  onChange={(e) => set("canny_low", Number(e.target.value))}
                />
              </label>
              <label className="param-row">
                <span>Canny High: <b>{params.canny_high}</b></span>
                <input
                  type="range" min={0} max={255}
                  value={params.canny_high}
                  onChange={(e) => set("canny_high", Number(e.target.value))}
                />
              </label>
            </>
          )}

          <label className="param-row">
            <span>최소 Contour 면적 (px²)</span>
            <input
              type="number" min={0}
              value={params.min_contour_area}
              onChange={(e) => set("min_contour_area", Number(e.target.value))}
            />
          </label>

          <label className="param-check">
            <input
              type="checkbox"
              checked={params.simplify}
              onChange={(e) => set("simplify", e.target.checked)}
            />
            단순화 (approxPolyDP)
          </label>

          {params.simplify && (
            <label className="param-row">
              <span>단순화 강도 (epsilon): <b>{params.simplify_epsilon.toFixed(1)}</b></span>
              <input
                type="range" min={0.5} max={10.0} step={0.1}
                value={params.simplify_epsilon}
                onChange={(e) => set("simplify_epsilon", Number(e.target.value))}
              />
            </label>
          )}

          <label className="param-row">
            <span>최대 스트로크 수</span>
            <input
              type="number" min={1}
              value={params.max_stroke_count}
              onChange={(e) => set("max_stroke_count", Number(e.target.value))}
            />
          </label>

          <label className="param-row">
            <span>최소 스트로크 길이 (점)</span>
            <input
              type="number" min={2}
              value={params.min_stroke_length}
              onChange={(e) => set("min_stroke_length", Number(e.target.value))}
            />
          </label>
        </div>

        <button type="submit" disabled={!file || loading} className="run-btn">
          {loading ? "처리 중..." : "파이프라인 실행"}
        </button>
      </form>
    </div>
  );
}
