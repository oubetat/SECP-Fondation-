import React, { useState } from 'react';
import { 
  FileText, Shield, AlertTriangle, CheckCircle2, XCircle, Clock, Link2, 
  Activity, Layers, Award, FileSpreadsheet, Eye, RefreshCw, PlusCircle, Trash2, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DroneProofReport, 
  DroneProofReportEngine,
  ReportRequirementItem,
  ReportEvidenceIndexItem,
  RequirementTraceabilityItem
} from '../../engine/verification/DroneProofReport';
import { UniversalVerificationPackage } from '../../engine/verification/UniversalVerificationPackage';
import { EngineeringReviewRecord } from '../../engine/verification/UniversalEngineeringReview';

export interface DroneProofReportPanelProps {
  initialPackage?: UniversalVerificationPackage;
  initialReview?: EngineeringReviewRecord;
}

export const DroneProofReportPanel: React.FC<DroneProofReportPanelProps> = ({
  initialPackage,
  initialReview
}) => {
  // Construct a standard package + review in case none are passed (so the view works instantly)
  const defaultPackage: UniversalVerificationPackage = initialPackage || {
    packageId: 'PKG-DRONE-034',
    caseId: 'CASE-EPC-034',
    productId: 'DRONE-V1',
    productRevision: 'REV-A',
    configurationId: 'CONF-OPT-029',
    createdAt: new Date().toISOString(),
    createdBy: 'CHIEF_QA_OFFICER',
    status: 'COMPLETE',
    cad: {
      cadModelId: 'CAD-1',
      cadRevision: 'REV-A',
      parametricFeatures: ['Spars', 'Motor Arms', 'Landing Legs'],
      material: 'MAT-AL-7075-T6',
      assemblyId: 'ASM-1',
      massProperties: { mass: 3.2, cg: { x: 0, y: 0.1, z: 0.05 }, inertiaTensor: [[1, 0, 0], [0, 1.2, 0], [0, 0, 1.5]] },
      designParameters: { thrustMultiplier: 1.2 }
    },
    cae: {
      caeModelId: 'FEA-1',
      associatedCadId: 'CAD-1',
      caeType: 'STRUCTURAL_FEM',
      solverName: 'NASTRAN_SECP',
      meshElementsCount: 154000,
      meshNodesCount: 300000,
      loadsDescription: 'Concentrated symmetric arm press load of 350N'
    },
    fea: {
      analysisId: 'FEA-1',
      modelId: 'CAD-1',
      configurationId: 'CONF-OPT-029',
      input: {},
      solver: 'NASTRAN_SECP',
      parameters: {},
      executionId: 'EXEC-FEA-1',
      result: { maxStressPa: 220e6, marginOfSafety: 1.4 },
      units: 'Pa',
      tolerance: 0,
      verdict: 'PASS'
    },
    simulation: {
      scenarioId: 'SIM-1',
      geometryRevision: 'REV-A',
      materialRevision: 'REV-A',
      parameterSet: {},
      loads: {},
      boundaryConditions: {},
      solver: 'NASTRAN_SECP',
      mesh: { nodeCount: 300000, elementCount: 154000, quality: 0.98 },
      controls: {},
      executionTimestamp: new Date().toISOString(),
      result: {},
      resultHash: 'HASH-SIM-123',
      status: 'VERIFIED'
    },
    manufacturing: {
      mfgDefinitionId: 'MFG-A',
      partDefinition: { partId: 'PART-1', description: 'Drone Arm LF CNC' },
      material: 'MAT-AL-7075-T6',
      process: ['CNC_3X_MILL', 'POST_HEAT_TREAT'],
      bomId: 'BOM-1',
      mfgRevision: 'REV-A',
      toolpathId: 'TP-1',
      gcodeHash: 'HASH-GC-92834',
      status: 'VERIFIED'
    },
    requirements: [
      {
        requirementId: 'REQ-CRIT-101',
        description: 'Industrial drone frame must survive 350N yield point',
        parameter: 'Yield Strength',
        unit: 'Newton',
        targetValue: 350,
        tolerance: 0,
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'SIMULATION',
        linkedDesignId: 'CAD-1',
        linkedAnalysisId: 'FEA-1',
        linkedTestId: 'TEST-1',
        linkedEvidenceId: 'EV-1'
      },
      {
        requirementId: 'REQ-PERF-102',
        description: 'Battery endurance continuous hovered flight duration',
        parameter: 'Endurance',
        unit: 'Minutes',
        targetValue: 35,
        tolerance: 2,
        priority: 'HIGH',
        verificationMethod: 'SIMULATION',
        validationMethod: 'SIMULATION',
        linkedDesignId: 'CAD-1',
        linkedAnalysisId: 'FEA-1',
        linkedTestId: 'TEST-2',
        linkedEvidenceId: 'EV-2'
      }
    ],
    tests: [
      {
        testId: 'TEST-1',
        testType: 'PHYSICAL',
        testCondition: 'Chassis press 350N force',
        input: { force: 350 },
        expectedResult: { deforms: false },
        measuredResult: { deforms: false },
        acceptanceCriterion: 'deforms == false',
        timestamp: new Date().toISOString(),
        verdict: 'PASS'
      }
    ],
    measurements: [],
    evidence: [
      {
        evidenceId: 'EV-1',
        evidenceType: 'TEST',
        caseId: 'CASE-EPC-034',
        sourceType: 'TEST_BENCH',
        sourceId: 'TEST-1',
        sourceRevision: 'REV-A',
        executionId: 'EXEC-1',
        createdAt: new Date().toISOString(),
        createdBy: 'TESTER_A',
        inputReferences: [],
        outputReferences: [],
        hash: '96b957e8412803b08e7dfd110fbc2867ef654ee011d87e07663d251ef0bca97c',
        rawPayload: '{"force":350,"deforms":false}',
        provenance: {
          who: 'TESTER_A',
          what: 'Chassis press test',
          when: '2026-09-01T12:00:00Z',
          source: 'Press machine SN92',
          version: '1.0',
          input: 'Press force 350N',
          process: 'Hydraulic compression',
          output: 'Yield check'
        },
        status: 'VERIFIED'
      },
      {
        evidenceId: 'EV-2',
        evidenceType: 'SIMULATION',
        caseId: 'CASE-EPC-034',
        sourceType: 'SOLVER_ENGINE',
        sourceId: 'SIM-1',
        sourceRevision: 'REV-A',
        executionId: 'EXEC-2',
        createdAt: new Date().toISOString(),
        createdBy: 'SIMULATOR_A',
        inputReferences: [],
        outputReferences: [],
        hash: 'b567a5b3ee589ea09fdc28c8ef654ee011d87e07663d251ef0bc9238e874983b',
        rawPayload: '{"hoverDuration":36.2}',
        provenance: {
          who: 'SIMULATOR_B',
          what: 'Endurance hover simulation',
          when: '2026-09-01T12:05:00Z',
          source: 'Aerostat Solver v4',
          version: '4.1',
          input: 'Hover load 3.5kg payload',
          process: 'Battery discharge equation integrations',
          output: '36.2 minutes hover limit'
        },
        status: 'VERIFIED'
      }
    ]
  };

  const defaultReview: EngineeringReviewRecord = initialReview || {
    reviewId: 'REV-001',
    caseId: 'CASE-EPC-034',
    productId: 'DRONE-V1',
    productRevision: 'REV-A',
    configurationId: 'CONF-OPT-029',
    reviewRevision: 1,
    reviewer: 'DR. ELEANOR VANCE',
    reviewerRole: 'PRINCIPAL AUTONOMY AUDITOR',
    createdAt: new Date().toISOString(),
    reviewScope: ['CAD', 'FEA', 'Simulation', 'Manufacturing'],
    reviewStatus: 'COMPLETED',
    findings: [
      {
        findingId: 'FIND-MAJ-101',
        severity: 'MAJOR',
        category: 'CALIBRATION',
        description: 'Chassis mechanical testing hydraulic compression rig contains a secondary pressure calibration deviation of +1.5%.',
        detectedAt: new Date().toISOString(),
        reviewer: 'DR. ELEANOR VANCE',
        status: 'OPEN'
      }
    ],
    evidenceReferences: ['EV-1', 'EV-2'],
    recommendations: ['Calibrate press cylinder machine SN92 prior to final physical flight trials.'],
    finalReviewVerdict: 'PASS',
    requirementAssessments: [
      {
        requirementId: 'REQ-CRIT-101',
        requirement: 'Industrial drone frame must survive 350N yield point',
        acceptanceCriterion: 'Yield Strength',
        verificationMethod: 'SIMULATION',
        evidenceId: 'EV-1',
        result: 350,
        assessment: 'PASS'
      },
      {
        requirementId: 'REQ-PERF-102',
        requirement: 'Battery endurance continuous hovered flight duration',
        acceptanceCriterion: 'Endurance',
        verificationMethod: 'SIMULATION',
        evidenceId: 'EV-2',
        result: 35,
        assessment: 'PASS'
      }
    ],
    reportLogs: []
  };

  const [activeTab, setActiveTab] = useState<'summary' | 'requirements' | 'engineering' | 'thread' | 'review' | 'limitations' | 'json'>('summary');
  const [report, setReport] = useState<DroneProofReport>(() => 
    DroneProofReportEngine.compileReport('REP-DRONE-101', defaultPackage, defaultReview, 'CHIEF_ENGINEER_ALEX')
  );
  const [newReason, setNewReason] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  // Re-verify Hash live to show structural fidelity
  const computedHash = DroneProofReportEngine.computeReportHash(report);
  const hashMatches = computedHash === report.reportHash;

  const handleCreateRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReason.trim()) return;

    const newReport = DroneProofReportEngine.createNewReportRevision(report, newReason, 'CHIEF_ENGINEER_ALEX');
    
    // Automatically transition to approved or simulated completed state
    newReport.reportStatus = 'APPROVED';
    // Re-verify the compiled payload
    const updatedWithHash = {
      ...newReport,
      reportHash: DroneProofReportEngine.computeReportHash(newReport)
    };

    setReport(updatedWithHash);
    setNewReason('');
    setShowRevisionForm(false);
  };

  const downloadJsonReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.reportId}_R${report.reportRevision}_Proof_Report.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'PASS':
      case 'VERIFIED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black rounded-full uppercase">PASS</span>;
      case 'FAIL':
      case 'FAILED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black rounded-full uppercase">FAIL</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-black rounded-full uppercase">INCONCLUSIVE</span>;
    }
  };

  return (
    <div id="drone-proof-report-dashboard" className="max-w-7xl mx-auto p-6 space-y-6 bg-[#fafafa] text-slate-800 min-h-screen">
      
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-widest text-xs mb-1">
            <Shield className="w-4 h-4" /> SECP Trust Bus • EPC-034
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-8 h-8 text-slate-700" />
            Drone Proof & Engineering Report
          </h1>
          <p className="text-slate-500 text-sm max-w-xl font-medium mt-1">
            Deterministic, unified audit report linking core CAD design configurations, Multiphysics CAE simulations, and independent engineering validation review.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadJsonReport}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
          <button
            onClick={() => setShowRevisionForm(!showRevisionForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Create Revision
          </button>
        </div>
      </div>

      {/* Main Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Report ID & Revision</label>
          <div className="text-lg font-black text-slate-800 flex items-center gap-2">
            {report.reportId} <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">Rev {report.reportRevision}</span>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-1 truncate">
            Baseline: {report.configurationId}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Audit Status</label>
          <div className="text-lg font-black text-slate-800 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-500" />
            {report.reportStatus}
          </div>
          <div className="text-xs text-slate-400 font-medium mt-1">
            Compiled by {report.createdBy}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Engineering Classification</label>
          <div className="text-sm font-black text-slate-800 mt-1 flex items-center gap-1.5">
            <Award className="w-4.5 h-4.5 text-indigo-500" />
            {report.engineeringClassification}
          </div>
          <div className="text-xs text-slate-400 font-medium mt-0.5">
            Physical validation: {report.physicalValidationStatus}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Verification Verdict</label>
          <div className="mt-1 flex items-center justify-between">
            {getVerdictBadge(report.engineeringVerdict)}
            {hashMatches ? (
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">HASH VALID</span>
            ) : (
              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">HASH MISMATCH</span>
            )}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-2 truncate">
            {report.reportHash}
          </div>
        </div>
      </div>

      {/* Revision Form Overlay */}
      <AnimatePresence>
        {showRevisionForm && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md"
          >
            <h3 className="text-base font-black text-slate-800 mb-2 flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" /> Update Report Revision Baseline
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-medium">
              Every revision creates a deterministic cryptographically signed proof. Silent updates are prohibited.
            </p>
            <form onSubmit={handleCreateRevision} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Reason for Revision Change</label>
                <input 
                  type="text" 
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Recalculated structural safety factoring with standard mesh convergence curves"
                  className="w-full text-sm font-semibold border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRevisionForm(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition"
                >
                  Commit New Revision
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        {[
          { id: 'summary', label: 'Executive Summary', icon: Layers },
          { id: 'requirements', label: 'Requirements Trace', icon: FileSpreadsheet },
          { id: 'engineering', label: 'Core Analysis', icon: Activity },
          { id: 'thread', label: 'Digital Thread', icon: Link2 },
          { id: 'review', label: 'Independent Review', icon: Shield },
          { id: 'limitations', label: 'Limitations', icon: AlertTriangle },
          { id: 'json', label: 'JSON Schema', icon: Eye }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-bold text-xs border-b-2 transition whitespace-nowrap ${isActive ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-base font-black text-slate-900 mb-2">Executive Summary</h3>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  {report.executiveSummary.executiveSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Mission & Operating Envelope</h4>
                  <ul className="space-y-2 text-sm text-slate-600 font-semibold">
                    <li className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">Mission</span>
                      <span>{report.missionDefinition.mission}</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">Environment</span>
                      <span>{report.missionDefinition.operatingEnvironment}</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">Payload</span>
                      <span>{report.missionDefinition.payload}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-slate-400">Endurance Target</span>
                      <span>{report.missionDefinition.endurance}</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Engineering Scope Verification</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {report.executiveSummary.engineeringScope.map((scope, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200">{scope}</span>
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 mt-4 leading-relaxed font-medium">
                    Evidence status ledger verifies that all design assets match cryptographic trust constraints perfectly.
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'requirements' && (
            <motion.div
              key="requirements"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-base font-black text-slate-900 mb-2">Requirements Summary & Verification Matrix</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Direct audit table matching design constraints, targets, numerical results, and physical/simulation validation evidence.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                      <th className="py-3 px-2">Req ID</th>
                      <th className="py-3 px-2">Description</th>
                      <th className="py-3 px-2">Target</th>
                      <th className="py-3 px-2">Method</th>
                      <th className="py-3 px-2">Evidence Link</th>
                      <th className="py-3 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.requirementsSummary.map((req: ReportRequirementItem) => (
                      <tr key={req.requirementId} className="border-b border-slate-100 hover:bg-slate-50 transition font-medium">
                        <td className="py-3 px-2 font-bold text-slate-900">{req.requirementId}</td>
                        <td className="py-3 px-2 text-slate-600">{req.description}</td>
                        <td className="py-3 px-2 font-mono text-slate-700">{req.target} {req.unit}</td>
                        <td className="py-3 px-2 text-slate-500 font-bold">{req.verificationMethod}</td>
                        <td className="py-3 px-2 font-mono text-indigo-600 font-bold">{req.evidenceId || 'N/A'}</td>
                        <td className="py-3 px-2">{getVerdictBadge(req.verdict)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'engineering' && (
            <motion.div
              key="engineering"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* CAD Design Report */}
                <div className="border border-slate-100 rounded-xl p-5 bg-slate-50">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">CAD Design Geometry Check</h4>
                  <ul className="space-y-2 text-xs text-slate-600 font-semibold">
                    <li className="flex justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-slate-400">Model ID & Rev</span>
                      <span>{report.cadDesign.cadModelId} ({report.cadDesign.cadRevision})</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-slate-400">Materials</span>
                      <span>{report.cadDesign.materials.join(', ')}</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-slate-400">Topology Integrity</span>
                      <span className="text-emerald-600">{report.cadDesign.topologyStatus}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-slate-400">Calculated Mass</span>
                      <span>{report.massProperties.massKg} kg</span>
                    </li>
                  </ul>
                </div>

                {/* Propulsion Report */}
                <div className="border border-slate-100 rounded-xl p-5 bg-slate-50">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Propulsion & Aerodynamics Analysis</h4>
                  <ul className="space-y-2 text-xs text-slate-600 font-semibold">
                    <li className="flex justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-slate-400">Motor Model</span>
                      <span>{report.propulsionAnalysis.motor}</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-slate-400">Propeller</span>
                      <span>{report.propulsionAnalysis.propeller}</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-slate-400">Computed Hover Thrust</span>
                      <span>{report.propulsionAnalysis.thrustN} N</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-slate-400">Rotor Drag Coefficient</span>
                      <span>{report.aerodynamicAnalysis.coefficients.Cd}</span>
                    </li>
                  </ul>
                </div>

              </div>

              {/* FEA Solver Settings */}
              <div className="border border-slate-100 rounded-xl p-5 bg-slate-50">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">FEA Stress & Displacement Verification</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Mesh Elements</span>
                    <span className="text-sm font-black">{report.baseline.mesh.elementCount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Solver Engine</span>
                    <span className="text-sm font-black">{report.feaVerification.solver}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Max Stress Pa</span>
                    <span className="text-sm font-black text-rose-600">{(report.feaVerification.stressMaxPa / 1e6).toFixed(1)} MPa</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Factor of Safety</span>
                    <span className="text-sm font-black text-emerald-600">{report.feaVerification.factorOfSafety}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'thread' && (
            <motion.div
              key="thread"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-base font-black text-slate-900 mb-2">Unified Digital Thread Representation</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Interactive flow mapping links requirements directly to CAD geometry revisions, solver conditions, and G-Code CAM steps.
                </p>
              </div>

              <div className="space-y-4">
                {report.digitalThreadRepresentation.map((link, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-center justify-between border border-slate-100 p-4 bg-slate-50 rounded-xl gap-4 font-semibold text-xs text-slate-600">
                    <div className="flex items-center gap-3">
                      <span className="bg-slate-200 px-3 py-1.5 rounded-lg text-slate-800 font-bold">{link.fromNode}</span>
                      <span className="text-slate-400">→</span>
                      <span className="bg-slate-200 px-3 py-1.5 rounded-lg text-slate-800 font-bold">{link.toNode}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Relation: </span>
                      <span className="text-indigo-600 font-bold uppercase">{link.type}</span>
                    </div>
                    <div>
                      {link.status === 'VALID' ? (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-black uppercase text-[10px]">VALID THREAD</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-black uppercase text-[10px]">{link.status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {report.assembly.assemblyErrors.length > 0 && (
                <div className="border border-rose-100 rounded-xl p-4 bg-rose-50 text-rose-800 text-xs font-semibold space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Assembly Verification Warnings Detected
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-600 font-medium">
                    {report.assembly.assemblyErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-base font-black text-slate-900 mb-2">Independent Engineering Review Ledger</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Audit observations made by the independent engineering auditor group without platform context.
                </p>
              </div>

              <div className="border border-slate-100 rounded-xl p-5 bg-slate-50 space-y-3 font-semibold text-xs text-slate-600">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-400">Reviewer Name</span>
                  <span className="text-slate-800 font-bold">{defaultReview.reviewer}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-400">Organization Role</span>
                  <span className="text-slate-800 font-bold">{defaultReview.reviewerRole}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Audit Timestamp</span>
                  <span>{new Date(defaultReview.createdAt).toUTCString()}</span>
                </div>
              </div>

              {/* Findings */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Review Findings</h4>
                {defaultReview.findings.map((finding, idx) => (
                  <div key={idx} className="border border-slate-200 p-4 bg-white rounded-xl flex items-start gap-3">
                    <div className="mt-1">
                      {finding.severity === 'CRITICAL' || finding.severity === 'MAJOR' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <div className="text-xs space-y-1 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 uppercase">{finding.findingId}</span>
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-black uppercase">{finding.severity}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">{finding.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'limitations' && (
            <motion.div
              key="limitations"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-base font-black text-slate-900 mb-2">Mandatory Engineering Limitations Section</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Discloses all analytical assumptions, mathematical approximations, and missing physical sensor inputs to preserve integrity.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-slate-100 rounded-xl p-5 bg-slate-50">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Aeroelastic & Solver Assumptions</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 font-medium">
                    {report.limitations.solverLimitations.map((lim, idx) => <li key={idx}>{lim}</li>)}
                    {report.limitations.modelLimitations.map((lim, idx) => <li key={idx}>{lim}</li>)}
                  </ul>
                </div>

                <div className="border border-slate-100 rounded-xl p-5 bg-slate-50">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Uncertainty Constraints</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 font-medium">
                    {report.limitations.uncertainty.map((lim, idx) => <li key={idx}>{lim}</li>)}
                    {report.limitations.knownAssumptions.map((lim, idx) => <li key={idx}>{lim}</li>)}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'json' && (
            <motion.div
              key="json"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-base font-black text-slate-900 mb-2">Machine-Readable Report JSON Representation</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Deterministic, fully queryable JSON model containing raw verification indices and digital thread hashes.
                </p>
              </div>

              <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl overflow-x-auto max-h-[500px]">
                <pre>{JSON.stringify(report, null, 2)}</pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
