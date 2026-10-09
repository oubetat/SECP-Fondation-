import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileCheck2, 
  Activity, 
  Sparkles, 
  Layers, 
  Check, 
  Sliders, 
  Lock, 
  Plus, 
  RefreshCw, 
  Award, 
  Scale 
} from 'lucide-react';
import { AIDesignReviewService } from '../engine/engineering_ai/design_review/AIDesignReviewService';
import { 
  EngineeringDesignReview, 
  DesignReviewFinding, 
  WaiverRecord, 
  EngineeringDesignReviewReport 
} from '../engine/engineering_ai/design_review/AIDesignReviewTypes312';
import { HardAcceptanceGate312, GateTestResult } from '../engine/engineering_ai/design_review/HardAcceptanceGate312';

export const AIDesignReviewWorkbenchPanel: React.FC = () => {
  const [service] = useState(() => new AIDesignReviewService());
  const [activeTab, setActiveTab] = useState<'REVIEWS' | 'FINDINGS' | 'WAIVERS' | 'GATE312'>('REVIEWS');

  const [activeReviewId, setActiveReviewId] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [gateResults, setGateResults] = useState<GateTestResult[] | null>(null);

  const [tick, setTick] = useState<number>(0);
  const refresh = () => setTick(t => t + 1);

  const reviews = useMemo(() => service.getAllReviews(), [service, tick]);
  const activeReview = useMemo(() => reviews.find(r => r.reviewId === activeReviewId) || (reviews.length > 0 ? reviews[0] : null), [reviews, activeReviewId]);

  const handleLoadDemoReview = () => {
    const demo = service.generateDesignReview({
      partId: 'PART-AEROSPACE-MANIFOLD-03',
      revision: 'C',
      reviewer: 'AI_LEAD_AUDITOR',
      standards: ['ASME Y14.5-2018', 'ISO 2768-mK', 'MIL-STD-1522A'],
      findings: [
        {
          findingId: 'FND-001',
          ruleCategory: 'GEOMETRY_TOPOLOGY',
          severity: 'HIGH',
          title: 'Non-manifold Edge Topology Detected',
          description: 'Edge E-1042 shares 3 incident surfaces causing topological ambiguity for CAM 5-axis generation.',
          location: { x: 12.4, y: 55.0, z: -10.2 },
          recommendedAction: 'Apply 0.5mm split fillet or separate feature boolean.'
        },
        {
          findingId: 'FND-002',
          ruleCategory: 'DFM_MACHINING',
          severity: 'MEDIUM',
          title: 'Deep Cavity Aspect Ratio Exceeds 8:1',
          description: 'Internal bore depth is 65mm with 7mm diameter, causing excessive endmill deflection and chatter risk.',
          location: { x: 0.0, y: 0.0, z: 22.5 },
          recommendedAction: 'Add relief undercut or specify EDM wire process.'
        },
        {
          findingId: 'FND-003',
          ruleCategory: 'GDT_TOLERANCES',
          severity: 'LOW',
          title: 'Missing Datum Reference Frame on Secondary Pattern',
          description: '4x M4 bolt circle lacks explicit position tolerance back to Datum [A|B|C].',
          location: { x: 30.0, y: 30.0, z: 0.0 },
          recommendedAction: 'Add true position callout ⌀0.15 [A|B|C].'
        }
      ]
    });

    setActiveReviewId(demo.reviewId);
    setFeedback(`Generated automated AI design review ${demo.reviewId} for ${demo.partId}.`);
    refresh();
  };

  const handleGrantWaiver = (findingId: string) => {
    service.grantWaiver({
      reviewId: activeReview?.reviewId || '',
      findingId,
      approvedBy: 'CHIEF_ENGINEER',
      justification: 'Waiver granted for prototype testing batch. Tool chatter dampened via custom carbide tooling.'
    });
    setFeedback(`Granted engineering waiver for ${findingId}.`);
    refresh();
  };

  const handleRunGate312 = () => {
    const results = HardAcceptanceGate312.evaluate();
    setGateResults(results);
    setActiveTab('GATE312');
    const passed = results.every(r => r.passed);
    setFeedback(`Gate 312 evaluated: ${passed ? 'PASSED (100%)' : 'FAILED'} (${results.filter(r => r.passed).length}/${results.length} assertions).`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight">AI Design Review & B-Rep Verification</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
              PATCH-SECP-312
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated CAD design rule checks (DRC), B-Rep topology validation, GD&T tolerance compliance, DFM clearances, and formal sign-offs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunGate312}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            <ShieldCheck className="w-4 h-4" />
            Evaluate Gate 312
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3 bg-slate-950/80 border border-emerald-500/30 rounded-lg text-xs font-mono text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            {feedback}
          </span>
          <button onClick={() => setFeedback('')} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
        </div>
      )}

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-medium space-x-2">
        <button
          onClick={() => setActiveTab('REVIEWS')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'REVIEWS' ? 'border-emerald-500 text-emerald-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" /> Design Reviews ({reviews.length})
        </button>

        <button
          onClick={() => setActiveTab('FINDINGS')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'FINDINGS' ? 'border-amber-500 text-amber-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Findings & Violations
        </button>

        <button
          onClick={() => setActiveTab('GATE312')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'GATE312' ? 'border-indigo-500 text-indigo-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Gate 312 Report
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'REVIEWS' && (
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center space-y-3">
              <FileCheck2 className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No design reviews logged in current project session.</p>
              <button
                onClick={handleLoadDemoReview}
                className="px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Load Demo Design Review Report
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map(r => (
                <div
                  key={r.reviewId}
                  onClick={() => {
                    setActiveReviewId(r.reviewId);
                    setActiveTab('FINDINGS');
                  }}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    r.reviewId === activeReviewId ? 'bg-emerald-950/20 border-emerald-500/50 text-slate-200' : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-200">{r.partId} (Rev {r.revision})</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {r.status}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-slate-400 space-y-1">
                    <div>Review ID: <span className="font-mono text-slate-300">{r.reviewId}</span></div>
                    <div>Audited Standards: <span className="text-slate-300 font-mono">{r.standards.join(', ')}</span></div>
                    <div>Total Findings: <strong className="text-amber-400">{r.findings.length}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'FINDINGS' && activeReview && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
            Findings for {activeReview.partId} ({activeReview.findings.length})
          </h3>

          {activeReview.findings.map(f => (
            <div key={f.findingId} className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.severity === 'HIGH' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                    {f.severity}
                  </span>
                  <span className="font-bold text-slate-200">{f.title}</span>
                </div>
                <span className="text-[10px] text-slate-500">{f.ruleCategory}</span>
              </div>

              <p className="text-slate-300 font-sans">{f.description}</p>
              <div className="text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-800 font-sans">
                💡 <strong className="text-emerald-400">Recommendation:</strong> {f.recommendedAction}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => handleGrantWaiver(f.findingId)}
                  className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 text-xs font-sans"
                >
                  Grant Formal Engineering Waiver
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'GATE312' && gateResults && (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            gateResults.every(r => r.passed) ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center gap-3">
              {gateResults.every(r => r.passed) ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <XCircle className="w-6 h-6 text-rose-400" />}
              <div>
                <h3 className="font-bold text-sm">Hard Acceptance Gate 312: {gateResults.every(r => r.passed) ? 'PASSED (100%)' : 'FAILED'}</h3>
                <p className="text-xs text-slate-400">Verified {gateResults.filter(r => r.passed).length} of {gateResults.length} design review and B-Rep compliance assertions.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {gateResults.map(r => (
              <div key={r.assertionId} className="p-3 bg-slate-950/60 border border-slate-850 rounded-lg flex items-start gap-3 text-xs">
                {r.passed ? <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />}
                <div>
                  <div className="font-semibold text-slate-200">Assertion #{r.assertionId}: {r.description}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{r.details}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
