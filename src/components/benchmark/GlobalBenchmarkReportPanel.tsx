import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Settings, TrendingUp, AlertTriangle, Scale, Compass, Code, Hash, ExternalLink, Copy, Check, Database, Activity, Cpu, Layers, Lock, HelpCircle, FileSignature, FileCheck, AlertCircle, Clock, ShieldAlert, ArrowRight } from 'lucide-react';
import { 
  GlobalBenchmarkReportGenerator, 
  GlobalBenchmarkIntegrityGate,
  EvidenceConfidence, 
  BenchmarkVerdict, 
  Workload, 
  CompetitorData,
  BenchmarkGap,
  GlobalBenchmarkReport
} from '../../engine/benchmark/GlobalBenchmarkReportEngine';
import { EngineeringTruthCertificationGate } from '../../engine/certification/truth/CertificationFramework';

const REPORT_SOURCES = [
  { id: 'PATCH-171', label: 'CAD Benchmark Battery', group: 'Geometry' },
  { id: 'PATCH-172', label: 'Boolean Adversarial Battery', group: 'Geometry' },
  { id: 'PATCH-173', label: 'GCS Benchmark', group: 'Geometry' },
  { id: 'PATCH-174', label: 'CFD Benchmark', group: 'Simulation' },
  { id: 'PATCH-175', label: 'Conservation Battery', group: 'Simulation' },
  { id: 'PATCH-176', label: 'Turbulence Benchmark', group: 'Simulation' },
  { id: 'PATCH-177', label: 'FEM Benchmark', group: 'Simulation' },
  { id: 'PATCH-178', label: 'Materials Benchmark', group: 'Materials' },
  { id: 'PATCH-179', label: 'CAM Benchmark', group: 'Manufacturing' },
  { id: 'PATCH-180', label: 'Assembly Benchmark', group: 'Geometry' },
  { id: 'PATCH-181', label: 'PLM Benchmark', group: 'Enterprise' },
  { id: 'PATCH-182', label: 'Determinism Benchmark', group: 'Integrity' },
  { id: 'PATCH-183', label: 'Reproducibility Benchmark', group: 'Integrity' },
  { id: 'PATCH-184', label: 'Adversarial Engineering Battery', group: 'Integrity' },
  { id: 'PATCH-185', label: 'External Independent Validation', group: 'External' }
];

export function GlobalBenchmarkReportPanel() {
  const [selectedSource, setSelectedSource] = useState<string>('PATCH-171');
  const [viewMode, setViewMode] = useState<'visual' | 'markdown' | 'json'>('visual');
  const [copied, setCopied] = useState(false);

  // Sandbox simulation settings
  const [sampleSize, setSampleSize] = useState<number>(10);
  const [independentEvidence, setIndependentEvidence] = useState<boolean>(true);
  const [simulateOutliers, setSimulateOutliers] = useState<boolean>(false);
  const [injectVersionMismatch, setInjectVersionMismatch] = useState<boolean>(false);
  const [injectEnvironmentMismatch, setInjectEnvironmentMismatch] = useState<boolean>(false);
  const [tamperCompetitorSource, setTamperCompetitorSource] = useState<boolean>(false);
  const [fairComparison, setFairComparison] = useState<boolean>(true);

  const [activeReport, setActiveReport] = useState<GlobalBenchmarkReport | null>(null);
  const [integrityError, setIntegrityError] = useState<string | null>(null);

  // Re-generate report when state changes
  useEffect(() => {
    try {
      setIntegrityError(null);

      // Base raw measurements
      let rawData = [10.2, 10.8, 9.5, 11.1, 10.4, 9.9, 10.6, 11.2, 10.1, 10.5];
      
      // Trim raw data based on sample size
      rawData = rawData.slice(0, sampleSize);

      if (simulateOutliers && rawData.length > 2) {
        // Inject extreme outlier to trigger statistical warnings
        rawData[rawData.length - 1] = 58.4;
      }

      // Workload definition
      const workload: Workload = {
        workloadId: fairComparison ? "W-SECP-CAD-001" : "W-MISMATCHED-COMP-002",
        inputSize: sampleSize * 100,
        geometryComplexity: 450,
        meshSize: selectedSource === 'PATCH-174' ? 120000 : 0,
        materialCount: 3,
        assemblySize: 1,
        constraintCount: 15,
        solverConfiguration: "EPYC-Parallel-NURBS-v2",
        tolerance: 1e-6,
        iterationLimit: 500,
        hardware: "AMD EPYC 9654",
        runtime: "Node.js v20.10.0",
        datasetVersion: "v1.0"
      };

      // Competitor citation matching
      const competitorMatches: CompetitorData[] = [
        {
          competitorName: "NX",
          metricName: "ExecutionTime",
          value: 14.8,
          unit: "ms",
          source: tamperCompetitorSource ? "" : "National Forensic Metrology Lab Citation #891", // Trigger gate fail if empty
          sourceDate: "2025-11-12",
          version: "v2402",
          configuration: "NURBS Direct Solver",
          workload: "W-SECP-CAD-001",
          measurementMethod: "Core Thread Execution profiler",
          evidenceLevel: EvidenceConfidence.INDEPENDENTLY_VALIDATED
        },
        {
          competitorName: "CATIA",
          metricName: "ExecutionTime",
          value: 12.1,
          unit: "ms",
          source: "European Assembly Integrity Audit v4",
          sourceDate: "2026-02-01",
          version: "V6R2024",
          configuration: "Parasolid Core Kernel",
          workload: "W-SECP-CAD-001",
          measurementMethod: "Direct Microkernel Timer",
          evidenceLevel: EvidenceConfidence.REPRODUCIBLE
        }
      ];

      // Custom gaps
      const customGaps: BenchmarkGap[] = [];
      if (injectVersionMismatch) {
        customGaps.push({
          type: "VERSION_MISMATCH",
          capability: selectedSource,
          description: "Execution solver core version does not align with active benchmark layout.",
          severity: "WARNING"
        });
      }
      if (injectEnvironmentMismatch) {
        customGaps.push({
          type: "ENVIRONMENT_MISMATCH",
          capability: selectedSource,
          description: "Environment host runs on virtualised container layer instead of dedicated hardware target.",
          severity: "INFO"
        });
      }

      // Historic comparison (for regression analysis)
      const historicMetrics = {
        numericalError: 0.0001,
        geometricError: 0.0001,
        conservationError: 0.0001,
        constraintError: 0.0001,
        topologicalError: 0,
        executionTime: 4.8, // extremely fast, will trigger regression since mean is around 10.4ms
        throughput: 200,
        latency: 4.8,
        memoryUsage: 120,
        scalingEfficiency: 96,
        failureRate: 0.1,
        recoveryRate: 99.9,
        convergenceRate: 99.5,
        adversarialSurvivalRate: 98,
        runToRunDifference: 0.5,
        deterministicMatchRate: 100,
        crossEnvironmentVariation: 0.1,
        geometryFidelity: 99.9,
        meshFidelity: 99.9,
        solverFidelity: 99.9,
        manufacturingFidelity: 99.9,
        dataIntegrity: 100
      };

      const sourceRecord = REPORT_SOURCES.find(s => s.id === selectedSource);
      const capabilityName = sourceRecord ? sourceRecord.label.split(' ')[0] : 'CAD';

      const report = GlobalBenchmarkReportGenerator.generateReport(capabilityName, {
        suite: `${sourceRecord?.label || 'Core'} Global Benchmark`,
        rawResults: rawData,
        workload,
        competitorMatches,
        previousMetrics: historicMetrics,
        independentEvidence,
        patchSourceId: selectedSource,
        customGaps
      });

      setActiveReport(report);
    } catch (err: any) {
      setIntegrityError(err.message || "An unexpected validation or integrity error has occurred.");
      setActiveReport(null);
    }
  }, [
    selectedSource, 
    sampleSize, 
    independentEvidence, 
    simulateOutliers, 
    injectVersionMismatch, 
    injectEnvironmentMismatch, 
    tamperCompetitorSource,
    fairComparison
  ]);

  const copyToClipboard = () => {
    if (!activeReport) return;
    const mdText = GlobalBenchmarkReportGenerator.generateMarkdown(activeReport);
    navigator.clipboard.writeText(mdText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getVerdictStyles = (verdict?: BenchmarkVerdict) => {
    switch (verdict) {
      case BenchmarkVerdict.QUALIFIED:
      case BenchmarkVerdict.PASS:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case BenchmarkVerdict.PARTIAL:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case BenchmarkVerdict.SIMULATED:
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case BenchmarkVerdict.FAIL:
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-bold';
      case BenchmarkVerdict.UNPROVEN:
      case BenchmarkVerdict.INCONCLUSIVE:
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100 max-w-7xl mx-auto w-full">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Compass className="w-6 h-6 text-emerald-400" />
            PATCH-187 — Global Benchmark Report Engine
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Neutral, evidence-driven benchmarking. Reconstruct reports deterministically with anti-marketing integrity gates and comprehensive statistical qualification.
          </p>
        </div>
        
        {/* Toggle view tabs */}
        <div className="flex bg-slate-900/60 p-1 rounded-lg border border-slate-800">
          {(['visual', 'markdown', 'json'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${
                viewMode === mode 
                  ? 'bg-slate-800 text-slate-100 shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar sources & parameters selector (3/12 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Sources list */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-850">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block font-bold">Benchmark Sources</span>
            </div>
            <div className="p-2 space-y-1 max-h-[350px] overflow-y-auto">
              {REPORT_SOURCES.map(source => {
                const isSelected = selectedSource === source.id;
                return (
                  <button
                    key={source.id}
                    onClick={() => setSelectedSource(source.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between ${
                      isSelected 
                        ? 'bg-slate-800 text-slate-100 font-bold border-l-2 border-emerald-500' 
                        : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <span>{source.label}</span>
                    <span className="text-[9px] font-mono opacity-60 bg-slate-950 px-1.5 py-0.5 rounded">{source.id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sandbox Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-850 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block font-bold">Simulation Controls</span>
            </div>
            <div className="p-4 space-y-4">
              
              {/* Sample Size Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Sample Count (Runs)</span>
                  <span className="font-mono text-emerald-400 font-bold">{sampleSize}</span>
                </div>
                <input 
                  type="range"
                  min="1"
                  max="10"
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                {sampleSize < 5 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Sparse sample size triggers statistical warnings.</span>
                  </div>
                )}
              </div>

              {/* Independent verification */}
              <label className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:bg-slate-850 transition-all">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold block text-slate-300">Independent Proofs</span>
                  <span className="text-[9px] text-slate-500 font-mono">PATCH-185 linked evidence</span>
                </div>
                <input 
                  type="checkbox"
                  checked={independentEvidence}
                  onChange={(e) => setIndependentEvidence(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
              </label>

              {/* Simulate extreme outliers */}
              <label className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:bg-slate-850 transition-all">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold block text-slate-300">Inject Outliers</span>
                  <span className="text-[9px] text-slate-500 font-mono">Simulates noisy hardware runs</span>
                </div>
                <input 
                  type="checkbox"
                  checked={simulateOutliers}
                  onChange={(e) => setSimulateOutliers(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
              </label>

              {/* Fair comparison toggle */}
              <label className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:bg-slate-850 transition-all">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold block text-slate-300">Fair Comparison</span>
                  <span className="text-[9px] text-slate-500 font-mono">Ensure same workloads are used</span>
                </div>
                <input 
                  type="checkbox"
                  checked={fairComparison}
                  onChange={(e) => setFairComparison(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
              </label>

              {/* Mismatch triggers */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Inject Audit Errors</span>
                
                <label className="flex items-center justify-between p-2 bg-slate-950/40 border border-slate-850 rounded-lg cursor-pointer hover:bg-slate-850 transition-all">
                  <span className="text-[11px] text-slate-400">Version Mismatch</span>
                  <input 
                    type="checkbox"
                    checked={injectVersionMismatch}
                    onChange={(e) => setInjectVersionMismatch(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-600 w-3.5 h-3.5"
                  />
                </label>

                <label className="flex items-center justify-between p-2 bg-slate-950/40 border border-slate-850 rounded-lg cursor-pointer hover:bg-slate-850 transition-all">
                  <span className="text-[11px] text-slate-400">Environment Shift</span>
                  <input 
                    type="checkbox"
                    checked={injectEnvironmentMismatch}
                    onChange={(e) => setInjectEnvironmentMismatch(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-600 w-3.5 h-3.5"
                  />
                </label>

                <label className="flex items-center justify-between p-2 bg-rose-950/10 border border-rose-900/20 rounded-lg cursor-pointer hover:bg-rose-950/20 transition-all">
                  <span className="text-[11px] text-rose-400 font-bold">Tamper Competitor Data</span>
                  <input 
                    type="checkbox"
                    checked={tamperCompetitorSource}
                    onChange={(e) => setTamperCompetitorSource(e.target.checked)}
                    className="rounded border-rose-900 bg-slate-900 text-rose-600 w-3.5 h-3.5"
                  />
                </label>
              </div>

            </div>
          </div>
        </div>

        {/* Report visual panel & details (9/12 cols) */}
        <div className="lg:col-span-9 space-y-6">
          <AnimatePresence mode="wait">
            {integrityError ? (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="p-6 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-4"
              >
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-6 h-6 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider">INTEGRITY GATE FAILURE</h3>
                    <p className="text-xs text-rose-300/80 leading-relaxed">
                      The GlobalBenchmarkIntegrityGate has blocked compilation of this benchmark report. Under formal rules of SECP, promotional exaggerations or fraudulent comparative statements are outright rejected.
                    </p>
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider mb-2">Gate Assertions Tripped:</span>
                  <p className="text-xs font-mono text-rose-400 leading-relaxed">{integrityError}</p>
                </div>
              </motion.div>
            ) : activeReport ? (
              <motion.div
                key={selectedSource + viewMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {viewMode === 'visual' && (
                  <>
                    {/* Upper row metrics summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Metric 1: Verdict */}
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between h-28">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Benchmark Verdict</span>
                        <div className="space-y-1 mt-2">
                          <span className={`text-sm px-3 py-1 rounded-full border inline-block ${getVerdictStyles(activeReport.Verdict)}`}>
                            {activeReport.Verdict}
                          </span>
                          <span className="text-[9px] block text-slate-400 mt-1">{activeReport.Workload.workloadId}</span>
                        </div>
                      </div>

                      {/* Metric 2: Capability Score */}
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between h-28">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Overall Evidence Score</span>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-slate-100">{activeReport.Score.aggregateScore}</span>
                          <span className="text-xs text-slate-500">/ 100</span>
                        </div>
                      </div>

                      {/* Metric 3: Stat Mean Latency */}
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between h-28">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Execution Mean</span>
                        <div className="mt-2">
                          <span className="text-xl font-mono font-bold text-slate-100">{activeReport.StatisticalAnalysis.mean.toFixed(2)} ms</span>
                          <span className="text-[9px] block text-slate-500 mt-0.5">S.D. ±{activeReport.StatisticalAnalysis.standardDeviation.toFixed(2)}ms</span>
                        </div>
                      </div>

                      {/* Metric 4: Independent verification */}
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between h-28">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Independent Validation</span>
                        <div className="mt-2 space-y-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded border inline-block font-bold ${
                            activeReport.IndependentValidationStatus === 'EXTERNALLY_VALIDATED' 
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {activeReport.IndependentValidationStatus}
                          </span>
                          <span className="text-[9px] block text-slate-500">PATCH-185 verification</span>
                        </div>
                      </div>
                    </div>

                    {/* Scorecard distribution row */}
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-xs font-bold uppercase text-slate-300">Forensic Evidence Profile Scorecard</span>
                        <span className="text-[10px] font-mono text-slate-500">Aggregate weighted algorithm</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        {[
                          { label: 'Implementation', val: activeReport.Score.implementation, weight: '10%' },
                          { label: 'Verification', val: activeReport.Score.verification, weight: '20%' },
                          { label: 'Benchmark', val: activeReport.Score.benchmark, weight: '25%' },
                          { label: 'Adversarial', val: activeReport.Score.adversarial, weight: '20%' },
                          { label: 'Reproducibility', val: activeReport.Score.reproducibility, weight: '15%' },
                          { label: 'Ind. Validation', val: activeReport.Score.independentValidation, weight: '10%' }
                        ].map((s, idx) => (
                          <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col justify-between h-20">
                            <span className="text-[9px] text-slate-500 block">{s.label} <span className="text-[8px] opacity-60">({s.weight})</span></span>
                            <div className="space-y-1">
                              <span className="text-sm font-bold font-mono text-emerald-400">{s.val}%</span>
                              <div className="w-full h-1 bg-slate-800 rounded overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded" style={{ width: `${s.val}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Statistical details and scaling distribution */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      
                      {/* Left: Stats Panel (6/12) */}
                      <div className="md:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
                        <span className="text-xs font-bold uppercase text-slate-300 block">Statistical Calibration Distribution</span>
                        <div className="space-y-3 font-mono text-xs">
                          <div className="flex justify-between p-2.5 bg-slate-950 rounded border border-slate-850">
                            <span className="text-slate-500">Total Run Count:</span>
                            <span className="text-slate-300 font-bold">{activeReport.StatisticalAnalysis.runCount} isolated runs</span>
                          </div>
                          <div className="flex justify-between p-2.5 bg-slate-950 rounded border border-slate-850">
                            <span className="text-slate-500">Median Latency:</span>
                            <span className="text-slate-300">{activeReport.StatisticalAnalysis.median.toFixed(2)} ms</span>
                          </div>
                          <div className="flex justify-between p-2.5 bg-slate-950 rounded border border-slate-850">
                            <span className="text-slate-500">95th Percentile (P95):</span>
                            <span className="text-slate-300">{activeReport.StatisticalAnalysis.p95.toFixed(2)} ms</span>
                          </div>
                          <div className="flex justify-between p-2.5 bg-slate-950 rounded border border-slate-850">
                            <span className="text-slate-500">95% Confidence Interval:</span>
                            <span className="text-indigo-400">[{activeReport.StatisticalAnalysis.confidenceInterval[0].toFixed(2)}, {activeReport.StatisticalAnalysis.confidenceInterval[1].toFixed(2)}] ms</span>
                          </div>
                          <div className="flex justify-between p-2.5 bg-slate-950 rounded border border-slate-850">
                            <span className="text-slate-500">Outliers Detected:</span>
                            <span className={activeReport.StatisticalAnalysis.outlierDetection ? "text-amber-400 font-bold" : "text-slate-500"}>
                              {activeReport.StatisticalAnalysis.outlierDetection ? "YES" : "NO"}
                            </span>
                          </div>
                        </div>

                        {/* Custom Visual Sparkline */}
                        <div className="space-y-2 pt-2">
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">Execution Trend Map</span>
                          <div className="h-10 bg-slate-950 rounded border border-slate-850 flex items-end p-2 gap-1 justify-around">
                            {activeReport.StatisticalAnalysis.rawMeasurements.map((v, i) => (
                              <div 
                                key={i} 
                                className={`w-4 bg-emerald-500/60 hover:bg-emerald-400 rounded-sm cursor-pointer transition-all ${
                                  v > activeReport.StatisticalAnalysis.mean * 2.5 ? 'bg-rose-500/60' : ''
                                }`} 
                                style={{ height: `${Math.min(100, (v / 60) * 100)}%` }}
                                title={`${v.toFixed(2)} ms`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Scaling analysis (6/12) */}
                      <div className="md:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
                        <span className="text-xs font-bold uppercase text-slate-300 block">Scaling Efficiency Benchmarking</span>
                        <div className="space-y-3">
                          {activeReport.ScalingAnalysis.map((pt, i) => (
                            <div key={i} className="p-3 bg-slate-950 rounded-lg border border-slate-850 text-xs font-mono">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-200">Workload Size: {pt.workloadSizeLabel}</span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                                  pt.confidence === EvidenceConfidence.DIRECTLY_MEASURED ? 'bg-emerald-500/10 text-emerald-400' :
                                  pt.confidence === EvidenceConfidence.MODEL_DERIVED ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {pt.confidence}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 mt-2">
                                <div>Latency: <span className="text-slate-300">{pt.executionTime.toFixed(1)} ms</span></div>
                                <div>Memory: <span className="text-slate-300">{pt.memoryMb.toFixed(1)} MB</span></div>
                                <div>Efficiency: <span className="text-indigo-400">{pt.scalingEfficiency}%</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Competitor Comparisons row */}
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-xs font-bold uppercase text-slate-300">Fair Competitive Assessment Matrix</span>
                        <span className="text-[10px] font-mono text-slate-500">Subject to strict verification guidelines</span>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-slate-850 text-slate-500 uppercase text-[9px] tracking-wider">
                              <th className="pb-3">Competitor</th>
                              <th className="pb-3">Metric</th>
                              <th className="pb-3">Competitor Value</th>
                              <th className="pb-3">SECP Value</th>
                              <th className="pb-3 text-center">Ratio</th>
                              <th className="pb-3 text-right">Verdict</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeReport.ComparisonResults.map((comp, idx) => (
                              <tr key={idx} className="border-b border-slate-850/40 hover:bg-slate-850/20">
                                <td className="py-4 font-bold text-slate-200">{comp.competitor}</td>
                                <td className="py-4 text-slate-400">{comp.metricName}</td>
                                <td className="py-4 text-slate-300">14.8 ms</td>
                                <td className="py-4 text-slate-300">{activeReport.StatisticalAnalysis.mean.toFixed(2)} ms</td>
                                <td className="py-4 text-center text-indigo-400">{comp.ratio.toFixed(2)}x</td>
                                <td className="py-4 text-right">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    comp.verdict === 'PROVEN_SUPERIOR' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                    comp.verdict === 'NOT_COMPARABLE' ? 'bg-slate-850 text-slate-500 border-slate-800' : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {comp.verdict}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Gaps, Warnings, and Limitations panel */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Left: Gaps & Audit trails (6/12) */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
                        <span className="text-xs font-bold uppercase text-slate-300 block">Identified Benchmark Gaps</span>
                        {activeReport.Gaps.length === 0 ? (
                          <div className="p-4 bg-slate-950 rounded-lg text-xs text-slate-400 text-center">
                            No benchmark gaps or omissions detected. Full evidence package complete.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {activeReport.Gaps.map((gap, i) => (
                              <div key={i} className="p-3 bg-slate-950 rounded-lg border border-slate-850 flex items-start gap-2.5">
                                <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                  gap.severity === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'
                                }`} />
                                <div className="space-y-1 text-xs font-mono">
                                  <div className="flex justify-between">
                                    <span className="font-bold text-slate-300">{gap.type}</span>
                                    <span className="text-[8px] opacity-60 uppercase">{gap.severity}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 leading-relaxed">{gap.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Regressions Tracker (6/12) */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
                        <span className="text-xs font-bold uppercase text-slate-300 block">Performance Regression Detection</span>
                        {activeReport.Regressions.length === 0 ? (
                          <div className="p-4 bg-slate-950 rounded-lg text-xs text-slate-400 text-center">
                            No performance or accuracy regressions detected relative to historical databases.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {activeReport.Regressions.map((reg, i) => (
                              <div key={i} className="p-3 bg-rose-950/10 rounded-lg border border-rose-500/20 flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                                <div className="space-y-1 text-xs font-mono">
                                  <div className="flex justify-between">
                                    <span className="font-bold text-rose-400">{reg.regressionType} REGRESSION</span>
                                    <span className="text-rose-300 font-bold">+{reg.deltaPercent.toFixed(1)}% slowdown</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 leading-relaxed">
                                    Baseline execution rose from {reg.previousValue.toFixed(2)}ms to {reg.currentValue.toFixed(2)}ms. Cause tracked back to active {reg.causativePatch}.
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Hashes & Attestation details */}
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
                      <span className="text-xs font-bold uppercase text-slate-300 block">Cryptographic Hash Audit Trail</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                          <span className="text-[10px] text-slate-500 block">INPUT DATASET SCHEMATIC HASH</span>
                          <span className="text-indigo-400 text-[10px] block break-all">{activeReport.InputHash}</span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                          <span className="text-[10px] text-slate-500 block">CANONICAL GLOBAL REPORT HASH</span>
                          <span className="text-emerald-400 text-[10px] block break-all">{activeReport.ReportHash}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {viewMode === 'markdown' && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-300">Markdown Verification Format</span>
                      <button
                        onClick={copyToClipboard}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all text-slate-300"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy Report'}
                      </button>
                    </div>
                    <div className="p-6 bg-slate-950 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto leading-relaxed">
                      <pre className="whitespace-pre-wrap text-slate-300 select-all">
                        {GlobalBenchmarkReportGenerator.generateMarkdown(activeReport)}
                      </pre>
                    </div>
                  </div>
                )}

                {viewMode === 'json' && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800 bg-slate-850 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-slate-300">RAW REPORT JSON MANIFEST</span>
                    </div>
                    <div className="p-6 bg-slate-950 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                      <pre className="text-slate-300 whitespace-pre">
                        {JSON.stringify(activeReport, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

              </motion.div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-600 bg-slate-900 border border-slate-800 rounded-xl">
                <Compass className="w-8 h-8 animate-spin mb-2" />
                <span className="text-xs font-mono">Loading report manifest context...</span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
