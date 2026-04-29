import { useState } from "react";
import type { SvgPipelineParams } from "../types";

interface Props {
  onRun: (params: SvgPipelineParams) => void;
  loading: boolean;
}

export default function AiSvgPipelinePanel({ onRun, loading }: Props) {
  const [keyword, setKeyword] = useState("");
  const [minStrokeLength, setMinStrokeLength] = useState(2);

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onRun({ keyword: keyword.trim(), min_stroke_length: minStrokeLength });
  };

  return (
    <div className="panel">
      <h2>AI SVG 생성</h2>
      <form onSubmit={handleSubmit}>
        <div className="params">
          <label className="param-row">
            <span>주제어</span>
            <input
              type="text"
              className="keyword-input"
              placeholder="예: apple, house (영어 입력이 유용)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>

          <h3>파라미터</h3>

          <label className="param-row">
            <span>최소 스트로크 길이 (점)</span>
            <input
              type="number"
              min={2}
              value={minStrokeLength}
              onChange={(e) => setMinStrokeLength(Number(e.target.value))}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!keyword.trim() || loading}
          className="run-btn"
        >
          {loading ? "생성 중..." : "SVG 생성"}
        </button>
      </form>
    </div>
  );
}
