import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Drawing } from "../types";

interface Props {
  drawing: Drawing;
}

export type StrokePreviewCanvasHandle = { toDataURL: () => string };

const StrokePreviewCanvas = forwardRef<StrokePreviewCanvasHandle, Props>(
  ({ drawing }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
      toDataURL: () => canvasRef.current?.toDataURL("image/png") ?? "",
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, 400, 400);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 400);

      const scale = 400 / 256;

      for (const stroke of drawing) {
        const [xs, ys] = stroke.points;
        const [r, g, b] = stroke.color;
        if (xs.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(xs[0] * scale, ys[0] * scale);
        for (let i = 1; i < xs.length; i++) {
          ctx.lineTo(xs[i] * scale, ys[i] * scale);
        }
        // ctx.closePath();
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }, [drawing]);

    return (
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        style={{
          border: "1px solid #e5e7eb",
          background: "#fff",
          display: "block",
        }}
      />
    );
  },
);

StrokePreviewCanvas.displayName = "StrokePreviewCanvas";
export default StrokePreviewCanvas;
