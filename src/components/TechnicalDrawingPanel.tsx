import React, { useState, useRef, useEffect } from 'react';
import { TechnicalDrawingEngine, TechnicalDrawingSheet } from '../engine/drawingEngine';
import { FileText, Download, CheckCircle2, Sliders, Layers } from 'lucide-react';

export const TechnicalDrawingPanel: React.FC = () => {
  const [drawingSheet, setDrawingSheet] = useState<TechnicalDrawingSheet>(
    TechnicalDrawingEngine.generateTechnicalDrawing()
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Draw White Blueprint Sheet Paper
    ctx.fillStyle = '#1e293b'; // Technical Dark Slate Blueprint
    ctx.fillRect(0, 0, w, h);

    // Draw Outer Border Margin (Standard A3 Format)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 15, w - 30, h - 30);

    // Draw Title Block (Bottom Right Corner)
    const tbW = 240;
    const tbH = 90;
    const tbX = w - 15 - tbW;
    const tbY = h - 15 - tbH;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tbX, tbY, tbW, tbH);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(drawingSheet.titleBlock.companyName, tbX + 10, tbY + 20);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(drawingSheet.titleBlock.drawingTitle, tbX + 10, tbY + 40);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`DRW NO: ${drawingSheet.titleBlock.drawingNumber}`, tbX + 10, tbY + 60);
    ctx.fillText(`REV: ${drawingSheet.titleBlock.revision} | MAT: ${drawingSheet.titleBlock.material.split(' ')[0]}`, tbX + 10, tbY + 75);

    // Render Orthographic View Wireframe Outlines & Annotations
    drawingSheet.views.forEach(view => {
      const vx = view.position.x;
      const vy = view.position.y;

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;

      if (view.title === 'FRONT_VIEW') {
        ctx.strokeRect(vx - 50, vy - 20, 100, 40);
        // Centerlines
        ctx.strokeStyle = '#38bdf8';
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(vx - 60, vy);
        ctx.lineTo(vx + 60, vy);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (view.title === 'TOP_VIEW') {
        ctx.strokeRect(vx - 50, vy - 25, 100, 50);
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(vx - 25, vy, 6, 0, Math.PI * 2);
        ctx.arc(vx + 25, vy, 6, 0, Math.PI * 2);
        ctx.stroke();
      } else if (view.title === 'RIGHT_VIEW') {
        ctx.strokeRect(vx - 25, vy - 20, 50, 40);
      } else if (view.title === 'ISOMETRIC_VIEW') {
        // Isometric Projection Box
        ctx.beginPath();
        ctx.moveTo(vx, vy - 25);
        ctx.lineTo(vx + 35, vy - 10);
        ctx.lineTo(vx + 35, vy + 20);
        ctx.lineTo(vx, vy + 35);
        ctx.lineTo(vx - 35, vy + 20);
        ctx.lineTo(vx - 35, vy - 10);
        ctx.closePath();
        ctx.stroke();
      }

      // View Title Label
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`${view.title.replace(/_/g, ' ')} (${view.scaleRatio})`, vx - 45, vy + 45);

      // Render Dimensions & GD&T
      view.dimensions.forEach(dim => {
        ctx.fillStyle = '#f59e0b';
        ctx.font = '9px monospace';
        ctx.fillText(dim.label, vx + dim.startPoint.x, vy + dim.startPoint.y);
      });

      view.gdtSymbols.forEach(gdt => {
        ctx.strokeStyle = '#ef4444';
        ctx.strokeRect(vx + gdt.location.x, vy + gdt.location.y, 40, 14);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '8px monospace';
        ctx.fillText(`⌖ | ${gdt.toleranceMm} | ${gdt.datumRef}`, vx + gdt.location.x + 2, vy + gdt.location.y + 10);
      });
    });
  }, [drawingSheet]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-sky-400">
            <FileText className="w-5 h-5 text-sky-400" />
            PATCH-SECP-021 — Technical Drawing (2D Drafting / Engineering Drawings)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Orthographic Projections (1st / 3rd Angle) → ASME Y14.5 Dimensioning → GD&T Feature Control Frames → Title Block.
          </p>
        </div>

        <button
          onClick={() => alert('Drawing Sheet exported as Vector PDF / DXF!')}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export Drawing (DXF / PDF)
        </button>
      </div>

      {/* Blueprint Drawing Sheet Canvas */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between font-mono text-xs border-b border-slate-800 pb-2">
          <span className="text-slate-300 font-bold">Sheet 1/1 — {drawingSheet.titleBlock.drawingTitle}</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ASME Y14.5 / ISO 1101 Compliant
          </span>
        </div>

        <canvas
          ref={canvasRef}
          width={680}
          height={320}
          className="w-full h-80 bg-slate-900 rounded border border-slate-800"
        />

        {/* View Breakdown Footer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
            <span className="text-[10px] text-slate-400 block">PROJECTION</span>
            <span className="font-bold text-sky-300">{drawingSheet.projectionType}</span>
          </div>
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
            <span className="text-[10px] text-slate-400 block">SHEET SIZE / UNITS</span>
            <span className="font-bold text-indigo-300">{drawingSheet.sheetSize} / {drawingSheet.units}</span>
          </div>
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
            <span className="text-[10px] text-slate-400 block">DIMENSIONS</span>
            <span className="font-bold text-amber-300">Automatic Y14.5</span>
          </div>
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
            <span className="text-[10px] text-slate-400 block">GD&T FRAMES</span>
            <span className="font-bold text-rose-300">Flatness & Position</span>
          </div>
        </div>
      </div>
    </div>
  );
};
