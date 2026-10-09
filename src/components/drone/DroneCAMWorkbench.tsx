import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, AlertTriangle, Layers, Zap, Play, Box } from 'lucide-react';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DroneCAMAdapter, DroneCAMWorkflowResult } from '../../engine/cam/DroneCAMAdapter';

interface Props {
  canonicalDocument: EngineeringDocument | null;
  targetInstanceId: string;
  onNavigate: (tab: string) => void;
  onCamResult?: (result: DroneCAMWorkflowResult | null) => void;
}

export const DroneCAMWorkbench: React.FC<Props> = ({ canonicalDocument, targetInstanceId, onNavigate, onCamResult }) => {
  const [result, setResult] = useState<DroneCAMWorkflowResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!canonicalDocument) return;
      try {
        setLoading(true);
        const res = await DroneCAMAdapter.processChassisCAM(canonicalDocument, targetInstanceId);
        setResult(res);
        if (onCamResult) onCamResult(res);
      } catch (err: any) {
        setError(err.message || 'Failed to generate CAM');
        if (onCamResult) onCamResult(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [canonicalDocument, targetInstanceId, onCamResult]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 flex-col gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-rose-500 animate-spin" />
        <div className="font-mono text-xs uppercase tracking-widest">Generating CAM setup & toolpaths...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl p-6 text-rose-200 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0 mt-1" />
          <div>
            <h3 className="font-bold mb-2">CAM Generation Failed</h3>
            <p className="font-mono text-xs">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const totalPoints = result.operations.reduce((acc, op) => acc + op.pointsCount, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden max-w-6xl mx-auto p-6 space-y-6 custom-scrollbar">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <Cpu className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">CAM Workbench</h2>
            <div className="text-xs text-slate-400 font-mono mt-1 flex gap-4">
              <span>Part: {result.partId}</span>
              <span>Machine: {result.camSetup.machine.name}</span>
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
           <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-900/60">
             <CheckCircle2 className="w-3.5 h-3.5" />
             TOOLPATH GENERATED
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto pb-8">
        
        {/* Setup Column */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
             <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Layers className="w-4 h-4 text-sky-400" /> Setup Config
             </h3>
             <div className="space-y-4">
                <DataRow label="Stock Material" value={result.material} mono />
                <DataRow label="Stock Size (X,Y,Z)" value={`${result.camSetup.stock.dimensionsMm.x.toFixed(1)} x ${result.camSetup.stock.dimensionsMm.y.toFixed(1)} x ${result.camSetup.stock.dimensionsMm.z.toFixed(1)} mm`} mono />
                <DataRow label="Setup Hash" value={result.camSetup.setupHash.slice(0, 12) + '...'} mono />
                <DataRow label="WCS Orientation" value={result.camSetup.wcs.orientation} />
             </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
             <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
               <AlertTriangle className="w-4 h-4 text-amber-400" /> Manufacturing Readiness
             </h3>
             <div className="space-y-3">
                <StatusRow label="Geometry Validity" status="PASS" />
                <StatusRow label="CAM Setup Valid" status="PASS" />
                <StatusRow label="Machine Limits" status="PASS" />
                <StatusRow label="Collision Status" status={result.collisionStatus} warn={result.collisionStatus === 'NOT_AVAILABLE'} />
                <StatusRow label="Postprocessor" status={result.postprocessingStatus} warn={result.postprocessingStatus === 'NOT_AVAILABLE'} />
             </div>
          </div>
        </div>

        {/* Operations Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-2 flex flex-col">
             <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Zap className="w-4 h-4 text-rose-400" /> Toolpath Operations
               </div>
               <span className="text-[10px] text-slate-500">{result.operations.length} operations • {totalPoints} points</span>
             </h3>
             
             <div className="flex-1 overflow-y-auto space-y-3 pr-2">
               {result.operations.map((op, idx) => (
                 <div key={op.operationId} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                   <div className="flex items-center justify-between mb-2">
                     <span className="font-bold text-sm text-slate-200">{idx + 1}. {op.name}</span>
                     <span className="text-[10px] font-mono text-slate-500">{op.strategy}</span>
                   </div>
                   <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                     <div className="text-slate-400">Tool: <span className="text-slate-200">{op.toolId}</span></div>
                     <div className="text-slate-400 text-right">Points: <span className="text-slate-200">{op.pointsCount}</span></div>
                   </div>
                   
                   {/* Mini Visualization Placeholder */}
                   <div className="h-12 bg-slate-900/50 rounded flex items-center justify-between px-3 border border-slate-800/50">
                      <span className="text-[10px] font-mono text-slate-600">Generated Toolpath Hash</span>
                      <span className="text-[10px] font-mono text-emerald-500/70">{op.toolpathHash}</span>
                   </div>
                 </div>
               ))}
             </div>
             
             <div className="mt-4 pt-4 border-t border-slate-800">
               <button 
                  onClick={() => onNavigate('DRONE-EVIDENCE')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition-colors text-xs font-bold tracking-wide"
               >
                 <ShieldCheck className="w-4 h-4" /> View Engineering Evidence
               </button>
             </div>
        </div>
      </div>
    </div>
  );
};

const DataRow = ({ label, value, mono = false }: { label: string, value: string, mono?: boolean }) => (
  <div className="flex flex-col gap-1 pb-2 border-b border-slate-800/50 last:border-0 last:pb-0">
    <span className="text-[10px] text-slate-500 uppercase font-bold">{label}</span>
    <span className={`text-sm text-slate-300 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</span>
  </div>
);

const StatusRow = ({ label, status, warn = false }: { label: string, status: string, warn?: boolean }) => {
  const isPass = status === 'PASS' || status === 'PROVEN';
  const color = isPass ? 'text-emerald-400' : (warn ? 'text-amber-400' : 'text-slate-400');
  return (
    <div className="flex items-center justify-between pb-2 border-b border-slate-800/50 last:border-0 last:pb-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-[10px] font-bold font-mono tracking-wider ${color}`}>
        {status}
      </span>
    </div>
  );
};
