import React from 'react';
import { Wrench, ShieldCheck, AlertTriangle, FileCode, Printer, Box } from 'lucide-react';

interface Constraint {
  id: string;
  name: string;
  limit: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'WARN';
}

const MOCK_CONSTRAINTS: Constraint[] = [
  { id: 'C-001', name: 'Max Gradient Rate', limit: '5.0 GPa/mm', actual: '3.2 GPa/mm', status: 'PASS' },
  { id: 'C-002', name: 'Min Feature Size', limit: '0.5 mm', actual: '0.8 mm', status: 'PASS' },
  { id: 'C-003', name: 'Max Porosity', limit: '15%', actual: '22%', status: 'FAIL' },
];

export const ManufacturingConstraints: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      <div className="p-6 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-600/20 rounded-lg">
            <Wrench className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white uppercase tracking-wider">Manufacturing Constraints</h1>
            <p className="text-slate-400 text-xs tracking-tight">Process capability validation for programmable materials</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 border border-slate-700 uppercase tracking-widest">
            <Printer className="w-4 h-4" /> EOS M 290 Profile
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-8">
           {/* Summary Stats */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center">
                 <span className="text-[10px] text-slate-500 font-bold uppercase mb-2">Total Checks</span>
                 <span className="text-3xl font-black text-white">12</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center border-t-emerald-500/50">
                 <span className="text-[10px] text-slate-500 font-bold uppercase mb-2">Passed</span>
                 <span className="text-3xl font-black text-emerald-400">11</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center border-t-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.05)]">
                 <span className="text-[10px] text-slate-500 font-bold uppercase mb-2">Violations</span>
                 <span className="text-3xl font-black text-rose-400">1</span>
              </div>
           </div>

           {/* Detailed Table */}
           <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-950/40">
                 <FileCode className="w-4 h-4" /> DFM Rule Execution
              </div>
              <div className="divide-y divide-slate-800">
                 {MOCK_CONSTRAINTS.map(c => (
                   <div key={c.id} className="p-6 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
                      <div className="flex items-center gap-4">
                         <div className={`p-2 rounded-lg ${
                           c.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                         }`}>
                           {c.status === 'PASS' ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                         </div>
                         <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-tight">{c.name}</h3>
                            <p className="text-[10px] text-slate-500 font-mono">RULE_ID: {c.id}</p>
                         </div>
                      </div>
                      <div className="flex gap-12 text-right">
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Limit</span>
                            <span className="text-xs font-mono text-slate-300">{c.limit}</span>
                         </div>
                         <div className="flex flex-col min-w-[80px]">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Actual</span>
                            <span className={`text-xs font-mono font-bold ${
                              c.status === 'PASS' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>{c.actual}</span>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           {/* Critical Violation Callout */}
           <div className="p-6 bg-rose-950/20 border border-rose-500/30 rounded-2xl flex gap-6 items-start shadow-xl shadow-rose-950/10">
              <div className="p-4 bg-rose-500/20 rounded-2xl">
                 <Box className="w-8 h-8 text-rose-400" />
              </div>
              <div className="space-y-2">
                 <h4 className="text-base font-bold text-rose-200">Critical Manufacturability Block (V6-GATE-04)</h4>
                 <p className="text-sm text-rose-200/70 leading-relaxed">
                    The requested density gradient in the <span className="font-mono text-white underline underline-offset-4">Internal_Lattice</span> region 
                    exceeds the laser scanning speed limit for Ti-6Al-4V. Reducing the local gradient rate by 15% is required 
                    to ensure structural integrity during powder bed consolidation.
                 </p>
                 <div className="pt-2 flex gap-4">
                    <button className="text-xs text-rose-400 font-black hover:text-rose-300 transition-colors uppercase tracking-widest underline decoration-2 underline-offset-4">Auto-Correct Field</button>
                    <button className="text-xs text-slate-400 font-bold hover:text-white transition-colors uppercase tracking-widest">Manual Override (Manager Sign-off Required)</button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
