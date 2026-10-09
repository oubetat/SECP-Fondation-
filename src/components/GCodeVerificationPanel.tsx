import React, { useState, useMemo } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileCode, Layers, Activity, Cpu, RefreshCw, Play, RotateCcw, Zap, HelpCircle, Terminal, Crosshair, Sliders, Database } from 'lucide-react';
import { ControllerProfileEngine } from "../engine/manufacturing/post/ControllerProfileEngine";
import { MachineProfileEngine } from "../engine/manufacturing/post/MachineProfileEngine";
import { MachineAxisToolpath } from "../engine/manufacturing/post/types";
import {
  GCodeVerificationAdversarialSuite,
  AdversarialSuiteSummary
} from "../engine/manufacturing/verification/GCodeVerificationAdversarialSuite";
import { GCodeVerifierInstance } from "../engine/manufacturing/verification/GCodeVerifierInstance";
import { HardAcceptanceGate108 } from "../engine/manufacturing/verification/HardAcceptanceGate108";
import {
  FailureClassification,
  GCodeVerificationContract,
  GCodeVerificationReport,
  HardAcceptanceResult108,
  VerificationVerdict
} from "../engine/manufacturing/verification/types";

export const GCodeVerificationPanel: React.FC = () => {
  const machineEngine = useMemo(() => new MachineProfileEngine(), []);
  const controllerEngine = useMemo(() => new ControllerProfileEngine(), []);

  const [selectedMachineId, setSelectedMachineId] = useState<string>("MACHINE_TRUNNION_5AXIS_01");
  const [selectedControllerId, setSelectedControllerId] = useState<string>("FANUC_31i_B5");

  const [activeTab, setActiveTab] = useState<"VERIFIER" | "GATE108" | "ADVERSARIAL" | "MODAL_TRACE" | "TRACEABILITY">("VERIFIER");

  // Sample programs
  const samplePrograms: Record<string, { name: string; description: string; gcode: string }> = {
    valid5Axis: {
      name: "Valid 5-Axis Continuous Program",
      description: "Fully compliant simultaneous 5-axis contouring with proper safe-start and footer",
      gcode: "%\nO1001 (5-AXIS SIMULTANEOUS CONTOUR)\n(SECP CAM GENERATED NC)\nG90 G21 G17 G54\nT1 M06\nS10000 M03\nG00 X0.0000 Y0.0000 Z50.0000 A0.000 C0.000\nG01 X10.0000 Y20.0000 Z0.0000 A10.000 C30.000 F1500.0\nG01 X40.0000 Y20.0000 Z0.0000 A10.000 C60.000 F1500.0\nM05\nM30\n%"
    },
    limitViolation: {
      name: "Adversarial: X-Axis Stroke Overflow",
      description: "Deliberate stroke limit overflow exceeding X-axis physical travel bounds",
      gcode: "%\nO1002 (X LIMIT OVERFLOW TEST)\nG90 G21 G17 G54\nT1 M06\nS10000 M03\nG00 X0.0000 Y0.0000 Z50.0000\nG01 X9999.0000 Y20.0000 Z0.0000 F1500.0 (X EXCEEDS MAX 600MM)\nM05\nM30\n%"
    },
    collisionInjection: {
      name: "Adversarial: Fixture Collision",
      description: "Deliberate plunge into vise clamp clearance envelope",
      gcode: "%\nO1003 (FIXTURE COLLISION TEST)\nG90 G21 G17 G54\nT1 M06\nS10000 M03\nG00 X0.0000 Y0.0000 Z50.0000\nG01 X0.0000 Y-80.0000 Z-25.0000 F1500.0 (PLUNGE INTO CLAMP)\nM05\nM30\n%"
    },
    orphanMotion: {
      name: "Adversarial: Unexpected Extra Motion",
      description: "Unrequested extra motion block introducing toolpath deviation",
      gcode: "%\nO1004 (EXTRA MOTION ORPHAN TEST)\nG90 G21 G17 G54\nT1 M06\nS10000 M03\nG00 X0.0000 Y0.0000 Z50.0000 A0.000 C0.000\nG01 X10.0000 Y20.0000 Z0.0000 A10.000 C30.000 F1500.0\nG01 X40.0000 Y20.0000 Z0.0000 A10.000 C60.000 F1500.0\nG01 X99.0000 Y99.0000 Z10.0000 F1500.0 (ORPHAN UNEXPECTED MOTION)\nM05\nM30\n%"
    }
  };

  const [gcodeText, setGcodeText] = useState<string>(samplePrograms.valid5Axis.gcode);
  const [verificationReport, setVerificationReport] = useState<GCodeVerificationReport | null>(null);
  const [gateResult, setGateResult] = useState<HardAcceptanceResult108 | null>(null);
  const [adversarialSummary, setAdversarialSummary] = useState<AdversarialSuiteSummary | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Removed baselineToolpath implicit state. Must be derived or explicitly loaded.
  const [baselineToolpath, setBaselineToolpath] = useState<MachineAxisToolpath | null>(null);

  const loadReferenceBenchmark = () => {
    setBaselineToolpath({
      toolpathId: "TP_BENCHMARK_REF_01",
      revision: 1,
      machineId: "MACHINE_TRUNNION_5AXIS_01",
      tolerance: 0.005,
      coordinateSystem: "WORK_PIECE",
      provenance: {
        sourceId: "PROV_BENCHMARK_01",
        sourceType: "BENCHMARK" as any,
        reference: "REFERENCE_BENCHMARK: Standard 5-Axis Test",
        timestamp: new Date().toISOString(),
        author: "SECP METROLOGY",
        hash: "0xREF_BENCHMARK"
      },
      points: [
        {
          position: { x: 0, y: 0, z: 50 },
          rotaryAxes: { a: 0, b: 0, c: 0 },
          feedRate: 5000,
          spindleSpeed: 10000,
          spindleDirection: "CW" as any,
          coolantState: { flood: false, mist: false, throughSpindle: false, air: false },
          sequenceNumber: 1,
          toolNumber: 1,
          motionType: "RAPID",
          operationId: "SETUP"
        },
        {
          position: { x: 10, y: 20, z: 0 },
          rotaryAxes: { a: 10, b: 0, c: 30 },
          feedRate: 1500,
          spindleSpeed: 10000,
          spindleDirection: "CW" as any,
          coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
          sequenceNumber: 2,
          toolNumber: 1,
          motionType: "LINEAR",
          operationId: "CONTOUR_1"
        },
        {
          position: { x: 40, y: 20, z: 0 },
          rotaryAxes: { a: 10, b: 0, c: 60 },
          feedRate: 1500,
          spindleSpeed: 10000,
          spindleDirection: "CW" as any,
          coolantState: { flood: true, mist: false, throughSpindle: false, air: false },
          sequenceNumber: 3,
          toolNumber: 1,
          motionType: "LINEAR",
          operationId: "CONTOUR_1"
        }
      ]
    });
  };

  const handleRunVerification = () => {
    if (!baselineToolpath) {
      alert("UNAVAILABLE: No canonical CAM toolpath selected for verification. Load a Reference Benchmark or generate a CAM toolpath first.");
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      const machineProfile = MachineProfileEngine.createStandard5AxisMachineProfile();
      const controllerProfile = ControllerProfileEngine.createFanucLikeProfile();

      const contract: GCodeVerificationContract = {
        verifierId: "VERIFIER_SECP_108",
        verifierRevision: 1,
        ncProgramId: "PROG_LIVE_EVAL",
        ncProgramRevision: 1,
        sourceToolpathId: baselineToolpath.toolpathId,
        machineProfileId: machineProfile.machineId,
        controllerProfileId: controllerProfile.controllerId,
        postProcessorId: "POST_FANUC_5AXIS",
        tolerances: {
          linearPositionToleranceMM: 0.005,
          angularOrientationToleranceDeg: 0.05,
          axisToleranceMM: 0.005,
          rotaryAxisToleranceDeg: 0.05,
          arcRadiusToleranceMM: 0.005,
          chordalErrorToleranceMM: 0.002,
          minimumSafeClearanceMM: 2.0,
          feedTolerancePercent: 2.0,
          spindleToleranceRPM: 20
        },
        collisionPolicy: {
          checkTool: true,
          checkHolder: true,
          checkSpindle: true,
          checkMachineHead: true,
          checkFixture: true,
          checkStock: true,
          checkWorkpiece: true,
          checkKeepOut: true,
          minimumClearanceMM: 2.0
        },
        limitPolicy: {
          enforceLinearStroke: true,
          enforceRotaryRange: true,
          enforceRotaryContinuity: true,
          enforceFeedBounds: true,
          enforceSpindleBounds: true,
          enforceToolChangerCapacity: true
        },
        provenance: {
          sourceId: "PROV_LIVE_VERIFY",
          sourceType: "STANDARD" as any,
          reference: "Live Interactive Verification Run",
          timestamp: new Date().toISOString(),
          author: "Interactive SECP Engineer",
          hash: "0xLIVEVERIFY"
        }
      };

      const verifier = new GCodeVerifierInstance(contract, machineProfile, controllerProfile, baselineToolpath);
      const rep = verifier.verify(gcodeText);
      setVerificationReport(rep);
      setIsVerifying(false);
    }, 150);
  };

  const handleRunGate108 = () => {
    const gate = new HardAcceptanceGate108();
    const result = gate.executeGate();
    setGateResult(result);
  };

  const handleRunAdversarialSuite = () => {
    const suite = new GCodeVerificationAdversarialSuite();
    const summary = suite.runSuite();
    setAdversarialSummary(summary);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  PATCH-108 — G-code Verification Engine
                </h1>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Independent Interpretation ≠ Post Processing · Provable Manufacturing Qualification
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunVerification}
              disabled={isVerifying}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Independent Verification
            </button>
            <button
              onClick={handleRunGate108}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Hard Acceptance Gate 108
            </button>
            <button
              onClick={handleRunAdversarialSuite}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-purple-600/20 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              Adversarial Suite
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 mt-4 gap-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab("VERIFIER")}
            className={`px-4 py-2 border-b-2 font-bold transition ${
              activeTab === "VERIFIER"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            NC Verifier Studio
          </button>
          <button
            onClick={() => setActiveTab("GATE108")}
            className={`px-4 py-2 border-b-2 font-bold transition ${
              activeTab === "GATE108"
                ? "border-blue-500 text-blue-400 bg-blue-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Hard Acceptance Gate (73 Checks)
          </button>
          <button
            onClick={() => setActiveTab("ADVERSARIAL")}
            className={`px-4 py-2 border-b-2 font-bold transition ${
              activeTab === "ADVERSARIAL"
                ? "border-purple-500 text-purple-400 bg-purple-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Adversarial Suite
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === "VERIFIER" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: NC Code Input & Preset Selector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Database className="w-4 h-4 text-indigo-400" />
                  Canonical Toolpath Source
                </span>
                <span className={`text-[10px] font-mono font-bold ${baselineToolpath ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {baselineToolpath ? baselineToolpath.toolpathId : 'NO_CANONICAL_TOOLPATH'}
                </span>
              </div>

              {!baselineToolpath && (
                <div className="p-4 bg-slate-950 border border-slate-800 border-dashed rounded-lg text-center space-y-3">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Verification Context Unavailable</p>
                  <p className="text-[9px] text-slate-600">The verifier requires a canonical CAM toolpath to perform a forensic comparison.</p>
                  <button
                    onClick={loadReferenceBenchmark}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold border border-slate-700 transition"
                  >
                    Load Reference Benchmark Toolpath
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  Target NC / G-code Program
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {gcodeText.split("\n").length} Lines
                </span>
              </div>

              {/* Template Buttons */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-mono uppercase font-bold">Adversarial Scenarios & Presets:</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(samplePrograms).map(([key, p]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setGcodeText(p.gcode);
                        setVerificationReport(null);
                      }}
                      className="p-2 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded text-left transition"
                    >
                      <div className="text-[11px] font-bold text-slate-200 truncate">{p.name}</div>
                      <div className="text-[9px] text-slate-500 truncate">{p.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-mono uppercase font-bold">Raw G-code Input:</label>
                <textarea
                  value={gcodeText}
                  onChange={e => setGcodeText(e.target.value)}
                  className="w-full h-80 bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-300/90 leading-relaxed focus:outline-none focus:border-emerald-500/50 resize-none custom-scrollbar"
                  spellCheck={false}
                />
              </div>

              {/* Action */}
              <button
                onClick={handleRunVerification}
                disabled={isVerifying}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Execute Independent Verification
              </button>
            </div>
          </div>

          {/* Right Column: Verification Results & Forensic Telemetry */}
          <div className="lg:col-span-7 space-y-4">
            {verificationReport ? (
              <div className="space-y-4">
                {/* Scorecard */}
                <div className={`p-5 rounded-xl border ${
                  verificationReport.isQualified
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-200"
                    : "bg-rose-950/20 border-rose-500/40 text-rose-200"
                }`}>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      {verificationReport.isQualified ? (
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      ) : (
                        <XCircle className="w-8 h-8 text-rose-400" />
                      )}
                      <div>
                        <div className="text-lg font-extrabold tracking-wide font-sans">
                          {verificationReport.isQualified ? "MANUFACTURING QUALIFIED" : "VERIFICATION FAILED"}
                        </div>
                        <div className="text-[11px] font-mono opacity-80">
                          Verdict: {verificationReport.overallVerdict} · Execution: {verificationReport.executionTimeMs}ms
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-2xl font-black">
                        {verificationReport.scores.compositeScore.toFixed(1)}%
                      </div>
                      <div className="text-[9px] uppercase tracking-wider opacity-70">
                        Composite Score
                      </div>
                    </div>
                  </div>

                  {/* Score Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-center font-mono text-[10px]">
                    <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
                      <div className="text-slate-400">Position Accuracy</div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5">
                        {verificationReport.scores.positionAccuracyScore.toFixed(0)}%
                      </div>
                    </div>
                    <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
                      <div className="text-slate-400">Orientation Accuracy</div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5">
                        {verificationReport.scores.orientationAccuracyScore.toFixed(0)}%
                      </div>
                    </div>
                    <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
                      <div className="text-slate-400">Machine Limits</div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5">
                        {verificationReport.scores.limitComplianceScore.toFixed(0)}%
                      </div>
                    </div>
                    <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
                      <div className="text-slate-400">Collision Safety</div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5">
                        {verificationReport.scores.collisionSafetyScore.toFixed(0)}%
                      </div>
                    </div>
                    <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
                      <div className="text-slate-400">Traceability</div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5">
                        {verificationReport.scores.traceabilityCoverageScore.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quantitative Metrics */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Quantitative Reconstructed Measurements
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                      <div className="text-[10px] text-slate-500">Max Pos Error:</div>
                      <div className="font-bold text-slate-200">{verificationReport.metrics.maxPositionErrorMM.toFixed(4)} mm</div>
                    </div>
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                      <div className="text-[10px] text-slate-500">RMS Pos Error:</div>
                      <div className="font-bold text-slate-200">{verificationReport.metrics.rmsPositionErrorMM.toFixed(4)} mm</div>
                    </div>
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                      <div className="text-[10px] text-slate-500">Max Ori Error:</div>
                      <div className="font-bold text-slate-200">{verificationReport.metrics.maxOrientationErrorDeg.toFixed(4)}°</div>
                    </div>
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                      <div className="text-[10px] text-slate-500">Total Samples:</div>
                      <div className="font-bold text-slate-200">{verificationReport.metrics.totalSamplesEvaluated}</div>
                    </div>
                  </div>
                  {baselineToolpath?.provenance.sourceType === "BENCHMARK" && (
                    <div className="p-2 bg-purple-900/10 border border-purple-500/20 rounded text-[9px] text-purple-400 font-bold uppercase tracking-tighter text-center">
                      Verification performed against REFERENCE_BENCHMARK
                    </div>
                  )}
                </div>

                {/* Forensic Events Log */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Forensic Events & Diagnostic Log ({verificationReport.forensicEvents.length})
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Fingerprint: {verificationReport.fingerprint.merkleRootHash.slice(0, 18)}...
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {verificationReport.forensicEvents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 font-mono">
                        No critical forensic exceptions detected. G-code adheres to all physical tolerances.
                      </div>
                    ) : (
                      verificationReport.forensicEvents.map(evt => (
                        <div
                          key={evt.eventId}
                          className="p-3 bg-slate-950 border border-rose-900/40 rounded text-xs font-mono space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-rose-400">
                              Line {evt.lineNumber}: {evt.blockId}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-rose-950 text-rose-300 rounded font-bold">
                              {evt.classification}
                            </span>
                          </div>
                          <p className="text-slate-300 text-[11px]">{evt.description}</p>
                          <div className="flex gap-4 text-[10px] text-slate-500">
                            <span>Expected: <strong className="text-slate-400">{String(evt.expected)}</strong></span>
                            <span>Actual: <strong className="text-rose-400">{String(evt.actual)}</strong></span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 space-y-3">
                <ShieldCheck className="w-12 h-12 text-slate-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-400">Verification Pending</h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm">
                    Select a G-code program preset or paste custom NC code on the left and click "Execute Independent Verification".
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hard Acceptance Gate Tab */}
      {activeTab === "GATE108" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-blue-400 flex items-center gap-2 font-mono">
                <CheckCircle2 className="w-5 h-5" /> Hard Acceptance Gate 108 (73-Point Protocol)
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Zero tolerance for unverified motion · Strict deterministic qualification
              </p>
            </div>

            <button
              onClick={handleRunGate108}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              Evaluate Gate 108 Protocol
            </button>
          </div>

          {gateResult ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-blue-500/30 rounded-xl flex items-center justify-between font-mono">
                <div>
                  <div className="text-sm font-bold text-blue-300">
                    Status: {gateResult.passed ? "ALL 73 PROTOCOL CHECKS PASSED" : "GATE FAILED"}
                  </div>
                  <div className="text-xs text-slate-400">
                    Passed: {gateResult.passedChecks} / {gateResult.totalChecks} ({gateResult.scorePercentage.toFixed(1)}%)
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  Merkle Root Hash: <span className="text-blue-400 font-bold">{gateResult.merkleRootHash}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar font-mono text-xs">
                {gateResult.details.map(chk => (
                  <div
                    key={chk.checkId}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-slate-200 text-[11px]">{chk.checkName}</div>
                      <div className="text-[10px] text-slate-500">{chk.evidence}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      chk.status === "PASS"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : "bg-rose-950 text-rose-400 border border-rose-800"
                    }`}>
                      {chk.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              Click "Evaluate Gate 108 Protocol" above to execute all 73 hard gate verifications.
            </div>
          )}
        </div>
      )}

      {/* Adversarial Suite Tab */}
      {activeTab === "ADVERSARIAL" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-purple-400 flex items-center gap-2 font-mono">
                <Zap className="w-5 h-5" /> Adversarial & Negative Test Suite
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Deliberate corruption injections: Syntax, Kinematic, Limit, Collision, and Traceability failure tests
              </p>
            </div>

            <button
              onClick={handleRunAdversarialSuite}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition shadow-lg shadow-purple-600/20 cursor-pointer"
            >
              Run Full Adversarial Suite
            </button>
          </div>

          {adversarialSummary ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-purple-500/30 rounded-xl flex items-center justify-between font-mono">
                <div>
                  <div className="text-sm font-bold text-purple-300">
                    Adversarial Suite: {adversarialSummary.allPassed ? "100% EXCEPTION DETECTION VERIFIED" : "SUITE FAILURE"}
                  </div>
                  <div className="text-xs text-slate-400">
                    Passed: {adversarialSummary.passedTests} / {adversarialSummary.totalTests} Scenarios
                  </div>
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {adversarialSummary.results.map(res => (
                  <div
                    key={res.testId}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-slate-200 flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded">
                          {res.category}
                        </span>
                        {res.testId}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        res.passed ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                      }`}>
                        {res.passed ? "PASS (CORRUPTION CAUGHT)" : "FAIL"}
                      </span>
                    </div>

                    <p className="text-slate-400 text-[11px]">{res.description}</p>
                    <div className="text-[10px] text-slate-500">
                      Evidence: <span className="text-slate-300">{res.forensicEvidence}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              Click "Run Full Adversarial Suite" above to test all injected failure scenarios.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
