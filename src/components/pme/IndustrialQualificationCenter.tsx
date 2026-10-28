import React from 'react';
import { Award, ShieldCheck, AlertCircle, FileCheck2, HardDrive, Printer, CheckCircle2, XCircle } from 'lucide-react';

interface GateStatus {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';
}

const MOCK_GATES: GateStatus[] = [
  { id: 'V12-GATE-01', name: 'Forensic Audit', status: 'PASS' },
  { id: 'V12-GATE-06', name: 'Process Envelope', status: 'PASS' },
  { id: 'V12-GATE-07', name: 'Physical Evidence', status: 'BLOCKED' },
  { id: 'V12-GATE-12', name: 'Truth Thread', status: 'PASS' },
];

export const IndustrialQualificationCenter: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-6 overflow-auto">
      {/* Adjudication Banner */}
      <div className="bg-slate-900 border-2 border-amber-500/30 rounded-3xl p-8 mb-10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
         <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />
         
         <div className="flex items-center gap-6 z-10">
            <div className="p-5 bg-amber-600/20 rounded-2xl border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
               <Award className="w-12 h-12 text-amber-500" />
            </div>
            <div>
               <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Qualification Center</h1>
               <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-bold text-amber-400">SOFTWARE_VERIFIED_ONLY</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                  <span className="text-xs text-slate-500 font-mono">ID: QUAL-DEC-2026-001</span>
               </div>
            </div>
         </div>

         <div className="flex flex-col items-end gap-2 z-10 shrink-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Release Eligibility</span>
            <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 rounded-xl">
               <XCircle className="w-4 h-4 text-rose-500" />
               <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Not Eligible</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Mandatory Gates */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
               <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <ShieldCheck className="w-4 h-4 text-blue-400" /> Mandatory Acceptance Gates
                  </h2>
                  <span className="text-[10px] font-mono text-slate-500">8 OF 10 COMPLETED</span>
               </div>
               <div className="divide-y divide-slate-800">
                  {MOCK_GATES.map(gate => (
                     <div key={gate.id} className="p-6 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
                        <div className="flex items-center gap-4">
                           <div className={`p-2 rounded-lg ${
                              gate.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400' :
                              gate.status === 'BLOCKED' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-slate-800 text-slate-600'
                           }`}>
                              {gate.status === 'PASS' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                           </div>
                           <div>
                              <h3 className="text-sm font-bold text-white uppercase tracking-tight">{gate.name}</h3>
                              <p className="text-[10px] text-slate-500 font-mono">{gate.id}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                              gate.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              gate.status === 'BLOCKED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              'bg-slate-800 text-slate-500 border-slate-700'
                           }`}>
                              {gate.status}
                           </span>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            <div className="p-6 bg-blue-950/10 border border-blue-500/20 rounded-2xl flex gap-6 items-center">
               <HardDrive className="w-8 h-8 text-blue-400 shrink-0" />
               <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white uppercase">Automated Evidence Package</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                     A cryptographically signed evidence bundle is generated for every adjudication cycle. 
                     The bundle includes source hashes, simulation trace files, and manufacturing logs.
                  </p>
               </div>
               <button className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors uppercase whitespace-nowrap">Download Package</button>
            </div>
         </div>

         {/* Findings & Blockers */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
               <div className="flex items-center gap-2 text-xs font-black text-rose-400 uppercase tracking-widest">
                  <AlertCircle className="w-4 h-4" /> Unresolved Blockers
               </div>
               
               <div className="space-y-4">
                  <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-2">
                     <p className="text-[10px] font-bold text-rose-200 uppercase flex items-center gap-2">
                        <Printer className="w-3 h-3" /> MISSING_PHYSICAL_DATA
                     </p>
                     <p className="text-[11px] text-rose-200/60 leading-relaxed italic">
                        Industrial Qualification requires a non-synthetic Ultrasonic CT dataset linked to Specimen #42.
                     </p>
                  </div>
               </div>

               <div className="pt-4 border-t border-slate-800">
                  <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-xl border border-slate-700 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                     <FileCheck2 className="w-4 h-4" /> Request Physical Verification
                  </button>
               </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualification Context</h3>
               <div className="space-y-3">
                  <div className="flex justify-between text-[11px]">
                     <span className="text-slate-500">Geometry</span>
                     <span className="text-slate-300 font-mono">REV-B (Verified)</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                     <span className="text-slate-500">Material</span>
                     <span className="text-slate-300 font-mono">TI-6AL-4V (Verified)</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                     <span className="text-slate-500">Process</span>
                     <span className="text-slate-300 font-mono">LPBF (Verified)</span>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
