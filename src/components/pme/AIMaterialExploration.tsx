import React, { useState } from 'react';
import { Sparkles, Brain, MessageSquare, ShieldCheck, AlertCircle, RefreshCw, Layers, Zap } from 'lucide-react';

interface AICandidate {
  id: string;
  rationale: string;
  innovation: string;
  metrics: { weight: string; stiff: string };
  status: 'PENDING_VALIDATION' | 'VALIDATED' | 'REJECTED';
}

const MOCK_AI_CANDIDATES: AICandidate[] = [
  { 
    id: 'AI-CAN-99', 
    rationale: 'Local density reinforcement at pivot points using a Kriging-based gradient.',
    innovation: 'High stiffness-to-weight in shear zones.',
    metrics: { weight: '1.1 kg', stiff: '152 kN/m' },
    status: 'VALIDATED'
  },
  { 
    id: 'AI-CAN-102', 
    rationale: 'Bi-modal material distribution inspired by trabecular bone micro-structures.',
    innovation: 'Internal damping enhancement.',
    metrics: { weight: '0.9 kg', stiff: '120 kN/m' },
    status: 'PENDING_VALIDATION'
  }
];

export const AIMaterialExploration: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600/20 rounded-xl">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter italic uppercase">AI Material Exploration</h1>
            <p className="text-slate-400 text-sm">V11 Physics-constrained generative material discovery</p>
          </div>
        </div>
        
        <div className="flex gap-4">
           <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Compute Budget</span>
              <div className="flex gap-1">
                 {[1,2,3,4,5].map(i => <div key={i} className={`w-3 h-1.5 rounded-full ${i < 4 ? 'bg-purple-500' : 'bg-slate-800'}`} />)}
              </div>
           </div>
           <button 
             onClick={() => { setIsGenerating(true); setTimeout(() => setIsGenerating(false), 3000); }}
             disabled={isGenerating}
             className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all uppercase tracking-widest shadow-xl shadow-purple-900/20 flex items-center gap-2"
           >
             {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
             {isGenerating ? 'Synthesizing...' : 'Generate Candidates'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: AI Intent Console */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                 <MessageSquare className="w-4 h-4 text-purple-400" /> Engineering Intent
              </div>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                 <p className="text-xs text-slate-300 leading-relaxed italic">
                   "Suggest material property distributions that minimize mass while maintaining 
                   a safety factor {'>'} 1.5 under the specified aerospace bracket load cases. 
                   Ensure all gradients are manufacturable via LPBF."
                 </p>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Physics Constraints</span>
                    <span className="text-[10px] text-emerald-400 font-mono">ENFORCED</span>
                 </div>
                 <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Mfg Capability</span>
                    <span className="text-[10px] text-emerald-400 font-mono">ENFORCED</span>
                 </div>
              </div>
           </div>

           <div className="p-6 bg-purple-950/10 border border-purple-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                 <Zap className="w-5 h-5 text-purple-400" />
                 <h3 className="text-xs font-black text-purple-200 uppercase tracking-widest">Explainability Engine</h3>
              </div>
              <p className="text-[11px] text-purple-200/60 leading-relaxed">
                The AI explorer is restricted to the <span className="text-white font-bold underline decoration-purple-500/50 underline-offset-4">Ti-6Al-4V</span> design space. 
                All candidates are automatically validated by the SECP Core solver before presentation.
              </p>
           </div>
        </div>

        {/* Right: Generated Candidates */}
        <div className="lg:col-span-2 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MOCK_AI_CANDIDATES.map(cand => (
                 <div key={cand.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-6 hover:border-purple-500/30 transition-all group shadow-xl">
                    <div className="flex justify-between items-start">
                       <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 group-hover:border-purple-500/20 transition-colors">
                          <Layers className="w-6 h-6 text-slate-500 group-hover:text-purple-400" />
                       </div>
                       <div className="flex flex-col items-end">
                          <span className="text-[10px] font-mono text-slate-500">{cand.id}</span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full mt-1 border ${
                            cand.status === 'VALIDATED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {cand.status}
                          </span>
                       </div>
                    </div>

                    <div className="space-y-3 flex-1">
                       <h3 className="text-sm font-bold text-white uppercase tracking-tight">{cand.innovation}</h3>
                       <p className="text-[11px] text-slate-400 leading-relaxed italic border-l-2 border-slate-800 pl-3">
                          {cand.rationale}
                       </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800">
                       <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 font-bold uppercase">Weight Target</span>
                          <span className="text-xs font-black text-white">{cand.metrics.weight}</span>
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 font-bold uppercase">Stiffness</span>
                          <span className="text-xs font-black text-white">{cand.metrics.stiff}</span>
                       </div>
                    </div>

                    <button className="w-full py-3 bg-slate-800 group-hover:bg-purple-600/20 text-slate-300 group-hover:text-purple-200 text-[10px] font-black rounded-xl border border-slate-700 group-hover:border-purple-500/30 transition-all uppercase tracking-widest">
                       Inspect Candidate Geometry
                    </button>
                 </div>
              ))}
           </div>
           
           <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between px-6">
              <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                 <ShieldCheck className="w-4 h-4 text-emerald-500" /> Verification Confidence
              </div>
              <div className="flex gap-2">
                 <span className="text-xs font-mono text-emerald-400 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/20">V10_PARITY: 99.2%</span>
                 <span className="text-xs font-mono text-emerald-400 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/20">FEA_SOLVED: YES</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
