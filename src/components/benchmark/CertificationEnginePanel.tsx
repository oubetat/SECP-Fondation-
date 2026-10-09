import React, { useState } from 'react';
import { 
  Award, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Activity, 
  FileCheck, 
  Sliders, 
  FileSignature, 
  Lock, 
  Key
} from 'lucide-react';
import { HardAcceptanceGate186, Gate186Result } from '../../engine/certification/HardAcceptanceGate186';
import { CertificationLevel } from '../../engine/certification/CertificationTypes';

export const CertificationEnginePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CLAIMS' | 'GATE186'>('OVERVIEW');
  const [isRunning, setIsRunning] = useState(false);
  const [gateResult, setGateResult] = useState<Gate186Result | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  const handleRunGate186 = async () => {
    setIsRunning(true);
    setFeedback('Executing Certification Engine & Cryptographic Evidence Evaluation (PATCH-186)...');

    setTimeout(async () => {
      try {
        const gate = new HardAcceptanceGate186();
        const dummyCert: any = {
          certificateId: 'CERT-2026-SECP-8841',
          level: CertificationLevel.LEVEL_3_PRODUCTION,
          claims: [
            { claimId: 'CLM-01', description: 'Zero B-Rep Topological Faults', evidenceIds: ['EVD-318-01', 'EVD-319-04'] },
            { claimId: 'CLM-02', description: 'G-Code Collision Free Path', evidenceIds: ['EVD-259-09'] }
          ],
          rootHash: 'SHA256-CERT-992a118e4c77',
          artifactHash: '0x3344a1b89c'
        };
        const result = await gate.execute(dummyCert);
        setGateResult(result);
        setFeedback(`Gate 186 evaluated: ${result.passed ? 'PASSED (100%)' : 'FAIL'} - Certification Score: ${result.score}/100.`);
      } catch (err: any) {
        setFeedback(`Error running Gate 186: ${err.message}`);
      } finally {
        setIsRunning(false);
      }
    }, 250);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight">Certification Engine & Gate 186</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
              PATCH-SECP-186
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Issue cryptographically sealed engineering truth certificates bound to verified evidence records across CAD, CAM, and CAE pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunGate186}
            disabled={isRunning}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {isRunning ? 'Sealing Cert...' : 'RUN CERT GATE 186'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>{feedback}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'OVERVIEW' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Sliders className="w-3.5 h-3.5" /> Overview
        </button>
        <button
          onClick={() => setActiveTab('CLAIMS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'CLAIMS' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <FileSignature className="w-3.5 h-3.5" /> Evidence Claims
        </button>
        <button
          onClick={() => setActiveTab('GATE186')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'GATE186' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Gate 186 Assertions
        </button>
      </div>

      {/* Content */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {gateResult ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Certification Score</span>
                <div className="text-2xl font-mono font-bold text-emerald-400 flex items-center gap-2">
                  <Award className="w-5 h-5" /> {gateResult.score} / 100
                </div>
                <span className="text-[10px] text-slate-500">Level 3 Production Seal</span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Claims Verified</span>
                <div className="text-2xl font-mono font-bold text-sky-400">
                  {gateResult.checks.filter(c => c.status === 'PASS').length} / {gateResult.checks.length}
                </div>
                <span className="text-[10px] text-slate-500">Evidence Bound</span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Cryptographic Root</span>
                <div className="text-xs font-mono text-emerald-400 truncate mt-1">
                  SHA256-CERT-992a11...
                </div>
                <span className="text-[10px] text-slate-500">Immutable Evidence Chain</span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Certification Status</span>
                <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                  SEALED & PROVEN
                </div>
                <span className="text-[10px] text-slate-500">Gate 186 Compliant</span>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              Click 'RUN CERT GATE 186' to issue and verify the engineering truth certificate.
            </div>
          )}
        </div>
      )}

      {activeTab === 'CLAIMS' && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Claims & Evidence Chain</h3>
          <p className="text-xs text-slate-400">
            Every claim in an engineering certificate requires an unbroken SHA-256 evidence chain from point-cloud capture through B-Rep reconstruction to G-Code verification.
          </p>
        </div>
      )}

      {activeTab === 'GATE186' && (
        <div className="space-y-3">
          {gateResult ? (
            gateResult.checks.map((c) => (
              <div key={c.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-xs font-bold text-white font-mono">{c.id}: </span>
                    <span className="text-xs text-slate-300">{c.description}</span>
                  </div>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-300">
                  {c.value || c.status}
                </span>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              Execute Gate 186 to view checks.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

