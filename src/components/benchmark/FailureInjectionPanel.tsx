import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Play, 
  RefreshCw, 
  Activity, 
  Flame, 
  Layers, 
  Cpu, 
  Bug, 
  Zap, 
  FileCheck2, 
  Sliders
} from 'lucide-react';
import { HardAcceptanceGate184 } from '../../engine/chaos/HardAcceptanceGate184';
import { Gate184Report } from '../../engine/chaos/ChaosTypes';

export const FailureInjectionPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CAMPAIGNS' | 'GATE184'>('OVERVIEW');
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<Gate184Report | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  const handleRunGate184 = () => {
    setIsRunning(true);
    setFeedback('Running Industrial Failure Injection & Chaos Campaign Battery (PATCH-184)...');

    setTimeout(() => {
      try {
        const result = HardAcceptanceGate184.runGateVerification();
        setReport(result);
        setFeedback(`Gate 184 evaluated: ${result.allCriteriaPassed ? 'PASSED (100%)' : 'FAILED'} across ${result.campaignSummaries.length} campaigns. Replay Determinism: ${result.deterministicReplayVerified ? 'VERIFIED' : 'UNVERIFIED'}.`);
      } catch (err: any) {
        setFeedback(`Error running Gate 184: ${err.message}`);
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
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            <h2 className="text-xl font-bold tracking-tight">Industrial Failure Injection & Gate 184</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-rose-950 text-rose-400 border border-rose-800 rounded-full">
              PATCH-SECP-184
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simulate hardware faults, numerical singularity, corrupt B-Rep topology, IEEE-754 drift, and verify zero-loss recovery.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunGate184}
            disabled={isRunning}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
            {isRunning ? 'Injecting Faults...' : 'RUN CHAOS GATE 184'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400 animate-pulse" />
            <span>{feedback}</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'OVERVIEW' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Sliders className="w-3.5 h-3.5" /> Summary Dashboard
        </button>
        <button
          onClick={() => setActiveTab('CAMPAIGNS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'CAMPAIGNS' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Bug className="w-3.5 h-3.5" /> Chaos Campaigns
        </button>
        <button
          onClick={() => setActiveTab('GATE184')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'GATE184' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Gate 184 Assertions
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {report ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Total Faults Injected</span>
                <div className="text-2xl font-mono font-bold text-rose-400 flex items-center gap-2">
                  <Bug className="w-5 h-5" /> {report.totalFaultsInjected}
                </div>
                <span className="text-[10px] text-slate-500">100% Contained & Isolated</span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Detection Ratio</span>
                <div className="text-2xl font-mono font-bold text-emerald-400">
                  {report.totalFaultsInjected > 0 ? ((report.totalFaultsDetected / report.totalFaultsInjected) * 100).toFixed(1) : 100}%
                </div>
                <span className="text-[10px] text-slate-500">{report.totalFaultsDetected} Detected</span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Replay Determinism</span>
                <div className="text-lg font-mono font-bold text-sky-400 mt-1">
                  {report.deterministicReplayVerified ? 'VERIFIED' : 'FAILED'}
                </div>
                <span className="text-[10px] text-slate-500">Bit-Exact Seed Playback</span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Hard Gate 184 Verdict</span>
                <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                  {report.overallVerdict}
                </div>
                <span className="text-[10px] text-slate-500">SECP OS Resilience Seal</span>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              Click 'RUN CHAOS GATE 184' to execute industrial chaos injection campaigns across CAD, CAM, CFD, and FEM.
            </div>
          )}
        </div>
      )}

      {activeTab === 'CAMPAIGNS' && (
        <div className="space-y-4">
          {report ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.campaignSummaries.map((c) => (
                <div key={c.campaignId} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-rose-400 font-mono">{c.campaignId}</span>
                    <span className="text-[10px] font-mono bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-300">
                      {c.domain}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>Injected: <span className="font-mono text-amber-400">{c.injected}</span></div>
                    <div>Detected: <span className="font-mono text-emerald-400">{c.detected}</span></div>
                    <div>Contained: <span className="font-mono text-sky-400">{c.contained}</span></div>
                    <div>Verdict: <span className="font-mono text-emerald-400">{c.verdict}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              Run chaos gate to view individual campaign breakdowns.
            </div>
          )}
        </div>
      )}

      {activeTab === 'GATE184' && (
        <div className="space-y-4">
          {report ? (
            <div className="grid grid-cols-1 gap-2.5">
              {report.criteria.map((cr) => (
                <div key={cr.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono">{cr.id}</span>
                      <span className="text-xs font-semibold text-slate-200">{cr.description}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{cr.details}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              Execute Gate 184 to view criteria assertions.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

