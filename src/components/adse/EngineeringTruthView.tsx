import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  GitBranch, 
  Layers, 
  CheckCircle, 
  AlertCircle, 
  Lock, 
  Key, 
  FileCode, 
  Cpu,
  RefreshCw
} from 'lucide-react';
import { 
  ADSEWorkbenchBridge, 
  EntityTruthProfile 
} from '../../engine/adse/workbench/ADSEWorkbenchBridge';

interface Props {
  canonicalId?: string;
  onRefresh?: () => void;
}

export const EngineeringTruthView: React.FC<Props> = ({ 
  canonicalId = 'COMM-SYS-AVIONICS-P9',
  onRefresh
}) => {
  const bridge = ADSEWorkbenchBridge.getInstance();
  const [profile, setProfile] = useState<EntityTruthProfile | null>(() => {
    return canonicalId ? bridge.resolveEntityTruth(canonicalId) : null;
  });

  const loadProfile = () => {
    if (canonicalId) {
      const p = bridge.resolveEntityTruth(canonicalId);
      setProfile(p);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [canonicalId]);

  if (!profile) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs font-sans">
        Select an engineering entity to inspect its canonical truth profile.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 p-6 overflow-y-auto gap-6 font-sans">
      {/* Identity & Authority Header */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-extrabold text-white">{profile.canonicalId}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 uppercase font-bold">
                {profile.entityType}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{profile.displayName}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-500 uppercase">Authority State</span>
            <span className="text-blue-400 font-bold">{profile.authorityState}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-500 uppercase">Lifecycle</span>
            <span className="text-emerald-400 font-bold">{profile.lifecycleState}</span>
          </div>
        </div>
      </div>

      {/* Revision & Configuration Governance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
          <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Revision & Baseline Binding</span>
          <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
            <span className="text-slate-400">Canonical Revision:</span>
            <span className="font-mono text-emerald-400 font-bold">{profile.revisionId}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
            <span className="text-slate-400">Configuration Baseline:</span>
            <span className="font-mono text-cyan-400 font-bold">{profile.configurationId}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
          <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Cryptographic Provenance</span>
          <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
            <span className="text-slate-400">Created By:</span>
            <span className="font-mono text-slate-200">{profile.provenance.createdBy}</span>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800 flex flex-col gap-0.5">
            <span className="text-[9px] text-slate-500 uppercase font-mono">Origin Hash</span>
            <span className="font-mono text-[10px] text-slate-400 truncate">{profile.provenance.originHash}</span>
          </div>
        </div>
      </div>

      {/* Verification & Truth Gates Status */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Authoritative Verification Gates & Evidence
          </span>
          <span className="text-[10px] font-mono text-emerald-400">
            {profile.verifications.filter(v => v.verdict === 'PASS').length} / {profile.verifications.length} Passing
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {profile.verifications.length === 0 ? (
            <div className="p-3 bg-slate-950 rounded-lg text-xs text-slate-500">
              No formal verification intents evaluated yet for this entity.
            </div>
          ) : (
            profile.verifications.map(v => (
              <div key={v.gateName} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {v.verdict === 'PASS' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="font-mono font-bold text-white">{v.gateName}</span>
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
    </div>
  );
};
