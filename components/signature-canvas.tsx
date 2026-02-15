'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface SignatureCanvasProps {
  onSignature: (blob: Blob) => void;
  disabled?: boolean;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 300;

export function SignatureCanvas({ onSignature, disabled }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Inicializar canvas con fondo blanco
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setHasStrokes(false);
    lastPoint.current = null;
  }, []);

  useEffect(() => {
    clearCanvas();
  }, [clearCanvas]);

  function getPoint(
    e: React.TouchEvent | React.MouseEvent,
  ): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDrawing(e: React.TouchEvent | React.MouseEvent) {
    if (disabled) return;
    e.preventDefault();
    const point = getPoint(e);
    if (!point) return;

    setIsDrawing(true);
    lastPoint.current = point;
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawing || disabled) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const point = getPoint(e);
    if (!ctx || !point || !lastPoint.current) return;

    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPoint.current = point;
    setHasStrokes(true);
  }

  function stopDrawing() {
    setIsDrawing(false);
    lastPoint.current = null;
  }

  function handleSubmit() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;

    canvas.toBlob(
      (blob) => {
        if (blob) onSignature(blob);
      },
      'image/png',
      1.0,
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-lg border-2 border-zinc-300 dark:border-zinc-600">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full touch-none bg-white"
          style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={clearCanvas}
          disabled={disabled || !hasStrokes}
          className="rounded-lg border px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !hasStrokes}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Enviar firma
        </button>
      </div>
    </div>
  );
}
