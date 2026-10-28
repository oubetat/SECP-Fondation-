import React, { useState } from 'react';
import { Activity, Play, Settings, ShieldCheck, AlertCircle, BarChart3, Download, Share2 } from 'lucide-react';

interface SimulationResult {
  id: string;
  type: string;
  status: 'COMPLETED' | 'RUNNING' | 'FAILED';
  metrics: {
    maxStress: string;
    maxDisplacement: string;
    safetyFactor: string;
  };
  timestamp: string;
}

const MOCK_RESULTS: SimulationResult[] = [
  {
    id: 'SIM-RES-001',
    type: 'Static Structural',
    status: 'COMPLETED',
    metrics: { maxStress: '450 MPa', maxDisplacement: '1.2 mm', safetyFactor: '1.8' },
    timestamp: '2026-10-27 09:45'
  },
  {
    id: 'SIM-RES-002',
    type: 'Thermal-Structural',
    status: 'RUNNING',
    metrics: { maxStress: '...', maxDisplacement: '...', safetyFactor: '...' },
    timestamp: '2026-10-27 10:15'
  }
];

export const PhysicsSimulation: React.FC = () => {
  const [selectedSim, setSelectedSim] = useState<string>(MOCK_RESULTS[0].id);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      <div className="p-6 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <Activity className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white uppercase tracking-wider">Physics & Simulation</h1>
            <p className="text-slate-400 text-xs tracking-tight">Multi-physics evaluation of programmable designs</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 border border-slate-700 uppercase tracking-widest">
            <Settings className="w-4 h-4" /> Solver Config
          </button>
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 uppercase tracking-widest shadow-lg shadow-emerald-900/20">
            <Play className="w-4 h-4" /> Run Solve
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Results History */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/10 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <BarChart3 className="w-4 h-4" /> Solution History
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {MOCK_RESULTS.map(sim => (
              <button
                key={sim.id}
                onClick={() => setSelectedSim(sim.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedSim === sim.id
                    ? 'bg-blue-600/10 border-blue-500/50'
                    : 'bg-slate-900/30 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    sim.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400 animate-pulse'
                  }`}>
                    {sim.status}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">{sim.timestamp}</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{sim.type}</h3>
                <p className="text-[10px] text-slate-500 font-mono">{sim.id}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Center Panel: Visualization & Fields */}
        <div className="flex-1 flex flex-col bg-black relative">
           {/* Visual Container */}
           <div className="flex-1 flex items-center justify-center p-12 overflow-hidden">
              <div className="relative w-full h-full max-w-4xl bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden group">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(59,130,246,0.1),_transparent)]" />
                 
                 {/* Fake Contour Map Overlay (Representing FEM Results) */}
                 <div className="absolute inset-0 flex items-center justify-center p-20 opacity-40 group-hover:opacity-60 transition-opacity">
                    <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-blue-900 via-emerald-600 to-rose-600 blur-3xl" />
                 </div>

                 <div className="text-center z-10 space-y-4">
                    <Activity className="w-16 h-16 text-blue-500 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-white tracking-widest uppercase">FEM POST-PROCESSOR</p>
                      <p className="text-xs text-slate-500 font-mono">SCALAR FIELD: VON_MISES_STRESS</p>
                    </div>
                 </div>

                 {/* Legend */}
                 <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                    <div className="flex flex-col items-center gap-2">
                       <span className="text-[10px] font-bold text-slate-400">MAX</span>
                       <div className="w-3 h-32 rounded-full bg-gradient-to-t from-blue-500 via-emerald-500 to-rose-500" />
                       <span className="text-[10px] font-bold text-slate-400">MIN</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Results Toolbar */}
           <div className="h-16 bg-slate-950 border-t border-slate-800 flex items-center px-6 gap-6 justify-between backdrop-blur-md bg-slate-950/90">
              <div className="flex gap-8">
                 <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Max Stress</span>
                    <span className="text-sm font-black text-rose-400">{MOCK_RESULTS.find(r => r.id === selectedSim)?.metrics.maxStress}</span>
                 </div>
                 <div className="flex flex-col border-l border-slate-800 pl-8">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Max Displ.</span>
                    <span className="text-sm font-black text-blue-400">{MOCK_RESULTS.find(r => r.id === selectedSim)?.metrics.maxDisplacement}</span>
                 </div>
                 <div className="flex flex-col border-l border-slate-800 pl-8">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Safety Factor</span>
                    <span className="text-sm font-black text-emerald-400">{MOCK_RESULTS.find(r => r.id === selectedSim)?.metrics.safetyFactor}</span>
                 </div>
              </div>

              <div className="flex gap-2">
                 <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors" title="Download Report">
                    <Download className="w-5 h-5" />
                 </button>
                 <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors" title="Share Results">
                    <Share2 className="w-5 h-5" />
                 </button>
              </div>
           </div>
        </div>

        {/* Right Panel: Verification Invariants */}
        <div className="w-80 border-l border-slate-800 bg-slate-900/10 flex flex-col shrink-0 p-6 space-y-6">
           <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Numerical Integrity
           </div>
           
           <div className="space-y-4">
              <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">Energy Convergence</span>
                    <span className="text-[10px] font-mono text-emerald-400">PASS</span>
                 </div>
                 <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-full" />
                 </div>
              </div>

              <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">Matrix Conditioning</span>
                    <span className="text-[10px] font-mono text-emerald-400">OPTIMAL</span>
                 </div>
                 <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-full" />
                 </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex gap-3 items-start">
                 <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-slate-500 leading-relaxed">
                    Constitutive consistency checked for spatially varying Young's Modulus. 
                    Local gradient rates are within solver stability limits.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
