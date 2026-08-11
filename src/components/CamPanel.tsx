import React, { useState } from 'react';
import { CamEngine, ManufacturingProcessType, CamJobPackage } from '../engine/camEngine';
import { Cpu, Terminal, Sliders, Play, CheckCircle2, Download, Layers, Wrench } from 'lucide-react';

export const CamPanel: React.FC = () => {
  const [processType, setProcessType] = useState<ManufacturingProcessType>('CNC_MILLING');

  const camJob: CamJobPackage = CamEngine.generateCamJob(processType, 120, 60, 30);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-rose-400">
            <Wrench className="w-5 h-5 text-rose-400" />
            PATCH-SECP-020 — Manufacturing / CAM Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Feature Recognition → Toolpath Generator → Post-Processor G-Code (CNC, 3D Print, Laser, Sheet Metal).
          </p>
        </div>

        {/* Process Selector */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          {(['CNC_MILLING', 'THREE_D_PRINTING', 'LASER_CUTTING', 'SHEET_METAL_BENDING'] as ManufacturingProcessType[]).map(proc => (
            <button
              key={proc}
              onClick={() => setProcessType(proc)}
              className={`px-3 py-1.5 rounded font-semibold transition cursor-pointer ${
                processType === proc ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {proc.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Machine & Feature Recognition Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Feature List & Telemetry */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200 uppercase font-mono">Recognized CAM Features</span>
            <span className="text-rose-400 font-mono font-bold">{camJob.machineName}</span>
          </div>

          <div className="space-y-2">
            {camJob.features.map(f => (
              <div key={f.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1 font-mono">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-rose-300">{f.type} FEATURE</span>
                  <span className="text-[11px] text-amber-300">{f.machiningTimeSec}s</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Tool: <span className="text-slate-200 font-semibold">{f.recommendedTool}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg font-mono space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Machining Time:</span>
              <span className="font-bold text-rose-300">{camJob.totalEstimatedTimeMin} Minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Material Removal Rate:</span>
              <span className="font-bold text-emerald-400">{camJob.materialRemovalRateCm3Min} cm³/min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Toolpath Waypoints:</span>
              <span className="font-bold text-indigo-300">{camJob.toolpathPoints.length} Points</span>
            </div>
          </div>
        </div>

        {/* G-Code Post Processor Output Window */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 font-mono text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-rose-400" />
              G-Code Post-Processor Terminal
            </span>
            <button
              onClick={() => alert('G-Code downloaded for Machine controller!')}
              className="flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download G-Code
            </button>
          </div>

          <pre className="w-full h-64 bg-slate-900 border border-slate-800 p-3 rounded font-mono text-xs text-rose-300 overflow-y-auto leading-relaxed">
            {camJob.gCodeOutput}
          </pre>
        </div>
      </div>
    </div>
  );
};
