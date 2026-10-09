import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  GitMerge,
  FileCheck,
  Key,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  User,
  Shield,
  Fingerprint
} from 'lucide-react';
import { EngineeringDocument } from '../engine/cad-kernel/document/CADDocument';
import { ProjectMetadata } from '../engine/session/ProjectSession';
import { AccessControlPanel } from './AccessControlPanel';
import { ProvenancePanel } from './ProvenancePanel';
import { DigitalThreadPanel } from './DigitalThreadPanel';
import { ApprovalWorkflowPanel } from './ApprovalWorkflowPanel';

interface CrossCuttingGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProjectMetadata?: ProjectMetadata | null;
  canonicalDocument?: EngineeringDocument | null;
  initialTab?: 'ACCESS' | 'PROVENANCE' | 'DIGITAL_THREAD' | 'APPROVALS';
}

export const CrossCuttingGovernanceModal: React.FC<CrossCuttingGovernanceModalProps> = ({
  isOpen,
  onClose,
  activeProjectMetadata,
  canonicalDocument,
  initialTab = 'PROVENANCE'
}) => {
  const [activeTab, setActiveTab] = useState<'ACCESS' | 'PROVENANCE' | 'DIGITAL_THREAD' | 'APPROVALS'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  Cross-Cutting Governance
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {activeProjectMetadata?.projectNumber || 'PRJ-PROD'} • Doc: {canonicalDocument?.documentId || 'DOC_ACTIVE'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                Engineering Authority, Access &amp; Cryptographic Provenance
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Close Governance Center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-nav Tabs */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('PROVENANCE')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'PROVENANCE'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            <span>Provenance Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('ACCESS')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'ACCESS'
                ? 'bg-teal-600/20 text-teal-300 border border-teal-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Lock className="w-4 h-4 text-teal-400" />
            <span>Access Control &amp; RBAC</span>
          </button>

          <button
            onClick={() => setActiveTab('DIGITAL_THREAD')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'DIGITAL_THREAD'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <GitMerge className="w-4 h-4 text-indigo-400" />
            <span>Digital Thread Lineage</span>
          </button>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'APPROVALS'
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <FileCheck className="w-4 h-4 text-violet-400" />
            <span>Formal Approval Workflow</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/90">
          {activeTab === 'PROVENANCE' && (
            <div className="space-y-4">
              <ProvenancePanel />
            </div>
          )}

          {activeTab === 'ACCESS' && (
            <div className="space-y-4">
              <AccessControlPanel />
            </div>
          )}

          {activeTab === 'DIGITAL_THREAD' && (
            <div className="space-y-4">
              <DigitalThreadPanel />
            </div>
          )}

          {activeTab === 'APPROVALS' && (
            <div className="space-y-4">
              <ApprovalWorkflowPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
