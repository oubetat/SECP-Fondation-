import React from 'react';
import { Cpu, Target, Sliders, Activity, ShieldCheck, AlertCircle, TrendingDown, Layers } from 'lucide-react';

interface Candidate {
  id: string;
  mass: string;
  stiffness: string;
  status: 'OPTIMAL' | 'FEASIBLE' | 'REJECTED';
}

const MOCK_CANDIDATES: Candidate[] = [
  { id: 'CAN-004', mass: '1.2 kg', stiffness: '145 kN/m', status: 'OPTIMAL' },
  { id: 'CAN-002', mass: '1.5 kg', stiffness: '138 kN/m', status: 'FEASIBLE' },
  { id: 'CAN-001', mass: '1.8 kg', stiffness: '150 kN/m', status: 'REJECTED' },
];

export const EngineeringOptimization: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-6 overflow-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-cyan-600/20 rounded-lg">
          <Cpu className="w-8 h-8 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Engineering Optimization</h1>
          <p className="text-slate-400 text-sm">V10 Multi-objective design exploration and Pareto optimization</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Objectives & Constraints */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                 <Target className="w-4 h-4 text-cyan-500" /> Design Goals
              </div>
              <div className="space-y-4">
                 <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-[10px] font-bold">
                       <span className="text-slate-500">MINIMIZE MASS</span>
                       <span className="text-cyan-400">PRIORITY: 1</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-cyan-500 w-full" />
                    </div>
                 </div>
                 <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-[10px] font-bold">
                       <span className="text-slate-500">MAXIMIZE STIFFNESS</span>
                       <span className="text-emerald-400">PRIORITY: 2</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-2/3" />
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                 <Sliders className="w-4 h-4 text-blue-500" /> Design Variables
              </div>
              <div className="space-y-3">
                 <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Density Map Scale</p>
                    <p className="text-xs text-slate-300 font-mono">[0.2, 1.0]</p>
                 </div>
                 <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Gradient Slope</p>
                    <p className="text-xs text-slate-300 font-mono">Max 10 GPa/mm</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Pareto Frontier / Candidates */}
        <div className="lg:col-span-3 space-y-6">
           <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[400px]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-emerald-500" /> Pareto Optimal Frontier
                 </h2>
                 <button className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold rounded-lg transition-colors uppercase">Execute Search</button>
              </div>
              <div className="flex-1 relative bg-black flex items-center justify-center group overflow-hidden">
                 {/* Visual Representation of Pareto Plot */}
                 <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:20px_20px]" />
                 
                 {/* Pareto Curve */}
                 <svg className="w-full h-full p-12 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M 10,90 Q 20,20 90,10" fill="none" stroke="rgba(34,211,238,0.3)" strokeWidth="0.5" strokeDasharray="2,2" />
                    {/* Points */}
                    <circle cx="15" cy="85" r="1.5" className="fill-rose-500 shadow-lg cursor-pointer" />
                    <circle cx="30" cy="40" r="2.5" className="fill-emerald-400 shadow-[0_0_10px_#10b981] cursor-pointer animate-pulse" />
                    <circle cx="50" cy="25" r="1.5" className="fill-cyan-500 shadow-lg cursor-pointer" />
                    <circle cx="80" cy="15" r="1.5" className="fill-cyan-500 shadow-lg cursor-pointer" />
                 </svg>

                 {/* Axis Labels */}
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stiffness (kN/m)</div>
                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mass (kg)</div>
                 
                 {/* Hover Label */}
                 <div className="absolute top-1/4 left-1/3 bg-slate-900 border border-emerald-500/50 p-3 rounded-xl shadow-2xl z-20 backdrop-blur-xl">
                    <p className="text-[10px] font-black text-emerald-400 mb-1 uppercase tracking-tighter italic">Recommended Design</p>
                    <p className="text-xs font-bold text-white">CANDIDATE CAN-004</p>
                    <div className="mt-2 space-y-1">
                       <p className="text-[9px] text-slate-400">Mass: 1.2kg (-33%)</p>
                       <p className="text-[9px] text-slate-400">Stiffness: 145 kN/m (+12%)</p>
                    </div>
                 </div>
              </div>
           </div>

           {/* Candidate Table */}
           <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="divide-y divide-slate-800">
                 {MOCK_CANDIDATES.map(c => (
                    <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
                       <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${
                             c.status === 'OPTIMAL' ? 'bg-emerald-500' : 
                             c.status === 'FEASIBLE' ? 'bg-cyan-500' : 'bg-slate-700'
                          }`} />
                          <span className="text-xs font-bold text-white">{c.id}</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                             c.status === 'OPTIMAL' ? 'bg-emerald-500/10 text-emerald-400' : 
                             c.status === 'FEASIBLE' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-800 text-slate-500'
                          }`}>{c.status}</span>
                       </div>
                       <div className="flex gap-8 text-right pr-4">
                          <div className="flex flex-col">
                             <span className="text-[9px] text-slate-500 uppercase font-bold">Mass</span>
                             <span className="text-xs font-mono text-slate-300">{c.mass}</span>
                          </div>
                          <div className="flex flex-col min-w-[80px]">
                             <span className="text-[9px] text-slate-500 uppercase font-bold">Stiffness</span>
                             <span className="text-xs font-mono text-slate-300">{c.stiffness}</span>
                          </div>
                          <button className="text-[10px] text-blue-400 font-bold hover:text-blue-300 uppercase underline-offset-4 underline">Activate</button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
