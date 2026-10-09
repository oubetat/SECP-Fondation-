import React, { useState, useEffect } from 'react';
import { 
  Gauge, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  FileText, 
  Activity, 
  Layers, 
  RefreshCw, 
  Lock,
  GitBranch
} from 'lucide-react';
import { 
  ADSEWorkbenchBridge, 
  EngineeringMetricsSnapshot 
} from '../../engine/adse/workbench/ADSEWorkbenchBridge';

interface Props {
  configurationId?: string;
}

export const EngineeringStateDashboard: React.FC<Props> = ({ 
  configurationId = 'CONF-BASELINE' 
}) => {
  const bridge = ADSEWorkbenchBridge.getInstance();
  const [snapshot, setSnapshot] = useState<EngineeringMetricsSnapshot | null>(() => {
    try {
      return bridge.computeEngineeringMetrics(configurationId);
    } catch {
      return null;
    }
  });
  const [isRecomputing, setIsRecomputing] = useState(false);

  const recomputeMetrics = () => {
    setIsRecomputing(true);
    try {
      const snap = bridge.computeEngineeringMetrics(configurationId);
      setSnapshot(snap);
    } finally {
      setIsRecomputing(false);
    }
  };

  useEffect(() => {
    recomputeMetrics();
  }, [configurationId]);

  if (!snapshot) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs font-sans">
        Calculating authoritative engineering metrics...
      </div>
    );
  }

  const { metrics } = snapshot;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 p-6 overflow-y-auto gap-6 font-sans">
      {/* Header & Recompute Action */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-600/10 border border-emerald-500/30 text-emerald-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Engineering State & Truth Dashboard</div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">Configuration: {snapshot.configurationId} | Revision: {snapshot.revisionId}</div>
          </div>
        </div>

        <button
          onClick={recomputeMetrics}
          disabled={isRecomputing}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRecomputing ? 'animate-spin' : ''}`} />
          Recompute Metrics
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Verification Coverage */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Verification Coverage</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{metrics.verificationCoveragePercent}%</div>
          <div className="text-[10px] text-slate-400 font-mono">
            {metrics.passedVerificationGates} / {metrics.totalVerificationGates} Gates Verified
          </div>
        </div>

        {/* Requirements Allocation */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Requirements Allocation</span>
            <FileText className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{metrics.requirementCoveragePercent}%</div>
          <div className="text-[10px] text-slate-400 font-mono">
            {metrics.verifiedRequirements} / {metrics.totalRequirements} Verified
          </div>
        </div>

        {/* Cross-Domain Coupling */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Coupling Density</span>
            <Layers className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{metrics.crossDomainCouplingDensity}x</div>
          <div className="text-[10px] text-slate-400 font-mono">Edges-to-Node Ratio</div>
        </div>

        {/* Engineering Truth Ratio */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Truth Ratio</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">{metrics.engineeringTruthRatio * 100}%</div>
          <div className="text-[10px] text-emerald-400/80 font-mono">Zero Invalidated Unresolved</div>
        </div>
      </div>

      {/* Metric Cryptographic Provenance Details */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Metric Calculation Provenance
        </span>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Provenance Hash (SHA-256):</span>
          <span className="text-cyan-400 truncate max-w-md">{snapshot.provenanceHash}</span>
        </div>
        <div className="text-[10px] text-slate-500 flex items-center justify-between font-mono">
          <span>Source Entities Audited: {snapshot.sourceEntitiesCount}</span>
          <span>Calculated At: {snapshot.timestamp}</span>
        </div>
      </div>
    </div>
  );
};
