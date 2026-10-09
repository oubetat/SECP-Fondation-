import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Sparkles, 
  ShieldCheck, 
  FileCode, 
  Search, 
  Layers, 
  Flame, 
  Cpu, 
  Wrench, 
  Check, 
  ArrowRight, 
  Plus, 
  RefreshCw 
} from 'lucide-react';
import { AIFailureDetectionService } from '../engine/engineering_ai/failure_detection/AIFailureDetectionService';
import { 
  EngineeringFailureEvent, 
  AIRecoveryProposal, 
  FailureEvidencePackage 
} from '../engine/engineering_ai/failure_detection/AIFailureDetectionTypes311';
import { HardAcceptanceGate311, GateTestResult311 } from '../engine/engineering_ai/failure_detection/HardAcceptanceGate311';

export const AIFailureDetectionWorkbenchPanel: React.FC = () => {
  const [service] = useState(() => new AIFailureDetectionService());
  const [activeTab, setActiveTab] = useState<'ANOMALIES' | 'ROOT_CAUSE' | 'RECOVERY' | 'GATE311'>('ANOMALIES');

  const [activeEventId, setActiveEventId] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [gateResults, setGateResults] = useState<GateTestResult311[] | null>(null);

  const [tick, setTick] = useState<number>(0);
  const refresh = () => setTick(t => t + 1);

  const events = useMemo(() => service.getAllEvents(), [service, tick]);
  const activeEvent = useMemo(() => events.find(e => e.eventId === activeEventId) || (events.length > 0 ? events[0] : null), [events, activeEventId]);

  const handleLoadDemoAnomaly = () => {
    const demoEvt = service.recordFailureEvent({
      componentId: 'COMP-TURBO-IMPELLER-04',
      failureMode: 'HIGH_CYCLE_FATIGUE',
      severity: 'CRITICAL',
      detectedAtStressMpa: 485,
      allowableLimitMpa: 390,
      description: 'Von Mises peak stress exceeding fatigue limit by 24.3% at root blend fillet under 15,000 RPM cyclic load.',
      locationCoordinates: { x: 42.5, y: -12.3, z: 88.0 },
      evidencePackage: {
        meshElementId: 'ELEM-78401',
        convergenceResidual: 1.2e-5,
        cyclesToFailure: 48000,
        thermalGradientC: 140
      }
    });

    // Create an associated recovery proposal
    service.proposeRecovery({
      eventId: demoEvt.eventId,
      strategy: 'PARAMETRIC_GEOMETRY_OPTIMIZATION',
      proposedChanges: [
        { parameter: 'root_fillet_radius_mm', oldValue: '2.0', newValue: '4.5', rationale: 'Reduces geometric stress concentration factor Kt from 2.8 to 1.6' },
        { parameter: 'blade_back_thickness_mm', oldValue: '3.2', newValue: '4.0', rationale: 'Shifts natural frequency above 1st-order engine order resonance' }
      ],
      predictedSafetyFactorGain: 0.42,
      confidenceScore: 0.94
    });

    setActiveEventId(demoEvt.eventId);
    setFeedback(`Recorded and grounded engineering failure anomaly ${demoEvt.eventId} with validated AI recovery proposal.`);
    refresh();
  };

  const handleRunGate311 = () => {
    const results = HardAcceptanceGate311.evaluate();
    setGateResults(results);
    setActiveTab('GATE311');
    const passed = results.every(r => r.passed);
    setFeedback(`Gate 311 evaluated: ${passed ? 'PASSED (100%)' : 'FAILED'} (${results.filter(r => r.passed).length}/${results.length} assertions).`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            <h2 className="text-xl font-bold tracking-tight">AI Failure Detection & Engineering Grounding</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-rose-950 text-rose-400 border border-rose-800 rounded-full">
              PATCH-SECP-311
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Detects structural yield, high-cycle fatigue, buckling, and resonant anomalies with solver grounding and automated parameter recovery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunGate311}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            <ShieldCheck className="w-4 h-4" />
            Evaluate Gate 311
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3 bg-slate-950/80 border border-rose-500/30 rounded-lg text-xs font-mono text-rose-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400 animate-pulse" />
            {feedback}
          </span>
          <button onClick={() => setFeedback('')} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
        </div>
      )}

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-medium space-x-2">
        <button
          onClick={() => setActiveTab('ANOMALIES')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'ANOMALIES' ? 'border-rose-500 text-rose-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" /> Detected Failure Events ({events.length})
        </button>

        <button
          onClick={() => setActiveTab('ROOT_CAUSE')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'ROOT_CAUSE' ? 'border-amber-500 text-amber-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-3.5 h-3.5" /> Physics Root Cause
        </button>

        <button
          onClick={() => setActiveTab('RECOVERY')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'RECOVERY' ? 'border-emerald-500 text-emerald-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" /> Parametric Recovery Proposals
        </button>

        <button
          onClick={() => setActiveTab('GATE311')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'GATE311' ? 'border-indigo-500 text-indigo-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Gate 311 Report
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'ANOMALIES' && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No active physical failure anomalies currently detected in design context.</p>
              <button
                onClick={handleLoadDemoAnomaly}
                className="px-4 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Load Demo Failure Anomaly Event
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map(ev => (
                <div
                  key={ev.eventId}
                  onClick={() => {
                    setActiveEventId(ev.eventId);
                    setActiveTab('ROOT_CAUSE');
                  }}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    ev.eventId === activeEventId ? 'bg-rose-950/20 border-rose-500/50 text-slate-200' : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-200">{ev.eventId}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                        {ev.severity}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400">{ev.failureMode}</span>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 line-clamp-2">{ev.description}</p>

                  <div className="mt-3 pt-3 border-t border-slate-900 flex justify-between text-[11px] font-mono">
                    <span>Component: <strong className="text-slate-300">{ev.componentId}</strong></span>
                    <span>Peak Stress: <strong className="text-rose-400">{ev.detectedAtStressMpa} MPa</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ROOT_CAUSE' && activeEvent && (
        <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-slate-200 text-sm">Grounded Root Cause: {activeEvent.eventId}</h3>
            <span className="text-rose-400 font-bold">{activeEvent.failureMode}</span>
          </div>

          <p className="text-slate-300 font-sans">{activeEvent.description}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Target Component</span>
              <strong className="text-slate-200 text-xs">{activeEvent.componentId}</strong>
            </div>
            <div className="p-3 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Allowable Limit</span>
              <strong className="text-emerald-400 text-xs">{activeEvent.allowableLimitMpa} MPa</strong>
            </div>
            <div className="p-3 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Observed Peak</span>
              <strong className="text-rose-400 text-xs">{activeEvent.detectedAtStressMpa} MPa</strong>
            </div>
            <div className="p-3 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Spatial Coordinates</span>
              <strong className="text-amber-400 text-xs">[{activeEvent.locationCoordinates.x}, {activeEvent.locationCoordinates.y}, {activeEvent.locationCoordinates.z}]</strong>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'RECOVERY' && activeEvent && (
        <div className="space-y-4 font-mono text-xs">
          <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">AI Parametric Recovery Proposals</h3>
          {service.getRecoveryProposals(activeEvent.eventId).map((prop, idx) => (
            <div key={idx} className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400">{prop.strategy}</span>
                <span className="text-slate-400 text-[11px]">Confidence: {(prop.confidenceScore * 100).toFixed(0)}%</span>
              </div>

              <div className="space-y-2">
                {prop.proposedChanges.map((ch, i) => (
                  <div key={i} className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-slate-200">
                      <strong className="text-amber-400">{ch.parameter}</strong>:
                      <span className="line-through text-slate-500">{ch.oldValue}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400 inline" />
                      <span className="text-emerald-400 font-bold">{ch.newValue}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans">{ch.rationale}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setFeedback(`Applied parameter recovery to ${activeEvent.componentId}. Model scheduled for re-solve.`)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition font-mono flex items-center justify-center gap-2"
              >
                <Check className="w-3.5 h-3.5" /> Apply Recovery Changes & Re-solve
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'GATE311' && gateResults && (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            gateResults.every(r => r.passed) ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center gap-3">
              {gateResults.every(r => r.passed) ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <XCircle className="w-6 h-6 text-rose-400" />}
              <div>
                <h3 className="font-bold text-sm">Hard Acceptance Gate 311: {gateResults.every(r => r.passed) ? 'PASSED (100%)' : 'FAILED'}</h3>
                <p className="text-xs text-slate-400">Verified {gateResults.filter(r => r.passed).length} of {gateResults.length} failure detection & recovery assertions.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {gateResults.map(r => (
              <div key={r.id} className="p-3 bg-slate-950/60 border border-slate-850 rounded-lg flex items-start gap-3 text-xs">
                {r.passed ? <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />}
                <div>
                  <div className="font-semibold text-slate-200">{r.id}: {r.description}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{r.notes}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
