import React, { useState, useRef, useEffect } from 'react';
import { Cpu, Layers, Box, CheckCircle2, AlertTriangle, RefreshCw, Zap, Sliders, ShieldCheck, Activity, Terminal } from 'lucide-react';

export const DronePcbPanel: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState<'TOP_COPPER' | 'INNER_GND' | 'INNER_PWR' | 'BOTTOM_COPPER' | 'ALL'>('ALL');
  const [selectedComponent, setSelectedComponent] = useState<string | null>('U1_MCU');
  const [drcPassed, setDrcPassed] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const boardWidthMm = 36;
  const boardHeightMm = 36;
  const holeSpacingMm = 30.5; // Standard drone FC mounting pattern

  // Components on the flight controller board
  const components = [
    { id: 'U1_MCU', name: 'STM32H753VI', desc: 'Arm Cortex-M7 @ 480MHz, 2MB Flash, 1MB RAM', x: 18, y: 18, w: 12, h: 12, layer: 'TOP' },
    { id: 'U2_IMU1', name: 'ICM-42688P (Primary)', desc: '6-Axis Ultra-Low Noise Gyro/Accel on SPI1', x: 10, y: 10, w: 4, h: 4, layer: 'TOP' },
    { id: 'U3_IMU2', name: 'ICM-42688P (Redundant)', desc: 'Redundant 6-Axis Gyro/Accel on SPI4', x: 26, y: 10, w: 4, h: 4, layer: 'TOP' },
    { id: 'U4_BARO', name: 'BMP388', desc: 'High-Precision Altimeter Barometer on I2C2', x: 10, y: 26, w: 3, h: 3, layer: 'TOP' },
    { id: 'J1_USBC', name: 'USB-C Programming Port', desc: 'Direct DFU / Mavlink Telemetry Interface', x: 34, y: 18, w: 4, h: 8, layer: 'TOP' },
    { id: 'U5_FLASH', name: 'W25Q128 128Mbit Flash', desc: 'Blackbox High-Speed Flight Data Logger', x: 26, y: 26, w: 5, h: 5, layer: 'TOP' },
    { id: 'CONN_MOTORS', name: '4x DShot600 Motor Header', desc: 'M1-M4 PWM/Bidirectional DShot Outputs', x: 18, y: 33, w: 16, h: 4, layer: 'BOTTOM' }
  ];

  // Draw 2D Interactive High-Resolution PCB
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const scale = (Math.min(w, h) - 60) / boardWidthMm;
    const offsetX = (w - boardWidthMm * scale) / 2;
    const offsetY = (h - boardHeightMm * scale) / 2;

    // 1. Board Substrate (Matte Black Aerospace FR4)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(offsetX, offsetY, boardWidthMm * scale, boardHeightMm * scale, 6);
    ctx.fill();
    ctx.stroke();

    // 2. Silkscreen Border & Pin 1 Indicator
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(offsetX + 8, offsetY + 8, (boardWidthMm - 16 / scale) * scale, (boardHeightMm - 16 / scale) * scale);

    // 3. Four Standard 30.5x30.5mm M3 Mounting Holes
    const halfSpacing = holeSpacingMm / 2;
    const centerBoardX = boardWidthMm / 2;
    const centerBoardY = boardHeightMm / 2;
    const holePositions = [
      { x: centerBoardX - halfSpacing, y: centerBoardY - halfSpacing },
      { x: centerBoardX + halfSpacing, y: centerBoardY - halfSpacing },
      { x: centerBoardX - halfSpacing, y: centerBoardY + halfSpacing },
      { x: centerBoardX + halfSpacing, y: centerBoardY + halfSpacing }
    ];

    holePositions.forEach(hp => {
      const hpx = offsetX + hp.x * scale;
      const hpy = offsetY + hp.y * scale;
      // Gold pad ring
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(hpx, hpy, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      // Through-hole drill (Ø3.2mm)
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(hpx, hpy, 1.6 * scale, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Copper Traces
    if (activeLayer === 'TOP_COPPER' || activeLayer === 'ALL') {
      ctx.strokeStyle = '#f59e0b'; // Top gold/copper
      ctx.lineWidth = 2;
      // Traces from MCU to IMU1, IMU2, Baro, Flash
      [
        [{ x: 18, y: 18 }, { x: 14, y: 14 }, { x: 10, y: 10 }],
        [{ x: 18, y: 18 }, { x: 22, y: 14 }, { x: 26, y: 10 }],
        [{ x: 18, y: 18 }, { x: 14, y: 22 }, { x: 10, y: 26 }],
        [{ x: 18, y: 18 }, { x: 22, y: 22 }, { x: 26, y: 26 }],
        [{ x: 18, y: 18 }, { x: 28, y: 18 }, { x: 34, y: 18 }],
        [{ x: 18, y: 18 }, { x: 18, y: 28 }, { x: 18, y: 33 }]
      ].forEach(path => {
        ctx.beginPath();
        path.forEach((pt, i) => {
          const px = offsetX + pt.x * scale;
          const py = offsetY + pt.y * scale;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
    }

    if (activeLayer === 'BOTTOM_COPPER' || activeLayer === 'ALL') {
      ctx.strokeStyle = '#38bdf8'; // Bottom copper traces
      ctx.lineWidth = 1.5;
      [
        [{ x: 10, y: 18 }, { x: 10, y: 30 }, { x: 18, y: 33 }],
        [{ x: 26, y: 18 }, { x: 26, y: 30 }, { x: 20, y: 33 }]
      ].forEach(path => {
        ctx.beginPath();
        path.forEach((pt, i) => {
          const px = offsetX + pt.x * scale;
          const py = offsetY + pt.y * scale;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
    }

    // 5. Components Rendering
    components.forEach(comp => {
      const cx = offsetX + (comp.x - comp.w / 2) * scale;
      const cy = offsetY + (comp.y - comp.h / 2) * scale;
      const cw = comp.w * scale;
      const ch = comp.h * scale;

      const isSelected = comp.id === selectedComponent;

      ctx.fillStyle = isSelected ? '#1e3a8a' : '#1e293b';
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#64748b';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;

      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeRect(cx, cy, cw, ch);

      // Label
      ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(comp.id.split('_')[1] || comp.id, cx + cw / 2, cy + ch / 2 + 3);
    });

  }, [activeLayer, selectedComponent]);

  const activeCompData = components.find(c => c.id === selectedComponent);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-400" />
              REFERENCE_BENCHMARK: Industrial Drone 4-Layer Avionics & Flight Controller
            </h1>
            <span className="px-2.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-xs font-mono font-bold">
              REFERENCE ONLY
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Historical baseline for aerospace flight controller boards. Used for component placement comparison and vibration damping study.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            DRC RULES: 100% PASSED
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: 2D Interactive Canvas & Layer Selectors */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Multi-Layer PCB Viewport (Scale: 1:1.8)
              </h2>
            </div>

            {/* Layer Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'TOP_COPPER', label: 'L1: Top' },
                { id: 'INNER_GND', label: 'L2: GND' },
                { id: 'INNER_PWR', label: 'L3: PWR' },
                { id: 'BOTTOM_COPPER', label: 'L4: Bottom' }
              ].map(l => (
                <button
                  key={l.id}
                  onClick={() => setActiveLayer(l.id as any)}
                  className={`px-2.5 py-1 rounded transition font-bold ${
                    activeLayer === l.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center p-4 bg-slate-950 rounded-xl border border-slate-800/80">
            <canvas
              ref={canvasRef}
              width={480}
              height={420}
              className="rounded-lg shadow-2xl cursor-crosshair max-w-full"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-2">
            <span>Dimensions: 36.00 mm x 36.00 mm</span>
            <span>Substrate: FR4 High-Tg (1.6mm)</span>
            <span>Copper Weight: 2.0 oz (70µm)</span>
          </div>
        </div>

        {/* Right Column: Component Inspector & Mechanical Fit */}
        <div className="space-y-6">
          {/* Component Selection List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Flight Controller Netlist & ICs
            </h3>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
              {components.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedComponent(c.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition text-xs ${
                    selectedComponent === c.id
                      ? 'bg-blue-600/20 text-white border-blue-500/50 shadow-sm'
                      : 'bg-slate-950 text-slate-300 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>{c.name}</span>
                    <span className="text-[10px] font-mono opacity-60">{c.layer}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{c.desc}</div>
                </button>
              ))}
            </div>

            {activeCompData && (
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-2 text-xs">
                <div className="font-bold text-sky-400">{activeCompData.name}</div>
                <div className="text-[11px] text-slate-300">{activeCompData.desc}</div>
                <div className="text-[10px] font-mono text-slate-400">
                  Location: X={activeCompData.x}mm, Y={activeCompData.y}mm · Footprint: {activeCompData.w}x{activeCompData.h}mm
                </div>
              </div>
            )}
          </div>

          {/* Mechanical Enclosure & Standoff Alignment */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Box className="w-4 h-4 text-amber-400" />
              MCAD Enclosure Standoff Fit
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Mounting Pattern:</span>
                <span className="font-mono text-white font-bold">30.5 x 30.5 mm M3</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Deck Alignment:</span>
                <span className="text-emerald-400 font-bold font-mono">CONCENTRIC (0.00mm error)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Damping Grommets:</span>
                <span className="text-sky-400 font-mono">Silicone M3 Isolators</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Z-Clearance to Top Deck:</span>
                <span className="font-mono text-slate-200">11.4 mm (OK)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
