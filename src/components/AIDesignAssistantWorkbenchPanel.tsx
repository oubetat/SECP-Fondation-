/**
 * SECP Industrial OS - PATCH-306 AI Design Assistant Workbench Panel
 * Natural Language Engineering Intent Parsing, Engineering Context Resolver,
 * AI Tool Call Registry Console, Design Proposal Generator & Engineering Diffs,
 * Counterfactual What-If Analysis, Automated Design Reviews, ECO Approval Workflow &
 * 70-Assertion Production Gate Suite.
 */

import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, AlertTriangle, ArrowRight, Bot, CheckCircle2, Cpu, Database, FileCheck, FileText, HelpCircle, Layers, MessageSquare, Play, RefreshCw, RotateCcw, Search, Server, Shield, Sliders, Sparkles, Terminal, Wrench, Zap } from 'lucide-react';
import {
  AIDesignEvidenceRecord,
  AIDesignProposal,
  AIDesignReview,
  AIDesignSession,
  DesignCandidate,
  EngineeringContext,
  StructuredIntent,
  ToolExecutionResult,
} from '../engine/engineering_ai/design_assistant/AIDesignAssistantTypes306';
import { AIDesignAssistantService } from '../engine/engineering_ai/design_assistant/AIDesignAssistantService';
import { EngineeringContextResolver } from '../engine/engineering_ai/design_assistant/EngineeringContextResolver';
import { AIEngineeringToolRegistry } from '../engine/engineering_ai/design_assistant/AIEngineeringToolRegistry';
import { EngineeringKnowledgeService } from '../engine/engineering_ai/design_assistant/EngineeringKnowledgeService';
import { GateResult306, HardAcceptanceGate306 } from '../engine/engineering_ai/design_assistant/HardAcceptanceGate306';

export const AIDesignAssistantWorkbenchPanel: React.FC = () => {
  const [session, setSession] = useState<AIDesignSession | null>(null);
  const [context, setContext] = useState<EngineeringContext | null>(null);
  const [activeTab, setActiveTab] = useState<'intent' | 'proposal' | 'tools' | 'whatif' | 'review' | 'candidates' | 'gate'>('intent');

  // Intent State
  const [naturalLanguageInput, setNaturalLanguageInput] = useState<string>('Reduce mass while maintaining stiffness on 3-axis CNC.');
  const [parsedIntent, setParsedIntent] = useState<StructuredIntent | null>(null);

  // Proposal State
  const [proposal, setProposal] = useState<AIDesignProposal | null>(null);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState<boolean>(false);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [lastEvidence, setLastEvidence] = useState<AIDesignEvidenceRecord | null>(null);

  // What-If Counterfactual State
  const [whatIfParam, setWhatIfParam] = useState<string>('Pocket_Depth');
  const [whatIfDelta, setWhatIfDelta] = useState<number>(2.0);
  const [whatIfResult, setWhatIfResult] = useState<any | null>(null);

  // Review & Candidate State
  const [designReview, setDesignReview] = useState<AIDesignReview | null>(null);
  const [candidates, setCandidates] = useState<DesignCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  // Gate State
  const [gateResult, setGateResult] = useState<GateResult306 | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    initAssistant();
  }, []);

  const initAssistant = async () => {
    addLog('Initializing SECP AI Design Assistant Engine...');
    const service = AIDesignAssistantService.getInstance();
    const newSession = service.createSession({
      projectId: 'PROJ_WING_BRACKET',
      revisionId: 'REV_A',
      userId: 'ENG_USER_01',
    });
    setSession(newSession);

    const resolver = EngineeringContextResolver.getInstance();
    const ctx = await resolver.resolveContext('PROJ_WING_BRACKET', 'REV_A', 'ENG_USER_01');
    setContext(ctx);

    const parsed = service.parseIntent(naturalLanguageInput);
    setParsedIntent(parsed);

    // Initial review & candidates
    setDesignReview(service.runDesignReview('PROJ_WING_BRACKET', 'REV_A'));
    setCandidates(service.exploreDesignSpace('PROJ_WING_BRACKET'));

    addLog(`AI Design Assistant Ready. Active Session: ${newSession.sessionId} (Revision: ${ctx.revisionId})`);
  };

  const handleParseIntent = () => {
    if (!naturalLanguageInput.trim()) return;
    const service = AIDesignAssistantService.getInstance();
    const parsed = service.parseIntent(naturalLanguageInput);
    setParsedIntent(parsed);
    addLog(`Parsed Engineering Intent: ${parsed.primaryObjective} (Status: ${parsed.ambiguityStatus})`);
  };

  const handleGenerateProposal = async () => {
    if (!session || !parsedIntent) return;
    setIsGeneratingProposal(true);
    addLog('Querying SECP Solvers & Knowledge Base to construct AI Design Proposal...');

    const service = AIDesignAssistantService.getInstance();
    const newProposal = await service.createDesignProposal(session, parsedIntent, 'Bracket_Body_v2');

    setProposal(newProposal);
    setIsGeneratingProposal(false);
    setActiveTab('proposal');
    addLog(`Generated Proposal ${newProposal.proposalId}: Expected Mass Delta ${newProposal.expectedImpact.massDeltaPercent}%`);
  };

  const handleApproveProposal = () => {
    if (!proposal || !session) return;
    const service = AIDesignAssistantService.getInstance();
    const result = service.approveProposalAndCreateRevision(proposal.proposalId, session, 'ENG_USER_01');

    setProposal(result.proposal);
    setApprovalStatus(`Approved! Created Revision ${result.newRevisionId} and ECO ${result.ecoId}`);
    setLastEvidence(result.evidenceRecord);
    addLog(`Engineer Approved Proposal! Revision ${result.newRevisionId} created. Digital Thread Token: ${result.evidenceRecord.digitalThreadToken}`);
  };

  const handleRunWhatIf = async () => {
    if (!session) return;
    addLog(`Executing What-If Counterfactual Analysis for ${whatIfParam} (${whatIfDelta > 0 ? '+' : ''}${whatIfDelta} mm)...`);
    const service = AIDesignAssistantService.getInstance();
    const res = await service.runCounterfactualAnalysis(session, whatIfParam, whatIfDelta);
    setWhatIfResult(res);
    addLog(`Counterfactual Complete! Mass Delta: ${res.massDeltaKg} kg, Stress Delta: ${res.stressDeltaMPa} MPa`);
  };

  const handleRunGate = async () => {
    addLog('Executing 70-Assertion AI Design Assistant Hard Acceptance Gate...');
    const res = await HardAcceptanceGate306.runGate();
    setGateResult(res);
    addLog(`Hard Acceptance Gate Complete! Passed ${res.passedCount}/${res.totalAssertions} Assertions (${res.successRatePercent.toFixed(1)}%)`);
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-100 space-y-6 shadow-2xl font-sans">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
            <Bot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold tracking-wider text-purple-400 uppercase bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800">
                PATCH-306
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                AI Design Assistant
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Natural Language Intent → Engineering Context → Tool Calling → Design Proposal & Diff → Solvers → Human Review & ECO
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {session && context && (
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-slate-300 font-medium">{context.partName}</span>
              <span className="text-purple-400 font-mono">({context.revisionId})</span>
            </div>
          )}

          <button
            onClick={handleRunGate}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-lg shadow-purple-950"
          >
            <Shield className="w-4 h-4" />
            <span>Run 70-Assertion Gate</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('intent')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'intent' ? 'bg-slate-800 text-purple-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Natural Language Intent</span>
        </button>

        <button
          onClick={() => setActiveTab('proposal')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'proposal' ? 'bg-slate-800 text-purple-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Design Proposal & Diff</span>
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'tools' ? 'bg-slate-800 text-purple-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Tool Calling Registry</span>
        </button>

        <button
          onClick={() => setActiveTab('whatif')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'whatif' ? 'bg-slate-800 text-purple-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>What-If Counterfactuals</span>
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'review' ? 'bg-slate-800 text-purple-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Automated Design Review</span>
        </button>

        <button
          onClick={() => setActiveTab('candidates')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'candidates' ? 'bg-slate-800 text-purple-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Design Space Exploration</span>
        </button>

        <button
          onClick={() => setActiveTab('gate')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'gate' ? 'bg-slate-800 text-purple-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Production Gate (70)</span>
        </button>
      </div>

      {/* TAB 1: NATURAL LANGUAGE INTENT */}
      {activeTab === 'intent' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span>Enter Engineer Intent (Natural Language)</span>
            </h3>

            <div className="flex gap-3">
              <input
                type="text"
                value={naturalLanguageInput}
                onChange={(e) => setNaturalLanguageInput(e.target.value)}
                placeholder="e.g., Reduce mass while maintaining stiffness on 3-axis CNC..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
              />
              <button
                onClick={handleParseIntent}
                className="bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>Parse Intent</span>
              </button>
              <button
                onClick={handleGenerateProposal}
                disabled={isGeneratingProposal}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-lg flex items-center space-x-2 transition-all shadow-lg shadow-purple-950"
              >
                {isGeneratingProposal ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isGeneratingProposal ? 'Synthesizing...' : 'Generate AI Proposal'}</span>
              </button>
            </div>
          </div>

          {/* Parsed Structured Intent */}
          {parsedIntent && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Structured Engineering Intent</span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    parsedIntent.ambiguityStatus === 'CLEAR' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {parsedIntent.ambiguityStatus}
                  </span>
                </div>
              </div>

              {parsedIntent.ambiguityStatus === 'NEEDS_CLARIFICATION' && (
                <div className="bg-amber-950/40 border border-amber-800/60 p-3.5 rounded-lg flex items-start space-x-3 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Clarification Required: </span>
                    {parsedIntent.clarificationPrompt}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                  <span className="text-slate-400">Primary Objective:</span>
                  <div className="text-sm font-bold text-purple-400">{parsedIntent.primaryObjective}</div>
                  <div className="text-[10px] text-slate-500">
                    Target: {parsedIntent.objectives.map((o) => `${o.direction} ${o.metric}`).join(', ')}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                  <span className="text-slate-400">Manufacturing Requirement:</span>
                  <div className="text-sm font-bold text-indigo-400">{parsedIntent.manufacturingRequirements.join(', ')}</div>
                  <div className="text-[10px] text-slate-500">Process Constraint Check: 3-Axis CNC</div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                  <span className="text-slate-400">Disclosed Explicit Assumptions:</span>
                  <div className="text-xs text-slate-300 space-y-1">
                    {parsedIntent.explicitAssumptions.map((a, i) => (
                      <div key={i} className="flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DESIGN PROPOSAL & DIFF */}
      {activeTab === 'proposal' && (
        <div className="space-y-6">
          {proposal ? (
            <div className="space-y-6">
              {/* Proposal Header */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-purple-400">{proposal.proposalId}</span>
                    <h3 className="text-base font-bold text-slate-100">AI Design Proposal for {proposal.targetObject}</h3>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className={`text-xs font-mono font-bold px-3 py-1 rounded-lg border ${
                      proposal.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-purple-950 text-purple-300 border-purple-800'
                    }`}>
                      {proposal.status}
                    </span>

                    {proposal.status !== 'APPROVED' && (
                      <button
                        onClick={handleApproveProposal}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center space-x-2 shadow-lg shadow-emerald-950"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Engineer Approve & Create ECO</span>
                      </button>
                    )}
                  </div>
                </div>

                {approvalStatus && (
                  <div className="bg-emerald-950/40 border border-emerald-800/60 p-3.5 rounded-lg flex items-center space-x-3 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{approvalStatus}</span>
                  </div>
                )}

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2 text-xs">
                  <span className="font-bold text-purple-300">AI Reasoning:</span>
                  <p className="text-slate-300 leading-relaxed">{proposal.reasoning}</p>
                </div>

                {/* Expected Impact Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                    <span className="text-slate-400">Mass Reduction:</span>
                    <div className="text-lg font-bold text-emerald-400">{proposal.expectedImpact.massDeltaPercent}%</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                    <span className="text-slate-400">Stiffness Impact:</span>
                    <div className="text-lg font-bold text-slate-200">{proposal.expectedImpact.stiffnessDeltaPercent}%</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                    <span className="text-slate-400">Cost Savings:</span>
                    <div className="text-lg font-bold text-indigo-400">{proposal.expectedImpact.costDeltaPercent}%</div>
                  </div>
                </div>
              </div>

              {/* Engineering Diffs */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Engineering Diff (Before vs Proposed)</h4>

                <div className="space-y-3">
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2">
                    <span className="text-slate-400 font-bold">Parametric Parameter Diffs:</span>
                    {proposal.diff.parametricDiffs.map((d, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-800/50 pb-1.5">
                        <span className="text-slate-300">{d.parameterName}</span>
                        <div className="space-x-2">
                          <span className="text-rose-400 line-through">{d.oldValue} {d.unit}</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-emerald-400 font-bold">{d.newValue} {d.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-1">
                      <span className="text-slate-400">Assembly Impact:</span>
                      <div className="text-slate-200">Clearance Issues: None</div>
                      <div className="text-slate-500 text-[10px]">Mating Parts: {proposal.diff.assemblyImpact.affectedMatingParts.join(', ')}</div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-1">
                      <span className="text-slate-400">Manufacturing Machinability:</span>
                      <div className="text-emerald-400 font-bold">Score: {proposal.diff.manufacturingImpact.machinabilityScoreAfter} / 100</div>
                      <div className="text-slate-500 text-[10px]">Toolpath Collision Risk: {proposal.diff.manufacturingImpact.toolpathCollisionRisk}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
              No proposal generated yet. Click &quot;Generate AI Proposal&quot; on the Intent tab.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TOOL CALLING REGISTRY */}
      {activeTab === 'tools' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">AIEngineeringToolRegistry (Permission Matrix & Solver Isolation)</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              {AIEngineeringToolRegistry.getInstance().getAllTools().map((tool, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-200">{tool.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      tool.requiredPermission === 'MODIFY' ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-purple-950 text-purple-300 border border-purple-800'
                    }`}>
                      {tool.requiredPermission}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">{tool.description}</p>
                  <div className="text-[10px] text-slate-500">Is Native Solver: {tool.isSolver ? 'YES' : 'NO'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WHAT-IF COUNTERFACTUALS */}
      {activeTab === 'whatif' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Counterfactual Parameter Sensitivity &quot;What-If&quot; Analysis</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Parameter</label>
                <select
                  value={whatIfParam}
                  onChange={(e) => setWhatIfParam(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="Pocket_Depth">Pocket_Depth (mm)</option>
                  <option value="Wall_Thickness">Wall_Thickness (mm)</option>
                  <option value="Fillet_Radius">Fillet_Radius (mm)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Delta Adjustment (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={whatIfDelta}
                  onChange={(e) => setWhatIfDelta(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleRunWhatIf}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center justify-center space-x-2 shadow-lg shadow-purple-950"
                >
                  <Play className="w-4 h-4" />
                  <span>Execute Solvers</span>
                </button>
              </div>
            </div>
          </div>

          {whatIfResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Solver Counterfactual Outcome</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                  <span className="text-slate-400">Mass Change:</span>
                  <div className="text-lg font-bold text-emerald-400">{whatIfResult.massDeltaKg > 0 ? '+' : ''}{whatIfResult.massDeltaKg} kg</div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                  <span className="text-slate-400">Von Mises Stress Delta:</span>
                  <div className="text-lg font-bold text-indigo-400">{whatIfResult.stressDeltaMPa > 0 ? '+' : ''}{whatIfResult.stressDeltaMPa} MPa</div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                  <span className="text-slate-400">Resulting Safety Factor:</span>
                  <div className="text-lg font-bold text-sky-400">{whatIfResult.safetyFactor}</div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg text-xs text-slate-300 font-sans">
                <span className="font-bold text-purple-300">AI Explanation: </span>
                {whatIfResult.recommendation}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AUTOMATED DESIGN REVIEW */}
      {activeTab === 'review' && designReview && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">AIDesignReview Engine Results</h3>

            <div className="space-y-3 font-mono text-xs">
              {designReview.items.map((item, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-200">{item.title}</span>
                    <span className="text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 font-bold">
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">{item.description}</p>
                  <div className="text-[10px] text-slate-500">Source: {item.evidenceSource}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DESIGN SPACE CANDIDATES */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">Design Space Exploration Candidates</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              {candidates.map((cand, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="font-bold text-purple-300">{cand.name}</span>
                    <span className="text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      Score: {cand.compositeScore}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-400">
                    <div>Pocket Depth: {cand.parameters.PocketDepthMm} mm</div>
                    <div>Wall Thickness: {cand.parameters.WallThicknessMm} mm</div>
                    <div>Fillet Radius: {cand.parameters.FilletRadiusMm} mm</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: PRODUCTION GATE (70 ASSERTIONS) */}
      {activeTab === 'gate' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-bold text-slate-100">PATCH-306 AI Design Assistant Gate Suite</h3>
              <p className="text-xs text-slate-400">70 Hard Assertions verifying Intent Parsing, Tool Authorization, Solvers, Diffs, Provenance & Evidence</p>
            </div>

            <button
              onClick={handleRunGate}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Shield className="w-4 h-4" />
              <span>Execute 70-Assertion Gate</span>
            </button>
          </div>

          {gateResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-xs text-slate-400">Total Assertions</span>
                  <div className="text-2xl font-bold font-mono text-slate-100">{gateResult.totalAssertions}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-xs text-slate-400">Success Rate</span>
                  <div className="text-2xl font-bold font-mono text-purple-400">{gateResult.successRatePercent.toFixed(1)}%</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-xs text-slate-400">Passed / Failed</span>
                  <div className="text-2xl font-bold font-mono text-purple-400">
                    {gateResult.passedCount} / {gateResult.failedCount}
                  </div>
                </div>
              </div>

              {/* Capability Matrix */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Production Classification Matrix (20 Capabilities)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {gateResult.productionMatrix.map((item, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{item.capability}</span>
                      <span className="font-mono font-bold text-purple-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
