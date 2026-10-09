import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  GitBranch 
} from 'lucide-react';
import { 
  ADSEWorkbenchBridge, 
  RequirementTruthProfile 
} from '../../engine/adse/workbench/ADSEWorkbenchBridge';

interface Props {
  onSelectEntity?: (canonicalId: string) => void;
}

export const RequirementsTruthView: React.FC<Props> = ({ onSelectEntity }) => {
  const bridge = ADSEWorkbenchBridge.getInstance();
  const [requirements, setRequirements] = useState<any[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [truthProfile, setTruthProfile] = useState<RequirementTruthProfile | null>(null);

  useEffect(() => {
    const all = bridge.p1.requirements.getAll();
    setRequirements(all);
    if (all.length > 0 && !selectedReqId) {
      setSelectedReqId(all[0].id);
    }
  }, []);

  useEffect(() => {
    if (selectedReqId) {
      const profile = bridge.getRequirementTruth(selectedReqId);
      setTruthProfile(profile);
    } else {
      setTruthProfile(null);
    }
  }, [selectedReqId]);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden font-sans">
      {/* Requirements List Sidebar */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-xs uppercase tracking-wider">System Requirements</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
            {requirements.length} Total
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {requirements.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">No requirements registered in current configuration.</div>
          ) : (
            requirements.map(req => {
              const isSelected = selectedReqId === req.id;
              return (
                <button
                  key={req.id}
                  onClick={() => setSelectedReqId(req.id)}
                  className={`p-2.5 rounded-lg text-left transition border flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm'
                      : 'border-transparent hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyan-400">{req.id}</span>
                    <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-400 uppercase">
                      {req.category || 'FUNCTIONAL'}
                    </span>
                  </div>
                  <div className="text-xs font-medium truncate">{req.title || req.statement}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Requirement Truth Context Profile */}
      <div className="flex-1 bg-slate-950 p-6 overflow-y-auto flex flex-col gap-6">
        {truthProfile ? (
          <>
            {/* Header Identity */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-extrabold text-cyan-400">{truthProfile.requirementId}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                    {truthProfile.category}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-200 mt-1">{truthProfile.title}</div>
                <div className="text-xs text-slate-400 mt-0.5 italic">"{truthProfile.statement}"</div>
              </div>

              <div className="flex flex-col items-end gap-1 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Configuration</span>
                <span className="font-mono text-emerald-400 font-bold">{truthProfile.activeConfigurationId}</span>
              </div>
            </div>

            {/* Multi-Domain Trace Allocations Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Allocated Functions */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5 text-blue-400" /> Allocated Functions
                </div>
                {truthProfile.allocatedFunctions.length === 0 ? (
                  <div className="text-[11px] text-slate-500">None explicitly allocated</div>
                ) : (
                  truthProfile.allocatedFunctions.map(f => (
                    <div key={f.id} className="p-2 rounded bg-slate-950 border border-slate-800 text-xs flex items-center justify-between font-mono">
                      <span>{f.name}</span>
                      <span className="text-[10px] text-slate-500">{f.id}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Allocated Subsystems */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <Cpu className="w-3.5 h-3.5 text-violet-400" /> Allocated Subsystems
                </div>
                {truthProfile.allocatedSubsystems.length === 0 ? (
                  <div className="text-[11px] text-slate-500">None allocated</div>
                ) : (
                  truthProfile.allocatedSubsystems.map(s => (
                    <div key={s.id} className="p-2 rounded bg-slate-950 border border-slate-800 text-xs flex items-center justify-between font-mono">
                      <span>{s.name}</span>
                      <span className="text-[10px] text-slate-500">{s.id}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Verification & Evidence Closure */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verification & Evidence Closure
              </div>

              <div className="flex flex-col gap-2">
                {truthProfile.verificationIntents.length === 0 ? (
                  <div className="text-xs text-slate-500">No active verification gates bound.</div>
                ) : (
                  truthProfile.verificationIntents.map(v => (
                    <div key={v.gateId} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {v.verdict === 'PASS' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-bold font-mono text-white">{v.gateId}</div>
                          {v.evidenceHash && (
                            <div className="text-[10px] text-slate-500 font-mono truncate max-w-sm">
                              Merkle Leaf: {v.evidenceHash}
                            </div>
                          )}
                        </div>
                      </div>

                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        v.verdict === 'PASS' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      }`}>
                        {v.verdict}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            Select a requirement to inspect its complete engineering truth profile.
          </div>
        )}
      </div>
    </div>
  );
};
