import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  FileSpreadsheet, 
  Binary, 
  Database, 
  User, 
  Clock, 
  ChevronRight, 
  Lock, 
  Unlock, 
  Award, 
  RefreshCw, 
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Layers,
  Cpu,
  Compass,
  Gauge,
  FlaskConical,
  Plane
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DroneProofGateEngine, GateDecisionRecord, DesignClassification } from '../../engine/verification/DroneProofGate';
import { DroneProofReport, DroneProofReportEngine } from '../../engine/verification/DroneProofReport';
import { UniversalVerificationPackage } from '../../engine/verification/UniversalVerificationPackage';
import { EngineeringReviewRecord } from '../../engine/verification/UniversalEngineeringReview';
import { 
  ProofTierLevel, 
  ProofTierEvaluation,
  PROOF_TIER_DEFINITIONS 
} from '../../engine/verification/EngineeringProofHierarchy';

interface DroneProofGatePanelProps {
  onDecisionSealed?: (decision: GateDecisionRecord) => void;
}

export const DroneProofGatePanel: React.FC<DroneProofGatePanelProps> = ({ onDecisionSealed }) => {
  const [approver, setApprover] = useState('ENG-LEAD-AUDITOR-01');
  const [targetClassification, setTargetClassification] = useState<DesignClassification>('VERIFIED_DIGITAL_ENGINEERING_CASE');
  const [activeReport, setActiveReport] = useState<DroneProofReport | null>(null);
  const [decisionRecord, setDecisionRecord] = useState<GateDecisionRecord | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(true);

  // Initializing mock/data to work with instantly
  const handleLoadProjectSample = (withPhysical: boolean) => {
    // 1. Build universal verification package mock
    const revision = 'REV-04';
    const pkg: UniversalVerificationPackage = {
      packageId: `PKG-DRONE-${withPhysical ? 'PHYS' : 'DIG'}`,
      caseId: 'CASE-DRONE-CONF-029',
      productId: 'DRONE-HEAVY-LIFT-V4',
      productRevision: revision,
      configurationId: 'CONF-SECP-OPT-029',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      createdBy: 'CHIEF_SYS_ENGINEER',
      status: 'COMPLETE',
      cad: {
        cadModelId: 'CAD-DRONE-AIRFRAME-V4',
        cadRevision: revision,
        parametricFeatures: ['Main Deck Plate', 'Carbon Fiber Spars', 'Quad Rotor Support Arms'],
        material: 'MAT-CF-EPOXY-3K',
        assemblyId: 'ASM-DRONE-ASSEMBLY-V4',
        massProperties: { 
          mass: 3.42, 
          cg: { x: 0, y: 0.05, z: 0.02 }, 
          inertiaTensor: [[1.12, 0, 0], [0, 1.25, 0], [0, 0, 1.68]] 
        },
        designParameters: { thrustWeightRatio: 2.15, factorOfSafety: 1.5 }
      },
      cae: {
        caeModelId: 'CAE-FEA-STRUCTURAL-04',
        associatedCadId: 'CAD-DRONE-AIRFRAME-V4',
        caeType: 'STRUCTURAL_FEM',
        solverName: 'NASTRAN_SECP',
        meshElementsCount: 220000,
        meshNodesCount: 450000,
        loadsDescription: 'Dynamic symmetrical hover press loads with 3.5x multiplier'
      },
      fea: {
        analysisId: 'FEA-CASE-STRESS-04',
        modelId: 'CAD-DRONE-AIRFRAME-V4',
        configurationId: 'CONF-SECP-OPT-029',
        input: { hoverForceN: 480 },
        solver: 'NASTRAN_SECP',
        parameters: { boundaryClamps: 'Arm end fixtures locked' },
        executionId: 'EXEC-FEA-SYM-04',
        result: { maxStressPa: 185e6, marginOfSafety: 1.48 },
        units: 'Pa',
        tolerance: 0.01,
        verdict: 'PASS'
      },
      simulation: {
        scenarioId: 'SIM-TRAJECTORY-LOGISTICS-04',
        geometryRevision: revision,
        materialRevision: revision,
        parameterSet: { windSpeed: 8.5, altitudeLimit: 120 },
        loads: { thrustN: 142.1 },
        boundaryConditions: { corridorWidth: 20 },
        solver: 'SECP_RIGID_BODY_6DOF',
        mesh: { nodeCount: 450000, elementCount: 220000, quality: 0.96 },
        controls: { autonomousHeadingHold: true },
        executionTimestamp: new Date(Date.now() - 3600000).toISOString(),
        result: { pathDeviationMm: 38 },
        resultHash: 'HASH-SIM-DYN-094328',
        status: 'VERIFIED'
      },
      manufacturing: {
        mfgDefinitionId: 'MFG-DEF-CNC-04',
        partDefinition: { partId: 'PART-CF-ARM-LF', description: 'Carbon composite arm front-left mill' },
        material: 'MAT-CF-EPOXY-3K',
        process: ['CNC_ROUTER_CUT', 'AUTOCLAVE_CURE', 'QUALITY_ULTRASONIC_SCAN'],
        bomId: 'BOM-DRONE-HEAVY-V4',
        mfgRevision: revision,
        toolpathId: 'TP-CNC-ROUTER-9842',
        gcodeHash: 'HASH-GCODE-CNC-39482',
        status: 'VERIFIED'
      },
      requirements: [
        {
          requirementId: 'REQ-SECP-CRIT-01',
          description: 'Rotor support arms must sustain pneumatic downward stress of 350N without plastic deformation',
          parameter: 'Maximum Stress Yield Point',
          unit: 'Newton',
          targetValue: 350,
          tolerance: 0.02,
          priority: 'CRITICAL',
          verificationMethod: withPhysical ? 'PHYSICAL_TEST' : 'SIMULATION',
          validationMethod: withPhysical ? 'TEST' : 'SIMULATION',
          linkedDesignId: 'CAD-DRONE-AIRFRAME-V4',
          linkedAnalysisId: 'FEA-CASE-STRESS-04',
          linkedTestId: withPhysical ? 'TEST-PHYS-PRESS-04' : '',
          linkedEvidenceId: `EV-TRUST-PROOF-${withPhysical ? 'PHYS' : 'DIG'}-01`
        }
      ],
      tests: withPhysical ? [
        {
          testId: 'TEST-PHYS-PRESS-04',
          testType: 'PHYSICAL',
          testCondition: 'Hydraulic mechanical load applied symmetric to carbon arm LF',
          instrumentation: { deviceName: 'MTS Industrial Tensile Press SN-4928' },
          calibration: 'CAL-MTS-2026-A2',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          expectedResult: { plasticDeformation: false },
          measuredResult: { plasticDeformation: false },
          uncertainty: 0.05,
          acceptanceCriterion: 'plasticDeformation == false',
          verdict: 'PASS'
        }
      ] : [],
      measurements: [],
      evidence: [
        {
          evidenceId: `EV-TRUST-PROOF-${withPhysical ? 'PHYS' : 'DIG'}-01`,
          evidenceType: withPhysical ? 'TEST' : 'SIMULATION',
          caseId: 'CASE-DRONE-CONF-029',
          sourceType: withPhysical ? 'TEST_BENCH' : 'SOLVER_ENGINE',
          sourceId: withPhysical ? 'TEST-PHYS-PRESS-04' : 'SIM-TRAJECTORY-LOGISTICS-04',
          sourceRevision: revision,
          executionId: 'EXEC-TR-92834',
          createdAt: new Date(Date.now() - 1200000).toISOString(),
          createdBy: 'TESTER_SYS_B',
          inputReferences: [],
          outputReferences: [],
          hash: '96b957e8412803b08e7dfd110fbc2867ef654ee011d87e07663d251ef0bca97c',
          provenance: {
            who: 'TESTER_SYS_B',
            what: 'Chassis press structural loading check',
            when: new Date(Date.now() - 1200000).toISOString(),
            source: 'MTS Hydraulic Frame SN4928',
            version: '2.1',
            input: 'Incremental force to 350N yield point',
            process: 'Load hold for 180 seconds continuous',
            output: 'Deformation delta < 0.05mm'
          },
          status: 'VERIFIED'
        }
      ]
    };

    // 2. Build mock Engineering Review
    const review: EngineeringReviewRecord = {
      reviewId: 'REV-SECP-AUDIT-004',
      caseId: 'CASE-DRONE-CONF-029',
      productId: 'DRONE-HEAVY-LIFT-V4',
      productRevision: revision,
      configurationId: 'CONF-SECP-OPT-029',
      reviewRevision: 1,
      reviewer: 'DR. MARGARET HAMILTON',
      reviewerRole: 'CHIEF SYSTEM SAFETY ARCHITECT',
      createdAt: new Date(Date.now() - 600000).toISOString(),
      reviewScope: ['Carbon spars design margins', 'FOS finite element solver alignment', 'CNC router CAM toolpath outputs'],
      reviewStatus: 'COMPLETED',
      findings: [],
      evidenceReferences: [`EV-TRUST-PROOF-${withPhysical ? 'PHYS' : 'DIG'}-01`],
      recommendations: ['Seal design configuration for immediate manufacturing rollout.'],
      finalReviewVerdict: 'PASS',
      requirementAssessments: [
        {
          requirementId: 'REQ-SECP-CRIT-01',
          requirement: 'Arms sustain pneumatic load of 350N',
          acceptanceCriterion: 'Maximum Stress Yield Point',
          verificationMethod: withPhysical ? 'PHYSICAL_TEST' : 'SIMULATION',
          evidenceId: `EV-TRUST-PROOF-${withPhysical ? 'PHYS' : 'DIG'}-01`,
          result: 350,
          assessment: 'PASS'
        }
      ],
      reportLogs: ['Independent audit checked FEA mesh quality parameters.', 'Evaluated GCode output hashes. Perfect correlation found.']
    };

    // 3. Compile report dynamically
    const report = DroneProofReportEngine.compileReport(
      `REP-SECP-${withPhysical ? 'PHYS-PROOF' : 'DIG-CASE'}-04`,
      pkg,
      review,
      'AUDITOR_PORTAL_AUTOMATED_COMPILER'
    );

    setActiveReport(report);
    setDecisionRecord(null);
  };

  const handleEvaluateGate = () => {
    if (!activeReport) return;
    setIsEvaluating(true);

    setTimeout(() => {
      const decision = DroneProofGateEngine.evaluateGate(activeReport, approver, targetClassification);
      setDecisionRecord(decision);
      setIsEvaluating(false);
      if (decision.gateStatus === 'APPROVED' && onDecisionSealed) {
        onDecisionSealed(decision);
      }
    }, 1000);
  };

  const handleExportJSON = () => {
    if (!decisionRecord) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(decisionRecord, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `GATE_DECISION_${decisionRecord.decisionId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 min-h-screen bg-[#fafafa] text-slate-900" id="drone-proof-gate-panel">
      {/* Page Title & Scope eyebrows */}
      <div className="flex flex-col md:flex-row justify-between items-start border-b border-slate-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-1.5 bg-slate-900 rounded-md text-white shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-widest text-slate-400 uppercase">Verification System Portal</span>
          </div>
          <h1 className="text-2.5xl font-extrabold tracking-tight text-slate-900">EPC-035 — Drone Proof Gate</h1>
          <p className="text-sm font-medium text-slate-500 max-w-xl mt-1">
            The ultimate cryptographic acceptance checkpoint for the Industrial Drone configuration. 
            Enforces physical-evidence verification criteria and safeguards design integrity.
          </p>
        </div>

        {/* Load Actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleLoadProjectSample(false)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-50 active:scale-98 transition-all shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            Load Digital-Only Case (EPC-034)
          </button>
          <button
            onClick={() => handleLoadProjectSample(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 active:scale-98 transition-all shadow-xs"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            Load Physical-Evidence Case
          </button>
        </div>
      </div>

      {!activeReport ? (
        <div className="border border-dashed border-slate-200 bg-white rounded-2xl p-16 flex flex-col items-center text-center max-w-2xl mx-auto my-12 shadow-xs">
          <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Gate Awaiting Report Input</h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
            The gate cannot evaluate a design without an authoritative, machine-signed Drone Proof Report compiled under EPC-034.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleLoadProjectSample(false)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
            >
              Load Digital Case
            </button>
            <button
              onClick={() => handleLoadProjectSample(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors"
            >
              Load Physical Case
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel: Input Report Metadata & Gate Settings */}
          <div className="lg:col-span-4 space-y-6">
            {/* Input Data Summary Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-slate-400" /> Input Engineering Report
              </h3>
              
              <div className="space-y-3 font-medium text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Report ID</span>
                  <span className="font-mono font-bold text-slate-700">{activeReport.reportId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Product Revision</span>
                  <span className="font-bold text-slate-700">{activeReport.productRevision}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400">Engineering Verdict</span>
                  <span className={`font-black uppercase ${activeReport.engineeringVerdict === 'PASS' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {activeReport.engineeringVerdict}
                  </span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-slate-400">Physical Validation</span>
                  <span className="font-bold text-slate-700 uppercase">{activeReport.physicalValidationStatus}</span>
                </div>
              </div>

              {/* Cryptographic Hash Badge */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-2">
                <Binary className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase text-slate-400 block leading-none">Report Signature SHA-256</span>
                  <span className="font-mono text-[9px] font-bold text-slate-500 truncate block mt-1">{activeReport.reportHash}</span>
                </div>
              </div>
            </div>

            {/* Gate Configuration Controls */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" /> Gate Configuration
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Approver ID</label>
                  <input
                    type="text"
                    value={approver}
                    onChange={(e) => setApprover(e.target.value)}
                    className="w-full bg-[#fcfcfc] border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-hidden focus:border-slate-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Target Design Status Promotion</label>
                  <select
                    value={targetClassification}
                    onChange={(e) => setTargetClassification(e.target.value as DesignClassification)}
                    className="w-full bg-[#fcfcfc] border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-hidden focus:border-slate-400 transition-colors"
                  >
                    <option value="VERIFIED_DIGITAL_ENGINEERING_CASE">Verified Digital Engineering Case</option>
                    <option value="FLIGHT_PROVEN">Flight Proven (Requires Hardware Tests)</option>
                  </select>
                </div>
              </div>

              {/* Truth Rule Warning block */}
              {targetClassification === 'FLIGHT_PROVEN' && (
                <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-3 flex gap-2">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed text-amber-700 font-medium">
                    <strong className="font-bold text-amber-800">Engineering Truth Rule:</strong> Flight Proven status requires validated real-world physical verification evidence inside the report. Digital simulation is insufficient.
                  </p>
                </div>
              )}

              <button
                onClick={handleEvaluateGate}
                disabled={isEvaluating}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xs"
              >
                {isEvaluating ? <Activity className="w-4.5 h-4.5 animate-spin" /> : <ShieldCheck className="w-4.5 h-4.5" />}
                {isEvaluating ? 'Evaluating Design Integrity...' : 'Verify & Evaluate Gate'}
              </button>
            </div>
          </div>

          {/* Right panel: Evaluation Decisions and assertions */}
          <div className="lg:col-span-8 space-y-6">
            {!decisionRecord ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm min-h-[400px]">
                <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                  <Activity className="w-7 h-7 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-slate-700">Awaiting Gate Decision</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Configure the approver details and target status on the left, then click "Verify & Evaluate Gate" to execute SECP cryptographic safety checks.
                </p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="space-y-6"
              >
                {/* Final Decision Badge */}
                <div className={`rounded-2xl border p-6 shadow-sm relative overflow-hidden bg-white`}>
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${decisionRecord.gateStatus === 'APPROVED' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {decisionRecord.gateStatus === 'APPROVED' ? (
                          <div className="p-1 bg-emerald-500/10 text-emerald-600 rounded-md">
                            <CheckCircle className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="p-1 bg-rose-500/10 text-rose-600 rounded-md">
                            <XCircle className="w-5 h-5" />
                          </div>
                        )}
                        <span className="text-xs font-black tracking-widest text-slate-400 uppercase">Decision Record Sealed</span>
                      </div>
                      
                      <h2 className="text-2xl font-black text-slate-800 leading-tight">
                        Gate Decision: <span className={decisionRecord.gateStatus === 'APPROVED' ? 'text-emerald-600' : 'text-rose-600'}>{decisionRecord.gateStatus}</span>
                      </h2>
                      
                      <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">ID: {decisionRecord.decisionId}</span>
                        <span>•</span>
                        <span>Evaluated by <strong className="text-slate-700 font-bold">{decisionRecord.approvedBy}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(decisionRecord.timestamp).toLocaleTimeString()} UTC</span>
                      </p>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Awarded Classification</span>
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 font-black text-xs text-slate-700 shadow-sm uppercase tracking-wide">
                        <Award className={`w-4 h-4 ${decisionRecord.awardedClassification === 'FLIGHT_PROVEN' ? 'text-amber-500' : 'text-indigo-500'}`} />
                        {decisionRecord.awardedClassification.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>

                  {decisionRecord.failureReasons.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-slate-100 space-y-2">
                      <span className="text-[10px] font-black uppercase text-rose-500 block tracking-wider">Gate Rejection Reasons</span>
                      <div className="space-y-1.5">
                        {decisionRecord.failureReasons.map((reason, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50/50 border border-rose-100 rounded-lg p-2.5 font-medium leading-relaxed">
                            <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 6-Tier Engineering Proof Hierarchy Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-base font-extrabold text-slate-900">
                          6-Tier Engineering Proof Chain (SECP Hierarchy)
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Strict separation of digital cryptographic integrity, in-silico solvers, and physical hardware validation.
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Highest Achieved Tier</span>
                      <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        Tier {decisionRecord.proofHierarchy?.highestAchievedTierNumber ?? (decisionRecord.checks.physicalValidationConfirmed ? 6 : 4)} / 6
                      </span>
                    </div>
                  </div>

                  {/* Axiomatic Truth Warning Banner */}
                  <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-3.5 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-amber-900">
                        Engineering Truth Axiom: Evidence Integrity ≠ Engineering Validity ≠ Physical Reality
                      </h4>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        A valid SHA-256 hash confirms the data payload was not modified, but does <strong>not</strong> prove geometric correctness or airworthiness. Digital simulations (Tiers 1-4) qualify a design for <strong>VERIFIED_DIGITAL_ENGINEERING_CASE</strong> only. Promotion to <strong>FLIGHT_PROVEN</strong> requires validated Tiers 5 & 6.
                      </p>
                    </div>
                  </div>

                  {/* 6-Tier Vertical Pipeline Grid */}
                  <div className="space-y-3">
                    {[
                      {
                        tierNum: 1,
                        name: 'Cryptographic Provenance',
                        arabicName: 'Cryptographic Provenance & Lineage',
                        question: '“Did the record remain unchanged?”',
                        arabicQuestion: 'Have records and engineering parameters remained untampered?',
                        icon: Binary,
                        status: decisionRecord.checks.hashIntegrity ? 'VERIFIED' : 'FAILED',
                        statusColor: decisionRecord.checks.hashIntegrity ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200',
                        note: 'SHA-256 canonical hashing & audit provenance guarantees zero tampering.'
                      },
                      {
                        tierNum: 2,
                        name: 'Digital Thread',
                        arabicName: 'Digital Thread & Provenance Chain',
                        question: '“Are artifacts correctly linked?”',
                        arabicQuestion: 'Are CAD design, CAE analysis, and CAM manufacturing links validated?',
                        icon: ArrowRightLeft,
                        status: decisionRecord.checks.digitalThreadValid ? 'VERIFIED' : 'FAILED',
                        statusColor: decisionRecord.checks.digitalThreadValid ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200',
                        note: 'Continuous unbroken links across Requirements → CAD → CAE → CAM.'
                      },
                      {
                        tierNum: 3,
                        name: 'CAD / Mathematical Validity',
                        arabicName: 'Mathematical & Topological Integrity',
                        question: '“Is the geometry/topology correct?”',
                        arabicQuestion: 'Are geometry, B-Rep topology, and feature definitions mathematically sound?',
                        icon: Compass,
                        status: 'VERIFIED',
                        statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                        note: 'B-Rep validity & parametric features evaluated (feature bounds checked).'
                      },
                      {
                        tierNum: 4,
                        name: 'Numerical Verification (In-Silico)',
                        arabicName: 'Computational Verification (Simulation)',
                        question: '“Does the solver compute correctly?”',
                        arabicQuestion: 'Do FEA, CFD, and multibody solvers converge with proven numerical precision?',
                        icon: Cpu,
                        status: 'COMPUTED_IN_SILICO',
                        statusColor: 'text-blue-700 bg-blue-50 border-blue-200',
                        note: 'FEA solver & 6-DOF simulation converged within boundary tolerances.'
                      },
                      {
                        tierNum: 5,
                        name: 'Experimental Validation',
                        arabicName: 'Experimental Physical Validation',
                        question: '“Does reality match the model?”',
                        arabicQuestion: 'Do laboratory measurements and physical coupons match numerical models?',
                        icon: FlaskConical,
                        status: decisionRecord.checks.physicalValidationConfirmed ? 'VERIFIED' : 'NOT_PERFORMED',
                        statusColor: decisionRecord.checks.physicalValidationConfirmed ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200',
                        note: decisionRecord.checks.physicalValidationConfirmed ? 'Physical static load bench tests match numerical models.' : 'No physical destructive or strain gauge test data provided.'
                      },
                      {
                        tierNum: 6,
                        name: 'Physical / Field / Flight Truth',
                        arabicName: 'Physical Flight Readiness & Operation',
                        question: '“Does the actual system work?”',
                        arabicQuestion: 'Does the full integrated physical assembly operate safely in real-world flight conditions?',
                        icon: Plane,
                        status: (decisionRecord.checks.physicalValidationConfirmed && decisionRecord.awardedClassification === 'FLIGHT_PROVEN') ? 'VERIFIED' : 'NOT_PERFORMED',
                        statusColor: (decisionRecord.checks.physicalValidationConfirmed && decisionRecord.awardedClassification === 'FLIGHT_PROVEN') ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-100 border-slate-200',
                        note: (decisionRecord.checks.physicalValidationConfirmed && decisionRecord.awardedClassification === 'FLIGHT_PROVEN') ? 'Live flight test telemetry recorded across full operating envelope.' : 'System restricted to Digital Engineering qualification; uncertified for flight.'
                      }
                    ].map((tier, idx) => {
                      const IconComponent = tier.icon;
                      return (
                        <div 
                          key={tier.tierNum}
                          className="border border-slate-200/80 rounded-xl p-4 bg-[#fcfcfd] hover:bg-white transition-all space-y-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-mono font-bold text-xs shrink-0">
                                #{tier.tierNum}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="w-4 h-4 text-slate-500" />
                                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-800">{tier.name}</h4>
                                  <span className="text-[11px] font-medium text-slate-400">({tier.arabicName})</span>
                                </div>
                                <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                                  <span className="font-semibold text-slate-700">{tier.question}</span>
                                  <span className="text-slate-400 text-[10px] ml-1.5">[{tier.arabicQuestion}]</span>
                                </div>
                              </div>
                            </div>

                            <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border tracking-wide uppercase shrink-0 ${tier.statusColor}`}>
                              {tier.status}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 bg-white border border-slate-100 rounded-lg p-2 font-medium">
                            {tier.note}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Checklist Matrix Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Hash Integrity', status: decisionRecord.checks.hashIntegrity, desc: 'Signatures valid' },
                    { label: 'Digital Thread', status: decisionRecord.checks.digitalThreadValid, desc: 'Lineage complete' },
                    { label: 'Review Findings', status: decisionRecord.checks.zeroCriticalFindings, desc: 'Zero high blockers' },
                    { label: 'Requirements', status: decisionRecord.checks.allRequirementsMet, desc: 'All criteria pass' },
                    { label: 'Physical Validation', status: decisionRecord.checks.physicalValidationConfirmed, desc: 'Test confirmed' }
                  ].map((check) => (
                    <div key={check.label} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-xs">
                      <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase">{check.label}</span>
                      <div className="my-3 flex justify-between items-center">
                        {check.status ? (
                          <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5 uppercase tracking-wider">Pass</span>
                        ) : (
                          <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 rounded-full px-2.5 py-0.5 uppercase tracking-wider">Fail</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block font-medium truncate">{check.desc}</span>
                    </div>
                  ))}
                </div>

                {/* Verification Traceability/Log Area */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div 
                    className="p-5 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setLogsExpanded(!logsExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      <Binary className="w-4 h-4 text-slate-500" />
                      <h4 className="text-sm font-bold text-slate-800">Deterministic Assertion Logs</h4>
                      <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">
                        {decisionRecord.assertionLog.length} steps
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-400 hover:text-slate-600">
                      {logsExpanded ? 'Collapse' : 'Expand'}
                    </div>
                  </div>

                  <AnimatePresence>
                    {logsExpanded && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="bg-slate-900 overflow-hidden font-mono text-slate-300 text-[11px]"
                      >
                        <div className="p-5 space-y-2 overflow-x-auto max-h-[250px] scrollbar-thin">
                          {decisionRecord.assertionLog.map((log, idx) => (
                            <div key={idx} className="flex gap-2 leading-relaxed">
                              <span className="text-slate-500 select-none">{String(idx + 1).padStart(2, '0')}:</span>
                              <span>{log}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Actions Panel */}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleExportJSON}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-50 active:scale-98 transition-all shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                    Export Decision Record (JSON)
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
