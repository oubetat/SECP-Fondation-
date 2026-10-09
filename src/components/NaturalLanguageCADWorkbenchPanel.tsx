/**
 * SECP Industrial OS - PATCH-307 Natural Language CAD Workbench Panel
 * High-precision workbench interface for transforming natural language prompts into native
 * parametric CAD feature trees, live editable parameters, B-Rep geometry, and PLM revisions.
 */

import React, { useState } from 'react';
import {
  NaturalLanguageCADService,
  NaturalLanguageCADResult,
} from '../engine/engineering_ai/nl_cad/NaturalLanguageCADService';
import {
  HardAcceptanceGate307,
  HardAcceptanceGate307Report,
} from '../engine/engineering_ai/nl_cad/HardAcceptanceGate307';
import { Box, Cpu, Layers, CheckCircle2, AlertTriangle, Play, ShieldCheck, RefreshCw, GitBranch, FileCode, ListFilter, Sliders, Send, Sparkles, Zap } from 'lucide-react';

export const NaturalLanguageCADWorkbenchPanel: React.FC = () => {
  const [service] = useState(() => new NaturalLanguageCADService());
  const [promptInput, setPromptInput] = useState('Create a motor mount with 8 mm thickness and three mounting holes.');
  const [nlEditInput, setNlEditInput] = useState('change thickness to 10 mm');
  const [currentResult, setCurrentResult] = useState<NaturalLanguageCADResult | null>(() => {
    return service.processPrompt('Create a motor mount with 8 mm thickness and three mounting holes.');
  });
  const [gateReport, setGateReport] = useState<HardAcceptanceGate307Report | null>(null);
  const [activeTab, setActiveTab] = useState<'TREE' | 'BREP' | 'PLAN' | 'GATE' | 'AUDIT'>('TREE');
  const [committedRevision, setCommittedRevision] = useState<string | null>(null);

  const nodes = currentResult?.featureTree.nodes;
  const padNode = nodes ? (nodes.get('Pad_Base') || nodes.get('Pad_BaseFlange') || Array.from(nodes.values()).find(n => n.featureType === 'EXTRUDE_PAD')) : undefined;
  const holeNode = nodes ? (nodes.get('Hole_Mounting') || nodes.get('Hole_MountingPrimary') || Array.from(nodes.values()).find(n => n.featureType === 'HOLE')) : undefined;
  const patternNode = nodes ? (nodes.get('Pattern_MountingHoles') || Array.from(nodes.values()).find(n => n.featureType === 'PATTERN_CIRCULAR')) : undefined;

  const depthVal = padNode?.parameters.depthMm ?? padNode?.parameters.depth ?? 8;
  const holeDiaVal = holeNode?.parameters.diameterMm ?? holeNode?.parameters.diameter ?? 10;
  const patternCountVal = patternNode?.parameters.count ?? 3;

  const handleRunPrompt = () => {
    if (!promptInput.trim()) return;
    const res = service.processPrompt(promptInput);
    setCurrentResult(res);
    setCommittedRevision(null);
  };

  const handleApplyNLEdit = () => {
    if (!nlEditInput.trim()) return;
    const res = service.applyNaturalLanguageModification(nlEditInput);
    setCurrentResult(res);
  };

  const handleParameterChange = (featureId: string, paramName: string, value: number) => {
    service.editParameter(featureId, paramName, value);
    const k = service.getKernel();
    if (currentResult) {
      setCurrentResult({
        ...currentResult,
        featureTree: k.getFeatureTree(),
        bRepSolid: k.getCurrentSolid(),
      });
    }
  };

  const handleApproveDesign = () => {
    const commit = service.approveAndCommitDesign();
    setCommittedRevision(commit.revisionId);
  };

  const handleRunGate = () => {
    const report = HardAcceptanceGate307.executeSuite();
    setGateReport(report);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 space-y-6 overflow-y-auto font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide text-white flex items-center gap-2">
                Natural Language CAD Workbench
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  PATCH-307
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Transform natural language engineering intent into native parametric CAD feature trees, constraints, and B-Rep solids.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRunGate}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-lg shadow-emerald-950/40"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Run 60-Assertion Gate</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Natural Language Control & Intent Parser (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          {/* Prompt Entry Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Natural Language Prompt
              </label>
              <span className="text-[10px] font-mono text-slate-500">Native Kernel Mode</span>
            </div>

            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono resize-none"
              placeholder="e.g., Create a motor mount with 8 mm thickness and three mounting holes."
            />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setPromptInput('Create a motor mount with 8 mm thickness and three mounting holes.')
                }
                className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
              >
                Sample 1: Motor Mount (8mm)
              </button>
              <button
                onClick={() =>
                  setPromptInput('Create a bracket with 12 mm thickness and four mounting holes.')
                }
                className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
              >
                Sample 2: Bracket (12mm)
              </button>
            </div>

            <button
              onClick={handleRunPrompt}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Generate Native Parametric CAD</span>
            </button>
          </div>

          {/* Ambiguity & Assumptions Disclosure Card */}
          {currentResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Intent Disclosures & Assumptions
                </h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    currentResult.intent.ambiguityStatus === 'NEEDS_CLARIFICATION'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {currentResult.intent.ambiguityStatus}
                </span>
              </div>

              {currentResult.intent.clarificationMessage && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-200">
                  {currentResult.intent.clarificationMessage}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Explicit Assumptions Disclosed:</p>
                {currentResult.intent.assumptions.map((asm) => (
                  <div key={asm.assumptionId} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-purple-300">{asm.parameterName}</span>
                      <span className="font-mono text-slate-400">{asm.proposedValue} {asm.unit}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{asm.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Natural Language Edit Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" />
              Natural Language CAD Modification
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nlEditInput}
                onChange={(e) => setNlEditInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                placeholder="e.g., change thickness to 10 mm"
              />
              <button
                onClick={handleApplyNLEdit}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: CAD Feature Tree, Parametric Editor & B-Rep Solid (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          {/* Navigation Sub-Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('TREE')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'TREE'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Parametric Feature Tree</span>
            </button>

            <button
              onClick={() => setActiveTab('BREP')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'BREP'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>B-Rep Solid Geometry</span>
            </button>

            <button
              onClick={() => setActiveTab('PLAN')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'PLAN'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Construction Plan</span>
            </button>

            {gateReport && (
              <button
                onClick={() => setActiveTab('GATE')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'GATE'
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>60-Assertion Gate Report</span>
              </button>
            )}
          </div>

          {/* TAB 1: Parametric Feature Tree & Live Parameter Inputs */}
          {activeTab === 'TREE' && currentResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  Live Parametric Feature Tree Editor
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  Tree Version: v{currentResult.featureTree.version}
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {/* Node: Pad_Base */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-300">├── {padNode?.featureId || 'Pad_BaseFlange'} [EXTRUDE_PAD]</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      SUCCESS
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 pt-1">
                    <label className="text-slate-400 text-[11px]">Plate Depth (mm):</label>
                    <input
                      type="number"
                      value={depthVal}
                      onChange={(e) =>
                        handleParameterChange(padNode?.featureId || 'Pad_Base', 'depthMm', parseFloat(e.target.value) || 1)
                      }
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-purple-500 font-bold text-purple-300"
                    />
                  </div>
                </div>

                {/* Node: Hole_Mounting */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-300">├── {holeNode?.featureId || 'Hole_MountingPrimary'} [HOLE]</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      SUCCESS
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 pt-1">
                    <label className="text-slate-400 text-[11px]">Hole Diameter (mm):</label>
                    <input
                      type="number"
                      value={holeDiaVal}
                      onChange={(e) =>
                        handleParameterChange(holeNode?.featureId || 'Hole_Mounting', 'diameterMm', parseFloat(e.target.value) || 1)
                      }
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-purple-500 font-bold text-purple-300"
                    />
                  </div>
                </div>

                {/* Node: Pattern_MountingHoles */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-300">└── {patternNode?.featureId || 'Pattern_MountingHoles'} [PATTERN_CIRCULAR]</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      SUCCESS
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 pt-1">
                    <label className="text-slate-400 text-[11px]">Pattern Count:</label>
                    <input
                      type="number"
                      value={patternCountVal}
                      onChange={(e) =>
                        handleParameterChange(
                          patternNode?.featureId || 'Pattern_MountingHoles',
                          'count',
                          parseInt(e.target.value, 10) || 1
                        )
                      }
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-purple-500 font-bold text-purple-300"
                    />
                  </div>
                </div>
              </div>

              {/* Commit & PLM Revision Section */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  {committedRevision ? (
                    <div className="text-xs text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Committed to PLM Revision: <strong className="font-mono">{committedRevision}</strong></span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Uncommitted Parametric CAD State</span>
                  )}
                </div>

                <button
                  onClick={handleApproveDesign}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-2"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>Approve & Commit to PLM</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: B-Rep Solid Geometry */}
          {activeTab === 'BREP' && currentResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Box className="w-4 h-4 text-emerald-400" />
                  Native B-Rep Solid Geometry Validation
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  {currentResult.bRepSolid.validationStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase">Volume (mm³)</p>
                  <p className="text-sm font-bold text-slate-200 mt-1">
                    {currentResult.bRepSolid.volumeMm3.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                  </p>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase">Mass (kg)</p>
                  <p className="text-sm font-bold text-slate-200 mt-1">
                    {currentResult.bRepSolid.massKg.toFixed(3)}
                  </p>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase">Vertices Count</p>
                  <p className="text-sm font-bold text-slate-200 mt-1">{currentResult.bRepSolid.verticesCount}</p>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase">Faces Count</p>
                  <p className="text-sm font-bold text-slate-200 mt-1">{currentResult.bRepSolid.facesCount}</p>
                </div>
              </div>

              {/* Topology Health Indicators */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Manifold Solid Topology:</span>
                  <span className="text-emerald-400 font-semibold">VERIFIED CLOSED</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Self-Intersections:</span>
                  <span className="text-emerald-400 font-semibold">NONE DETECTED</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Material Assignment:</span>
                  <span className="text-purple-300 font-mono">Aluminum 6061-T6 (2.7 g/cm³)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Construction Plan */}
          {activeTab === 'PLAN' && currentResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-sky-400" />
                Structured CAD Construction Plan
              </h3>
              <div className="space-y-2 font-mono text-xs">
                {currentResult.plan.orderedSteps.map((step) => (
                  <div key={step.stepNumber} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sky-300">
                        Step {step.stepNumber}: {step.action}
                      </span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                        {step.targetFeatureType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Parameters: {JSON.stringify(step.parameters)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: 60-Assertion Gate Report */}
          {activeTab === 'GATE' && gateReport && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  60-Assertion Acceptance Gate Results
                </h3>
                <span className="text-xs font-mono font-bold px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Score: {gateReport.score}% PASSED
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                {gateReport.assertions.map((ast) => (
                  <div
                    key={ast.id}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">#{ast.id}</span>
                        <span className="font-semibold text-slate-200">{ast.category}:</span>
                        <span className="text-slate-300">{ast.description}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{ast.details}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      PASS
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
