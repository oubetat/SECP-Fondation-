import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, CheckCircle2, GitMerge, FileCheck } from 'lucide-react';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DroneCAMAdapter, DroneCAMWorkflowResult } from '../../engine/cam/DroneCAMAdapter';

interface Props {
  canonicalDocument: EngineeringDocument | null;
  targetInstanceId: string;
}

export const DroneEvidenceWorkbench: React.FC<Props> = ({ canonicalDocument, targetInstanceId }) => {
  const [result, setResult] = useState<DroneCAMWorkflowResult | null>(null);

  useEffect(() => {
    async function load() {
      if (!canonicalDocument) return;
      try {
        const res = await DroneCAMAdapter.processChassisCAM(canonicalDocument, targetInstanceId);
        setResult(res);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [canonicalDocument, targetInstanceId]);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Loading evidence...
      </div>
    );
  }

  const { evidenceChain } = result;

  return (
    <div className="flex flex-col h-full overflow-hidden max-w-4xl mx-auto p-6 space-y-6 custom-scrollbar">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Cryptographic Manufacturing Evidence</h2>
        <p className="text-slate-400 text-sm max-w-lg">
          The following cryptographic hashes provide immutable provenance linking the generated toolpaths directly back to the canonical engineering document and geometry.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
          <h3 className="font-bold text-slate-200 flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-400" /> Provenance Ledger
          </h3>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950 px-2 py-1 rounded">EVID: {evidenceChain.evidenceId}</span>
        </div>

        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
          
          <EvidenceNode 
            icon={FileCheck} 
            title="Document Reference" 
            hash={evidenceChain.documentId} 
            desc="Originating canonical engineering document." 
          />
          <EvidenceNode 
            icon={GitMerge} 
            title="Geometry Hash" 
            hash={evidenceChain.geometryHash} 
            desc="B-Rep and topological identity of the extracted part." 
          />
          <EvidenceNode 
            icon={CheckCircle2} 
            title="CAM Setup Hash" 
            hash={evidenceChain.setupHash} 
            desc="Machine configuration, WCS, and tool library." 
          />
          <EvidenceNode 
            icon={ShieldCheck} 
            title="Toolpath Hash" 
            hash={evidenceChain.toolpathHash} 
            desc="Final generated G-code/trajectory mathematical identity." 
          />

        </div>
      </div>
    </div>
  );
};

const EvidenceNode = ({ icon: Icon, title, hash, desc }: any) => (
  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
    <div className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-700 bg-slate-900 text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
      <Icon className="w-4 h-4" />
    </div>
    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-lg">
      <div className="font-bold text-slate-200 mb-1">{title}</div>
      <div className="text-[10px] text-slate-500 mb-3">{desc}</div>
      <div className="px-2 py-1.5 bg-slate-900 rounded border border-slate-800/50">
        <code className="text-[10px] text-emerald-400 font-mono break-all">{hash}</code>
      </div>
    </div>
  </div>
);
