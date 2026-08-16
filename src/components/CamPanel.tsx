import React, { useState } from 'react';
import { CamEngine, ManufacturingProcessType, CamJobPackage } from '../engine/camEngine';
import { FiveAxisSimulationPanel } from './FiveAxisSimulationPanel';
import { Cpu, Terminal, Sliders, Play, CheckCircle2, Download, Layers, Wrench } from 'lucide-react';

export const CamPanel: React.FC = () => {
  const [processType, setProcessType] = useState<ManufacturingProcessType>('CNC_MILLING');

  const camJob: CamJobPackage = CamEngine.generateCamJob(processType, 120, 60, 30);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-rose-400">
              <Wrench className="w-5 h-5" />
              Manufacturing & CAM Orchestrator
            </h2>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              SECP-CAM-ENGINE: Feature Recognition → Post-Processor G-Code
            </p>
          </div>

          {/* Process Selector */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px] font-bold">
            {(['CNC_MILLING', 'THREE_D_PRINTING', 'LASER_CUTTING', 'SHEET_METAL_BENDING'] as ManufacturingProcessType[]).map(proc => (
              <button
                key={proc}
                onClick={() => setProcessType(proc)}
                className={`px-3 py-1.5 rounded transition cursor-pointer ${
                  processType === proc ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-500 hover:text-slate-200'
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
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 space-y-4 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-500 uppercase">Features Recognized</span>
                <span className="text-rose-400 font-bold">{camJob.machineName}</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {camJob.features.map(f => (
                  <div key={f.id} className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-rose-300">{f.type}</span>
                      <span className="text-[10px] text-emerald-400 px-1.5 py-0.5 bg-emerald-950 rounded">{f.machiningTimeSec}s</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Toolpath Strategy: <span className="text-slate-300">{f.recommendedTool}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Est. Cycle Time:</span>
                  <span className="font-bold text-rose-300">{camJob.totalEstimatedTimeMin}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Volumetric MRR:</span>
                  <span className="font-bold text-emerald-400">{camJob.materialRemovalRateCm3Min} cm³/min</span>
                </div>
              </div>
            </div>
          </div>

          {/* G-Code Post Processor Output Window */}
          <div className="lg:col-span-7 space-y-3">
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 font-mono text-[10px]">
                <span className="font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Terminal className="w-3.5 h-3.5 text-rose-400" />
                  G-Code Output Stream
                </span>
                <button
                  onClick={() => alert('G-Code exported to industrial controller!')}
                  className="flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded text-[10px] font-bold transition shadow-lg shadow-rose-600/20"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              </div>

              <pre className="w-full h-56 bg-slate-950 border border-slate-800 p-3 rounded font-mono text-[11px] text-rose-300/80 overflow-y-auto leading-relaxed custom-scrollbar">
                {camJob.gCodeOutput}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* 5-Axis Simulation Sub-Workbench */}
      <div className="border-t border-slate-800 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-tight">Kinematic Simulation Workbench</h3>
        </div>
        <FiveAxisSimulationPanel />
      </div>
    </div>
  );
};
