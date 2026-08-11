import React, { useState, useRef, useEffect } from 'react';
import {
  PcbEngine,
  SchematicComponent,
  SchematicNet,
  PcbDesign,
  MechanicalEnclosureIntegration
} from '../engine/pcbEngine';
import { Cpu, Layers, Box, CheckCircle2, AlertTriangle, RefreshCw, Zap, Sliders, ArrowRight } from 'lucide-react';

export const PcbWorkbenchPanel: React.FC = () => {
  const [boardWidth, setBoardWidth] = useState<number>(90);
  const [boardHeight, setBoardHeight] = useState<number>(55);
  const [pcbThickness, setPcbThickness] = useState<number>(1.6);

  const schematic = PcbEngine.getDefaultSchematic();
  const [pcb, setPcb] = useState<PcbDesign>(() =>
    PcbEngine.generatePcbLayout(boardWidth, boardHeight, pcbThickness)
  );

  const [activeTab, setActiveTab] = useState<'SCHEMATIC' | 'PCB_2D' | 'MCAD_3D'>('PCB_2D');

  const enclosure: MechanicalEnclosureIntegration = PcbEngine.verifyMechanicalEnclosureFit(pcb);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render 2D PCB Canvas
  useEffect(() => {
    if (activeTab !== 'PCB_2D') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const scale = Math.min((w - 60) / pcb.boardWidthMm, (h - 60) / pcb.boardHeightMm);
    const offsetX = 30;
    const offsetY = 30;

    // Draw FR4 Substrate Board Outline
    ctx.fillStyle = '#064e3b'; // FR4 Green
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.fillRect(offsetX, offsetY, pcb.boardWidthMm * scale, pcb.boardHeightMm * scale);
    ctx.strokeRect(offsetX, offsetY, pcb.boardWidthMm * scale, pcb.boardHeightMm * scale);

    // Draw Mounting Holes
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    pcb.mountingHoles.forEach(mh => {
      const cx = offsetX + mh.x * scale;
      const cy = offsetY + mh.y * scale;
      const r = (mh.diameterMm / 2) * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw Traces
    pcb.traces.forEach(tr => {
      ctx.strokeStyle = tr.layer === 'TOP_COPPER' ? '#f59e0b' : '#3b82f6';
      ctx.lineWidth = tr.widthMm * scale;
      ctx.beginPath();
      tr.path.forEach((pt, idx) => {
        const px = offsetX + pt.x * scale;
        const py = offsetY + pt.y * scale;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    });

    // Draw Component Placements & Pads
    pcb.placements.forEach(comp => {
      const cx = offsetX + comp.xMm * scale;
      const cy = offsetY + comp.yMm * scale;
      const cw = comp.widthMm * scale;
      const ch = comp.heightMm * scale;

      ctx.fillStyle = comp.colorHex;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1;
      ctx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
      ctx.strokeRect(cx - cw / 2, cy - ch / 2, cw, ch);

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(comp.refDes, cx, cy + 3);
    });
  }, [activeTab, pcb]);

  const handleRegeneratePcb = () => {
    setPcb(PcbEngine.generatePcbLayout(boardWidth, boardHeight, pcbThickness));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
            <Cpu className="w-5 h-5 text-indigo-400" />
            PATCH-SECP-013 — Electronics & PCB (ECAD to MCAD Co-Design)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Schematic → Component Footprints → Netlist → 2D/3D PCB → Mechanical Assembly Enclosure Fit.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('SCHEMATIC')}
            className={`px-3 py-1.5 rounded font-semibold transition cursor-pointer ${
              activeTab === 'SCHEMATIC' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Schematic & Netlist
          </button>
          <button
            onClick={() => setActiveTab('PCB_2D')}
            className={`px-3 py-1.5 rounded font-semibold transition cursor-pointer ${
              activeTab === 'PCB_2D' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. 2D PCB Layout
          </button>
          <button
            onClick={() => setActiveTab('MCAD_3D')}
            className={`px-3 py-1.5 rounded font-semibold transition cursor-pointer ${
              activeTab === 'MCAD_3D' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3. 3D MCAD Enclosure
          </button>
        </div>
      </div>

      {/* Main View Renderings */}
      {activeTab === 'SCHEMATIC' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Schematic Components Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Schematic Component Bill of Materials
            </h3>
            <div className="space-y-2">
              {schematic.components.map(c => (
                <div key={c.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-indigo-300 mr-2">{c.refDes}</span>
                    <span className="text-slate-200 font-medium">{c.name}</span>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.value} ({c.footprint})</div>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded text-[10px]">
                    {c.pinCount} Pins
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Netlist Structure */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Generated Electrical Netlist
            </h3>
            <div className="space-y-2">
              {schematic.nets.map(n => (
                <div key={n.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded text-xs">
                  <div className="font-bold text-amber-300 font-mono mb-1">{n.name}</div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                    {n.connectedPins.map((p, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                        {p.refDes}.P{p.pinNumber}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PCB_2D' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Controls Column */}
          <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-400" />
              PCB Substrate & Layer Parameters
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Board Width:</span>
                  <span className="font-mono text-indigo-300 font-bold">{boardWidth} mm</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={boardWidth}
                  onChange={e => setBoardWidth(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Board Height:</span>
                  <span className="font-mono text-indigo-300 font-bold">{boardHeight} mm</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={boardHeight}
                  onChange={e => setBoardHeight(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>FR4 Thickness:</span>
                  <span className="font-mono text-emerald-300 font-bold">{pcbThickness} mm</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="3.2"
                  step="0.2"
                  value={pcbThickness}
                  onChange={e => setPcbThickness(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <button
                onClick={handleRegeneratePcb}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-Route Traces & Placements
              </button>
            </div>
          </div>

          {/* 2D PCB Graphic Canvas */}
          <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="text-[11px] font-mono text-slate-400 flex justify-between items-center border-b border-slate-800 pb-2">
              <span>2D PCB Copper Routing & Silkscreen Layer</span>
              <span className="text-amber-400 font-bold font-mono">FR4 • 2 Layers • {pcb.placements.length} Components</span>
            </div>
            <canvas
              ref={canvasRef}
              width={500}
              height={260}
              className="w-full h-64 bg-slate-900 rounded border border-slate-800"
            />
          </div>
        </div>
      )}

      {activeTab === 'MCAD_3D' && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Box className="w-4 h-4 text-emerald-400" />
                MCAD Mechanical Assembly Enclosure Integration
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated Co-Design: Form-fitting enclosure generated with PCB standoffs and M3 mounting holes.
              </p>
            </div>

            <div className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 ${
              enclosure.status === 'FIT_VERIFIED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              {enclosure.status}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded">
              <span className="text-slate-400 block text-[10px]">ENCLOSURE X-Y</span>
              <span className="text-base font-bold text-indigo-300">
                {enclosure.enclosureWidthMm.toFixed(1)} x {enclosure.enclosureLengthMm.toFixed(1)} mm
              </span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded">
              <span className="text-slate-400 block text-[10px]">INTERNAL HEIGHT</span>
              <span className="text-base font-bold text-emerald-300">
                {enclosure.enclosureHeightMm.toFixed(1)} mm
              </span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded">
              <span className="text-slate-400 block text-[10px]">STANDOFF PILOT</span>
              <span className="text-base font-bold text-amber-300">
                {enclosure.standoffHeightMm} mm (M3 Screws)
              </span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded">
              <span className="text-slate-400 block text-[10px]">WALL THICKNESS</span>
              <span className="text-base font-bold text-cyan-300">
                {enclosure.wallThicknessMm} mm
              </span>
            </div>
          </div>

          {/* Assembly Structural Diagram */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-lg text-center font-mono text-xs space-y-4">
            <div className="text-slate-400">Complete Device CAD Mechanical Assembly Hierarchy:</div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="p-2.5 bg-blue-950 border border-blue-800 text-blue-300 rounded font-bold">
                Lower Case Enclosure
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span className="p-2.5 bg-amber-950 border border-amber-800 text-amber-300 rounded font-bold">
                M3 Standoff Pillars (x4)
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span className="p-2.5 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded font-bold">
                3D PCB Substrate & Components
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span className="p-2.5 bg-purple-950 border border-purple-800 text-purple-300 rounded font-bold">
                Upper Snap Lid
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
