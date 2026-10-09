/**
 * PHASE 28 — ENGINEERING AI
 * PATCH-313 — Generative Engineering Workbench Panel
 * 
 * Interactive UI component for native CAD generative synthesis, physical solver evidence,
 * CAM tool access & collision checks, Pareto trade-off analysis, explainable candidate ranking,
 * and engineer override & promotion.
 */

import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, XCircle, Layers, Cpu, ShieldAlert, Sliders, Award, FileCheck, TrendingDown, Box, Wrench, RotateCcw, CheckSquare, FileText } from 'lucide-react';
import { GenerativeEngineeringService } from '../engine/engineering_ai/generative/GenerativeEngineeringService';
import { HardAcceptanceGate313, GateTestResult313 } from '../engine/engineering_ai/generative/HardAcceptanceGate313';
import {
  GenerativeDesignSession,
  GeneratedDesignCandidate,
  GenerativeEngineeringReport
} from '../engine/engineering_ai/generative/GenerativeEngineeringTypes313';

export const GenerativeEngineeringWorkbenchPanel: React.FC = () => {
  const service = GenerativeEngineeringService.getInstance();
  const [session, setSession] = useState<GenerativeDesignSession | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<GeneratedDesignCandidate | null>(null);
  const [engineerUserId, setEngineerUserId] = useState<string>('ENG-LEAD-88');
  const [selectionReason, setSelectionReason] = useState<string>(
    'Selected for production release due to 2.4 FoS and optimal fatigue life margin.'
  );
  const [report, setReport] = useState<GenerativeEngineeringReport | null>(null);
  const [gateResults, setGateResults] = useState<{
    passed: boolean;
    totalAssertions: number;
    passedCount: number;
    failedCount: number;
    results: GateTestResult313[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'CANDIDATES' | 'PARETO' | 'REPORT' | 'GATE_313'>('CANDIDATES');

  // Initialize and run generative session
  const handleRunGenerativeSynthesis = () => {
    const newSession = service.createSession(
      'PROJ-AERO-TURBINE-2026',
      'TURBINE-MOUNT-BRACKET',
      'REV-B-BASELINE',
      engineerUserId,
      {
        requirementSetId: 'REQ-SET-AERO-01',
        name: 'Aerospace Structural Engine Mount',
        requirements: [
          { requirementId: 'REQ-1', name: 'Yield FoS', type: 'HARD_CONSTRAINT', category: 'SAFETY', targetValue: 1.5, unit: 'FoS', operator: 'GREATER_THAN_EQUAL', priority: 1, source: 'FAR-25.303', createdAt: new Date().toISOString() },
          { requirementId: 'REQ-2', name: 'Max Von Mises Stress', type: 'HARD_CONSTRAINT', category: 'FUNCTIONAL', targetValue: 450, unit: 'MPa', operator: 'LESS_THAN_EQUAL', priority: 2, source: 'FEA Spec', createdAt: new Date().toISOString() },
          { requirementId: 'REQ-3', name: 'Mass Budget', type: 'SOFT_CONSTRAINT', category: 'WEIGHT', targetValue: 2.2, unit: 'kg', operator: 'LESS_THAN_EQUAL', priority: 7, source: 'Mass Allocation', createdAt: new Date().toISOString() }
        ],
        maximumMassKg: 2.5,
        minimumYieldSafetyFactor: 1.5,
        maximumAllowableStressMPa: 450,
        manufacturingMethod: '5_AXIS_MILL'
      },
      {
        spaceId: 'DS-AERO-01',
        allowedVolumeM3: 0.005,
        forbiddenVolumeM3: 0.001,
        preservedInterfaces: [
          { interfaceId: 'INT-1', name: 'Engine Casing Flange (4xBolt Pattern)', location: [0, 0, 0], type: 'BOLT_PATTERN' },
          { interfaceId: 'INT-2', name: 'Main Shaft Bearing Bore Ø45mm', location: [120, 45, 0], type: 'BEARING' }
        ],
        variableRegions: [
          { regionId: 'REG-1', name: 'Web Structural Topology Mesh', maxVolumeM3: 0.003 }
        ],
        exclusionRegions: [
          { regionId: 'EXCL-1', description: 'Fuel & Sensor Line Corridor' }
        ]
      },
      {
        parameters: [
          { parameterName: 'wallThickness', min: 1.0, max: 4.5, unit: 'mm', defaultValue: 2.0 },
          { parameterName: 'filletRadius', min: 0.8, max: 3.5, unit: 'mm', defaultValue: 1.5 },
          { parameterName: 'latticeDensity', min: 0.3, max: 0.9, unit: 'fraction', defaultValue: 0.5 }
        ],
        materialChoices: ['Ti-6Al-4V Titanium', 'Aluminum 7075-T6', 'Inconel 718'],
        manufacturingLimits: {
          minWallThicknessMm: 1.2,
          minRadiusMm: 0.8,
          maxPocketDepthMm: 50,
          toolAccessAngleDeg: 45
        }
      },
      [
        { objectiveId: 'OBJ-1', type: 'MINIMIZE_WEIGHT', weight: 0.4, unit: 'kg', targetDirection: 'MINIMIZE' },
        { objectiveId: 'OBJ-2', type: 'MINIMIZE_COST', weight: 0.3, unit: 'USD', targetDirection: 'MINIMIZE' },
        { objectiveId: 'OBJ-3', type: 'MINIMIZE_STRESS', weight: 0.3, unit: 'MPa', targetDirection: 'MINIMIZE' }
      ],
      { maxCandidates: 8, maxSolverRuns: 16, maxComputeTimeSec: 300, gpuWorkersAllocated: 4 }
    );

    const generatedCandidates = service.generateCandidates(newSession);
    setSession({ ...newSession });
    if (generatedCandidates.length > 0) {
      const topFeasible = generatedCandidates.find(c => c.feasibility === 'FEASIBLE') || generatedCandidates[0];
      setSelectedCandidate(topFeasible);
    }
  };

  // Run Hard Acceptance Gate 313
  const handleRunGate313 = () => {
    const gate = new HardAcceptanceGate313();
    const res = gate.runAllAssertions();
    setGateResults(res);
  };

  // Handle Engineer Selection & Promotion
  const handleSelectAndPromote = (candidate: GeneratedDesignCandidate) => {
    if (!session) return;
    try {
      const selected = service.selectCandidate(session, candidate.candidateId, engineerUserId, selectionReason);
      setSelectedCandidate({ ...selected });
      setSession({ ...session });
      const rpt = service.generateReport(session);
      setReport(rpt);
    } catch (err: any) {
      alert(`Promotion Failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 space-y-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
                <span>PHASE 28 — Generative Engineering Workbench</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-mono">
                  PATCH-313
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Core Mandate: <span className="text-amber-400 font-mono font-medium">GENERATED ≠ VALIDATED ≠ APPROVED</span>. Deterministic CAD Kernels & Physics Solvers validate candidate geometry before human release.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          <button
            onClick={handleRunGenerativeSynthesis}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors shadow-md border border-indigo-400/30"
          >
            <Sparkles className="w-4 h-4" />
            <span>Run Generative Synthesis</span>
          </button>

          <button
            onClick={handleRunGate313}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors shadow-md border border-emerald-400/30"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Run Gate 313 (70 Assertions)</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('CANDIDATES')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'CANDIDATES'
              ? 'bg-slate-800 text-indigo-400 border border-slate-700'
              : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Candidate Explorer ({session?.candidates.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('PARETO')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'PARETO'
              ? 'bg-slate-800 text-indigo-400 border border-slate-700'
              : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Pareto Trade-off Matrix ({session?.paretoFront.length || 0} Optimal)</span>
        </button>

        <button
          onClick={() => setActiveTab('REPORT')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'REPORT'
              ? 'bg-slate-800 text-indigo-400 border border-slate-700'
              : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Digital Thread Report</span>
        </button>

        <button
          onClick={() => setActiveTab('GATE_313')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'GATE_313'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Acceptance Gate 313</span>
        </button>
      </div>

      {/* Main Content Area */}
      {!session && activeTab !== 'GATE_313' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-full">
            <Cpu className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Generative Engineering Engine Ready</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1">
              Click <span className="text-indigo-400 font-semibold font-mono">"Run Generative Synthesis"</span> to execute parametric Native CAD candidate generation, deterministic FEA stress solvers, and 5-axis CAM toolpath collision checks.
            </p>
          </div>
          <button
            onClick={handleRunGenerativeSynthesis}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors shadow-md"
          >
            Start Generative Synthesis Session
          </button>
        </div>
      )}

      {session && activeTab === 'CANDIDATES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Candidates Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center bg-slate-900 px-4 py-3 rounded-xl border border-slate-800">
              <span className="text-xs font-medium text-slate-300">
                Session <span className="text-indigo-400 font-mono">{session.sessionId}</span> | Budget: {session.budget.maxCandidates} Candidates
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                Status: {session.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {session.candidates.map(candidate => {
                const isSelected = candidate.candidateId === selectedCandidate?.candidateId;
                const isPromoted = candidate.engineerSelection?.isSelected;

                return (
                  <div
                    key={candidate.candidateId}
                    onClick={() => setSelectedCandidate(candidate)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white font-mono">{candidate.candidateId}</span>
                        {candidate.paretoStatus.isParetoOptimal && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center space-x-1">
                            <Award className="w-3 h-3" />
                            <span>PARETO</span>
                          </span>
                        )}
                        {isPromoted && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold">
                            PROMOTED
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          candidate.feasibility === 'FEASIBLE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : candidate.feasibility === 'INFEASIBLE'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {candidate.feasibility}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mb-3">{candidate.material}</p>

                    <div className="grid grid-cols-3 gap-2 text-center py-2 bg-slate-950/60 rounded-lg border border-slate-800/80 mb-3">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Mass</div>
                        <div className="text-xs font-semibold text-slate-200">{candidate.metrics.massKg} kg</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Stress</div>
                        <div className="text-xs font-semibold text-slate-200">{candidate.metrics.maxVonMisesStressMPa} MPa</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Yield FoS</div>
                        <div className={`text-xs font-semibold ${candidate.metrics.safetyFactorFoS >= 1.5 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {candidate.metrics.safetyFactorFoS}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>Cost: <strong className="text-slate-200">${candidate.metrics.costUSD}</strong></span>
                      <span>Score: <strong className="text-indigo-400">{candidate.rankScore || 0}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Candidate Detail Inspector & Promotion Workbench */}
          {selectedCandidate && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Candidate Inspector: {selectedCandidate.candidateId}</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedCandidate.revisionId}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-indigo-400 border border-slate-700 font-mono font-medium">
                  {selectedCandidate.validationState}
                </span>
              </div>

              {/* Engineering Evidence Output */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Deterministic Evidence Logs</h4>
                
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-2">
                  <div>
                    <span className="text-indigo-400 font-bold">[CAD B-Rep Kernel]</span>
                    <p className="text-slate-300 mt-0.5">{selectedCandidate.evidence.cadKernelOutput}</p>
                  </div>
                  <div>
                    <span className={`font-bold ${selectedCandidate.evidence.simulationConverged ? 'text-emerald-400' : 'text-rose-400'}`}>
                      [FEA Physics Solver]
                    </span>
                    <p className="text-slate-300 mt-0.5">{selectedCandidate.evidence.femSolverOutput}</p>
                  </div>
                  <div>
                    <span className="text-amber-400 font-bold">[CAM 5-Axis Simulator]</span>
                    <p className="text-slate-300 mt-0.5">{selectedCandidate.evidence.camValidatorOutput}</p>
                  </div>
                </div>
              </div>

              {/* Constraint Violations */}
              {selectedCandidate.violations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Constraint Violations ({selectedCandidate.violations.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {selectedCandidate.violations.map((v, idx) => (
                      <div key={idx} className="bg-rose-950/30 border border-rose-900/40 p-2.5 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between text-rose-300 font-medium">
                          <span>{v.metricName}</span>
                          <span className="font-mono uppercase">{v.severity}</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          Actual: <strong className="text-rose-300">{v.actualValue}</strong> | Required: <strong className="text-slate-300">{v.requiredValue}</strong>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explainable Rank Score */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Rank Score & Explainability</span>
                  <span className="text-indigo-400 font-bold font-mono">{selectedCandidate.rankScore || 0} pts</span>
                </div>
                <p className="text-[11px] text-slate-300">{selectedCandidate.rankExplanation}</p>
              </div>

              {/* Engineer Selection & Promotion Form */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-900/40 space-y-3">
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileCheck className="w-4 h-4 text-indigo-400" />
                  <span>Engineer Promotion Authority</span>
                </h4>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Engineer ID:</label>
                    <input
                      type="text"
                      value={engineerUserId}
                      onChange={(e) => setEngineerUserId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Technical Rationale:</label>
                    <textarea
                      rows={2}
                      value={selectionReason}
                      onChange={(e) => setSelectionReason(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleSelectAndPromote(selectedCandidate)}
                  disabled={selectedCandidate.feasibility !== 'FEASIBLE'}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                    selectedCandidate.feasibility === 'FEASIBLE'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Promote Candidate to CAD Revision</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {session && activeTab === 'PARETO' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <TrendingDown className="w-5 h-5 text-emerald-400" />
              <span>Multi-Objective Pareto Trade-off Analysis</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Non-dominated design candidates where improving one objective (Mass) compromises another (Stress or Cost).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {session.paretoFront.map(candidate => (
              <div key={candidate.candidateId} className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white font-mono">{candidate.candidateId}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                    PARETO OPTIMAL
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mass:</span>
                    <strong className="text-emerald-400">{candidate.metrics.massKg} kg</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Stress:</span>
                    <strong className="text-indigo-400">{candidate.metrics.maxVonMisesStressMPa} MPa</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cost:</span>
                    <strong className="text-amber-400">${candidate.metrics.costUSD}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Material:</span>
                    <span className="text-slate-200">{candidate.material}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {session && activeTab === 'REPORT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span>Digital Thread Engineering Report</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Cryptographically bound lineage linking requirements, session seed, candidate geometry hash, solver evidence, and promotion ECO.
            </p>
          </div>

          {report ? (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono space-y-2">
                <div className="text-indigo-400 font-bold">Report ID: {report.reportId}</div>
                <div className="text-slate-300">Requirements: {report.requirementSummary}</div>
                <div className="text-slate-400">Candidates Generated: {report.totalCandidatesGenerated} | Feasible: {report.feasibleCandidatesCount} | Pareto: {report.paretoFrontCount}</div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Digital Thread Chain</h4>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1.5 text-xs font-mono">
                  {report.digitalThreadChain.map((link, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-slate-300">
                      <span className="text-indigo-500 font-bold">[{idx + 1}]</span>
                      <span>{link}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 bg-slate-950 p-4 rounded-lg border border-slate-800">
              Select and promote a candidate to generate the formal Digital Thread Report.
            </div>
          )}
        </div>
      )}

      {activeTab === 'GATE_313' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
                <span>Hard Acceptance Gate 313 — Test Battery</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Verifies native CAD candidate generation, physical solvers, 5-axis CAM validation, Pareto optimality, and engineer selection rules.
              </p>
            </div>

            <button
              onClick={handleRunGate313}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors shadow-md"
            >
              Execute Gate 313 (70 Assertions)
            </button>
          </div>

          {gateResults && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                gateResults.passed ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                <div className="flex items-center space-x-3">
                  {gateResults.passed ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <XCircle className="w-6 h-6 text-rose-400" />}
                  <div>
                    <h4 className="font-bold text-sm">
                      Gate 313 Status: {gateResults.passed ? 'PASSED (100% Verification)' : 'FAILED'}
                    </h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      Passed {gateResults.passedCount} of {gateResults.totalAssertions} assertions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-1.5 pr-2">
                {gateResults.results.map(res => (
                  <div key={res.assertionId} className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-slate-500 w-8">#{res.assertionId}</span>
                      <span className="text-slate-200">{res.description}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-[11px] text-slate-400 hidden sm:inline">{res.details}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        res.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {res.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
