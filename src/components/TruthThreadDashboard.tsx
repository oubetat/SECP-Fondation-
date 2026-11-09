/**
 * SECP-CAD-TRUTH-PATCH-005 — Engineering Truth Thread Dashboard
 *
 * Visualizes the non-repudiable lineage between CAD, Mesh, and CFD.
 * Displays "STALE" warnings if geometry mutations have occurred without regeneration.
 */

import React, { useMemo } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Cpu, Activity, RefreshCw, Layers } from 'lucide-react';
import { DigitalThreadState } from '../engine/thread/DigitalThreadEngine';

interface TruthThreadDashboardProps {
  state: DigitalThreadState;
  onRegenerateMesh?: () => void;
  onRecomputeCfd?: () => void;
  onMutateGeometry?: () => void;
  onRelease?: () => void;
  releaseResult?: { success: boolean; certificateId?: string; errors?: string[] } | null;
}

export const TruthThreadDashboard: React.FC<TruthThreadDashboardProps> = ({
  state,
  onRegenerateMesh,
  onRecomputeCfd,
  onMutateGeometry,
  onRelease,
  releaseResult
}) => {
  const statusColor = useMemo(() => {
    switch (state.digitalThreadStatus) {
      case 'CURRENT': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'STALE': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'INVALID': return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
      default: return 'text-slate-400 border-slate-700 bg-slate-800/50';
    }
  }, [state.digitalThreadStatus]);

  const meshStatusColor = state.meshSet.status === 'CURRENT' ? 'text-emerald-400' : 'text-amber-400';
  const cfdStatusColor = state.cfdResult.status === 'CURRENT' ? 'text-emerald-400' : 'text-amber-400';

  return (
    <div className="absolute top-4 right-4 z-50 w-80 pointer-events-auto">
      <div className={`backdrop-blur-md border rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ${statusColor}`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-inherit flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-bold tracking-tight uppercase">Engineering Truth Thread</span>
          </div>
          <span className="text-[10px] font-mono opacity-70">PATCH-005</span>
        </div>

        {/* Status indicator */}
        <div className="px-4 py-3 space-y-4">
          {releaseResult && (
            <div className={`p-3 rounded-lg border text-[11px] font-mono ${releaseResult.success ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/20 border-rose-500/30 text-rose-300'}`}>
              <div className="font-bold mb-1">{releaseResult.success ? 'RELEASE SUCCESSFUL' : 'RELEASE DENIED'}</div>
              {releaseResult.success ? (
                <div>Cert ID: {releaseResult.certificateId}</div>
              ) : (
                <ul className="list-disc ml-4 space-y-1">
                  {releaseResult.errors?.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs opacity-80 font-medium">Thread Status</span>
            <div className="flex items-center gap-1.5 font-bold text-xs">
              {state.digitalThreadStatus === 'CURRENT' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4 animate-pulse" />
              )}
              {state.digitalThreadStatus}
            </div>
          </div>

          {/* Progress Chain */}
          <div className="space-y-3">
            {/* CAD Node */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase opacity-50 font-bold tracking-wider">CAD Geometry</div>
                <div className="text-xs font-mono truncate text-white">{state.cadEntity.name}</div>
                <div className="text-[9px] font-mono opacity-50 truncate">Hash: {state.cadEntity.geometryHash?.substring(0, 12)}...</div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="h-4 w-px bg-slate-700 ml-4"></div>

            {/* Mesh Node */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-300 shrink-0`}>
                <Cpu className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase opacity-50 font-bold tracking-wider">Physics Mesh</div>
                <div className={`text-xs font-mono truncate ${meshStatusColor}`}>{state.meshSet.status}</div>
                <div className="text-[9px] font-mono opacity-50 truncate">Linked to: {state.meshSet.modelRevisionHash?.substring(0, 8)}...</div>
              </div>
              {state.meshSet.status === 'CURRENT' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <button 
                  onClick={onRegenerateMesh}
                  className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 transition"
                  title="Regenerate Mesh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="h-4 w-px bg-slate-700 ml-4"></div>

            {/* CFD Node */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase opacity-50 font-bold tracking-wider">CFD Result</div>
                <div className={`text-xs font-mono truncate ${cfdStatusColor}`}>{state.cfdResult.status || 'UNVERIFIED'}</div>
                <div className="text-[9px] font-mono opacity-50 truncate">Valid: {state.cfdResult.status === 'CURRENT' ? 'YES' : 'NO'}</div>
              </div>
              {state.cfdResult.status === 'CURRENT' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <button 
                  onClick={onRecomputeCfd}
                  className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 transition"
                  title="Recompute CFD"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col gap-2">
            {state.digitalThreadStatus === 'STALE' && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 text-[10px] text-amber-300 leading-tight">
                Geometry changed. Downstream artifacts are now invalid. Full re-qualification required.
              </div>
            )}
            
            <button 
              onClick={onMutateGeometry}
              className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Mutate CAD (Test Invalidation)
            </button>

            <button 
              onClick={onRelease}
              className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Release to Production
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
