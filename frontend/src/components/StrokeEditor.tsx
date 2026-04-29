import type { Drawing } from "../types";
import { PALETTE_COLORS } from "../types";

interface Props {
  drawing: Drawing;
  onChange: (drawing: Drawing) => void;
  onReset?: () => void;
}

export default function StrokeEditor({ drawing, onChange, onReset }: Props) {
  const handleDelete = (index: number) => {
    onChange(drawing.filter((_, i) => i !== index));
  };

  const handleColorChange = (index: number, rgb: [number, number, number]) => {
    onChange(drawing.map((stroke, i) => (i === index ? { ...stroke, color: rgb } : stroke)));
  };

  if (drawing.length === 0 && !onReset) return null;

  return (
    <div className="stroke-editor">
      <div className="stroke-editor-header">
        <h3>스트로크 편집 ({drawing.length}개)</h3>
        {onReset && (
          <button className="reset-btn" onClick={onReset}>
            초기화
          </button>
        )}
      </div>
      <ul className="stroke-list">
        {drawing.map((stroke, index) => {
          const [r, g, b] = stroke.color;
          const pointCount = stroke.points[0].length;
          return (
            <li key={index} className="stroke-item">
              <span
                className="color-swatch"
                style={{ background: `rgb(${r},${g},${b})` }}
              />
              <span className="stroke-info">#{index + 1} — {pointCount}pt</span>
              <select
                value={`${r},${g},${b}`}
                onChange={(e) => {
                  const found = PALETTE_COLORS.find((c) => c.rgb.join(",") === e.target.value);
                  if (found) handleColorChange(index, [...found.rgb] as [number, number, number]);
                }}
              >
                {PALETTE_COLORS.map((c) => (
                  <option key={c.name} value={c.rgb.join(",")}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button className="delete-btn" onClick={() => handleDelete(index)}>
                삭제
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
