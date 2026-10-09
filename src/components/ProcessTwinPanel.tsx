import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Flame,
  Play,
  Pause,
  RefreshCw,
  Gauge,
  Zap,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Network,
  Clock,
  Award,
  Layers,
  ChevronRight,
  Maximize2,
  AlertOctagon,
  CornerDownRight,
  Compass,
  Sliders,
  Settings,
  Shield,
  Binary,
  Link,
  Coins,
  ShieldAlert as ShieldX,
  Shuffle,
  RefreshCw as ResetIcon,
  Search,
  Check,
  X,
  FileCode,
  CheckSquare
} from 'lucide-react';
import { HardAcceptanceGate328, HardAcceptanceGate328Report } from '../engine/digital_twin/HardAcceptanceGate328';
import { EvidenceBus314 } from '../engine/engineering_ai/copilot/EvidenceBus314';
import {
  ProcessFeasibilityChecker,
  ProcessChangeImpactAnalyzer,
  ProcessTwinStateTransitions,
  ProcessLifecycleState,
  ProcessType,
  ParameterProvenance
} from '../engine/digital_twin/ProcessTwinEngine';

export const ProcessTwinPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'feasibility' | 'gate'>('overview');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [currentOpIndex, setCurrentOpIndex] = useState<number>(0);
  const [lifecycleState, setLifecycleState] = useState<ProcessLifecycleState>('READY');
  const [activeAnomaly, setActiveAnomaly] = useState<'NONE' | 'SPINDLE_CHATTER' | 'COOLANT_FAILURE' | 'HARDNESS_SPIKE' | 'TOOL_WEAR'>('NONE');
  const [gateReport, setGateReport] = useState<HardAcceptanceGate328Report>(() => HardAcceptanceGate328.runGate());
  const [isReevaluating, setIsReevaluating] = useState<boolean>(false);
  const [gateLogs, setGateLogs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPassed, setFilterPassed] = useState<'all' | 'pass' | 'fail'>('all');

  // Input bindings
  const [spindleSpeedOverride, setSpindleSpeedOverride] = useState<number | null>(null);
  const [feedRateOverride, setFeedRateOverride] = useState<number | null>(null);
  const [ecoRequired, setEcoRequired] = useState<boolean>(false);
  const [approvalWorkflowState, setApprovalWorkflowState] = useState<'APPROVED' | 'PENDING' | 'REJECTED'>('APPROVED');

  // Operational sequence definition
  const operations = [
    { id: 'OP10', number: 'OP10', type: 'MILLING' as ProcessType, name: 'Facing Pre-calibration', sequence: 10, duration: '2 mins', tool: 'T-FACEMILL-50', machine: 'MAC-TWIN-327' },
    { id: 'OP20', number: 'OP20', type: 'MILLING' as ProcessType, name: 'Rough Contour Removal', sequence: 20, duration: '8 mins', tool: 'T-BALL-06', machine: 'MAC-TWIN-327' },
    { id: 'OP30', number: 'OP30', type: 'MILLING' as ProcessType, name: 'Finish Flute Polishing', sequence: 30, duration: '6 mins', tool: 'T-FINISH-04', machine: 'MAC-TWIN-327' },
    { id: 'OP40', number: 'OP40', type: 'INSPECTION' as ProcessType, name: 'CMM Dimensional Inspection', sequence: 40, duration: '4 mins', tool: 'T-PROBE-01', machine: 'MAC-TWIN-327' }
  ];

  // Dynamic state representation
  const [processStats, setProcessStats] = useState({
    actualCycleTimeSec: 0,
    actualEnergyKwh: 0,
    estimatedToolWear: null as number | null,
    scrapRatePercent: 0,
    vibrationG: null as number | null,
    spindleLoad: null as number | null,
    coolantPressureBar: null as number | null,
    actualSpindleSpeed: null as number | null,
    actualFeedRate: null as number | null,
    defectDetected: false,
    qualityResult: 'PASS' as 'PASS' | 'FAIL' | 'WARNING' | 'REWORK' | 'SCRAP'
  });

  const [logs, setLogs] = useState<Array<{ time: string; msg: string; severity: 'INFO' | 'WARN' | 'ALARM' | 'SUCCESS' }>>([
    { time: '12:00:00', msg: 'Process Twin Engine loaded. Standard plan for Turbine Blade REV-B linked.', severity: 'INFO' },
    { time: '12:00:15', msg: 'All 4 kinematic operations validated. Operations boundaries registered.', severity: 'SUCCESS' },
    { time: '12:00:30', msg: 'Resource Bindings complete: Machine MAC-TWIN-327, Tool T-BALL-06, Fixture FIXT-HYD-42.', severity: 'INFO' }
  ]);

  // Simulation execution loop
  useEffect(() => {
    if (!isExecuting) return;

    setLifecycleState('RUNNING');
    const interval = setInterval(() => {
      setProcessStats(prev => {
        let cycleDelta = 2;
        let energyDelta = 0.015;
        const t = prev.actualCycleTimeSec + cycleDelta;

        // Apply anomaly drifts
        let vibeNoise = 0.10 + Math.abs(Math.sin(t * 0.4)) * 0.05;
        let tempLoad = 30.0 + Math.abs(Math.cos(t * 0.2)) * 5.0;
        let coolantPressure = 0;
        if (isSystemActive) {
           coolantPressure = 18.0 + Math.sin(t * 0.1) * 0.8;
        }
        let toolWearDelta = 0.0001;
        let defect = false;
        let quality: 'PASS' | 'FAIL' | 'WARNING' | 'REWORK' | 'SCRAP' = 'PASS';

        if (activeAnomaly === 'SPINDLE_CHATTER') {
          vibeNoise += 2.40; // High vibrational chatter
          tempLoad += 25.0;
          defect = true;
          quality = 'REWORK';
        } else if (activeAnomaly === 'COOLANT_FAILURE') {
          coolantPressure = 0.5; // Pressure drop
          tempLoad += 40.0;
          vibeNoise += 0.8;
          defect = true;
          quality = 'SCRAP';
        } else if (activeAnomaly === 'HARDNESS_SPIKE') {
          tempLoad += 35.0;
          vibeNoise += 0.35;
          toolWearDelta = 0.002; // Fast degradation
        } else if (activeAnomaly === 'TOOL_WEAR') {
          toolWearDelta = 0.008;
          vibeNoise += 0.6;
          defect = true;
          quality = 'WARNING';
        }

        // Increment op progress or loop
        let nextOpIndex = currentOpIndex;
        if (prev.actualCycleTimeSec % 20 === 0 && prev.actualCycleTimeSec > 0) {
          if (currentOpIndex < operations.length - 1) {
            nextOpIndex = currentOpIndex + 1;
            setCurrentOpIndex(nextOpIndex);
            pushLog(`OPERATION_COMPLETED: Finished ${operations[currentOpIndex].number}. Initiating next routing step...`, 'SUCCESS');
            pushLog(`OPERATION_STARTED: Moving cutter head for sequence ${operations[nextOpIndex].number}...`, 'INFO');
          } else {
            // Process completed
            setIsExecuting(false);
            setLifecycleState('COMPLETED');
            pushLog('PROCESS_COMPLETED: End-to-end routing successfully accomplished. Metric outputs exported.', 'SUCCESS');
            clearInterval(interval);
          }
        }

        return {
          ...prev,
          actualCycleTimeSec: prev.actualCycleTimeSec + cycleDelta,
          actualEnergyKwh: Number((prev.actualEnergyKwh + energyDelta).toFixed(3)),
          estimatedToolWear: Number(((prev.estimatedToolWear ?? 0) + toolWearDelta).toFixed(5)),
          vibrationG: Number(vibeNoise.toFixed(2)),
          spindleLoad: Number(tempLoad.toFixed(1)),
          coolantPressureBar: Number(coolantPressure.toFixed(1)),
          actualSpindleSpeed: Math.max(0, Math.floor((spindleSpeedOverride ?? 0) + (Math.sin(t * 0.7) * 20))),
          actualFeedRate: Math.max(0, Math.floor((feedRateOverride ?? 0) + (Math.cos(t * 0.5) * 5))),
          defectDetected: defect,
          qualityResult: quality
        };
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isExecuting, currentOpIndex, activeAnomaly, spindleSpeedOverride, feedRateOverride]);

  const pushLog = (msg: string, severity: 'INFO' | 'WARN' | 'ALARM' | 'SUCCESS') => {
    const timeStr = new Date().toLocaleTimeString();
    setLogs(prev => [{ time: timeStr, msg, severity }, ...prev].slice(0, 20));
  };

  // Event handlers for anomalies
  useEffect(() => {
    if (activeAnomaly === 'NONE') return;
    pushLog(`ALERT: Injecting failure condition -> ${activeAnomaly}. Telemetry context updated.`, 'ALARM');
    if (activeAnomaly === 'COOLANT_FAILURE') {
      pushLog('PROCESS_PARAMETER_DEVIATION: Coolant pressure below 2.0 bar minimum window safety threshold!', 'ALARM');
    } else if (activeAnomaly === 'SPINDLE_CHATTER') {
      pushLog('PROCESS_PARAMETER_DEVIATION: Harmonic spindle chatter detected on accelerometer channel!', 'ALARM');
    }
  }, [activeAnomaly]);

  const handleResolveAnomaly = () => {
    setActiveAnomaly('NONE');
    setProcessStats(prev => ({
      ...prev,
      vibrationG: 0.12,
      spindleLoad: 32.5,
      coolantPressureBar: 18.2,
      defectDetected: false,
      qualityResult: 'PASS'
    }));
    pushLog('RESOLVE: Reset cutting variables, restored coolant feed pressure, and cleared alerts.', 'SUCCESS');
  };

  const handleRunAcceptanceGate = () => {
    setIsReevaluating(true);
    setGateLogs([]);
    let logsAccumulator: string[] = [];

    const steps = [
      'Scanning process plan metadata definitions...',
      'Mapping tool offsets and dynamic fixture clamping states...',
      'Retrieving registered certificates from Evidence Bus 314...',
      'Evaluating Operation Dependency sequence rules (OP10 -> OP20 -> OP30 -> OP40)...',
      'Checking parameter bounds and out-of-window telemetry safety...',
      'Performing change impact risk modeling for ECO validation...',
      'Verifying simulated-vs-actual data isolation (No Simulation-as-Reality errors)...',
      'Finalizing acceptance matrix...'
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        logsAccumulator.push(`[SYSTEM_CHECK] ${steps[stepIdx]}`);
        setGateLogs([...logsAccumulator]);
        stepIdx++;
      } else {
        clearInterval(interval);
        const report = HardAcceptanceGate328.runGate();
        setGateReport(report);
        setIsReevaluating(false);
      }
    }, 400);
  };

  // Check Parameter change impact for ECO
  const handleParameterChange = (speed: number, feed: number) => {
    setSpindleSpeedOverride(speed);
    setFeedRateOverride(feed);

    // Run Analyzer
    const analysis = ProcessChangeImpactAnalyzer.analyzeChange(
      { SpindleSpeed: 12000, FeedRate: 3200 },
      { SpindleSpeed: speed, FeedRate: feed },
      {
        tool: { toolId: 'T-BALL-06', toolRevision: 'v1.0', toolAssembly: 'ASSY-01', toolOffset: { xOffsetMm: 0, zOffsetMm: 0, radiusMm: 3 } },
        machine: { machineId: 'MAC-327', machineRevision: 'v1', configurationRevision: 'c1', kinematicRevision: 'k1', controllerRevision: 'f1' }
      }
    );

    if (analysis.ecoWorkflowRequired) {
      setEcoRequired(true);
      setApprovalWorkflowState('PENDING');
      pushLog(`WARN: Large parameter modification detected. High Impact Risk. Initiating formal ECO workflow validation.`, 'WARN');
    } else {
      setEcoRequired(false);
      setApprovalWorkflowState('APPROVED');
      pushLog(`INFO: Parameters updated inside standard safe boundaries. Approval status remains VALID.`, 'INFO');
    }
  };

  const handleApproveECO = () => {
    setApprovalWorkflowState('APPROVED');
    setEcoRequired(false);
    pushLog('SUCCESS: ECO reviewed and cryptographically signed by engineering authority. New process revision is approved.', 'SUCCESS');
  };

  // Filtered assertion list
  const filteredAssertions = (gateReport?.details || []).filter(item => {
    const itemStr = typeof item === 'string' ? item : (item?.name || item?.id || JSON.stringify(item) || '');
    const textMatches = itemStr.toLowerCase().includes(searchQuery.toLowerCase());
    const isPass = typeof item === 'string' ? item.startsWith('[PASS]') : (item?.passed ?? item?.status === 'PASS');
    if (filterPassed === 'pass' && !isPass) return false;
    if (filterPassed === 'fail' && isPass) return false;
    return textMatches;
  });

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6" id="process-digital-twin-root">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight">Process Digital Twin Engine</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-full">
              PATCH-328
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Traceable digital representation of actual industrial manufacturing processes. Bridges design, physical plan, machine context, actual telemetry, and metrology evidence.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Process Overview
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'telemetry' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Actual Telemetry
          </button>
          <button
            onClick={() => setActiveTab('feasibility')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'feasibility' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Feasibility Checker
          </button>
          <button
            onClick={() => setActiveTab('gate')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'gate' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Acceptance Gate ({gateReport.passedCount}/128)
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline and Live Tracker */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Status Ribbon bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-850">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500">Twin Context Status</span>
                <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${isExecuting ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {lifecycleState}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500">Maturity Level</span>
                <div className="text-sm font-bold text-indigo-400 mt-0.5 flex items-center gap-1">
                  <Award className="w-4 h-4 text-indigo-400" />
                  LEVEL 5 (Validated)
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500">Active Operation</span>
                <div className="text-sm font-bold text-slate-200 mt-0.5 font-mono">
                  {operations[currentOpIndex].number} ({operations[currentOpIndex].type})
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500">Actual Cycle Time</span>
                <div className="text-sm font-bold text-slate-200 mt-0.5 font-mono">
                  {Math.floor(processStats.actualCycleTimeSec / 60)}m {processStats.actualCycleTimeSec % 60}s
                </div>
              </div>
            </div>

            {/* Industrial Sequence Plan Visualization */}
            <div className="bg-slate-950 rounded-xl border border-slate-850 p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Operation Sequential Plan & Dependencies
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                {operations.map((op, idx) => {
                  const isActive = currentOpIndex === idx;
                  const isCompleted = idx < currentOpIndex;
                  const isPending = idx > currentOpIndex;

                  return (
                    <div
                      key={op.id}
                      className={`p-4 rounded-lg border transition-all flex flex-col justify-between gap-3 relative ${
                        isActive
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] text-slate-100'
                          : isCompleted
                          ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-400'
                          : 'bg-slate-900 border-slate-850 text-slate-500'
                      }`}
                    >
                      {/* Connection arrows for sequences */}
                      {idx < operations.length - 1 && (
                        <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-20 bg-slate-950 p-0.5 rounded-full border border-slate-800">
                          <ChevronRight className={`w-4 h-4 ${isCompleted ? 'text-emerald-500' : 'text-slate-700'}`} />
                        </div>
                      )}

                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400 font-bold">
                          {op.number}
                        </span>
                        {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {isActive && isExecuting && <Activity className="w-4 h-4 text-indigo-400 animate-spin" />}
                      </div>

                      <div>
                        <div className="text-xs font-bold truncate mt-1 text-slate-200">{op.name}</div>
                        <p className="text-[9px] text-slate-500 mt-1 font-mono">Resource: {op.machine}</p>
                        <p className="text-[9px] text-slate-500 font-mono">Tool: {op.tool}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/50 flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-medium">Est: {op.duration}</span>
                        <span className={`px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider rounded ${
                          isActive ? 'bg-indigo-500/20 text-indigo-300' : isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {isActive ? 'ACTIVE' : isCompleted ? 'DONE' : 'PENDING'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Simulation control dashboard */}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setIsExecuting(!isExecuting)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all border shadow ${
                    isExecuting
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent'
                  }`}
                >
                  {isExecuting ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isExecuting ? 'Pause Manufacturing Cycle' : 'Execute Physical Manufacturing Twin Cycle'}
                </button>

                <button
                  onClick={() => {
                    setIsExecuting(false);
                    setCurrentOpIndex(0);
                    setLifecycleState('READY');
                    setProcessStats(prev => ({
                      ...prev,
                      actualCycleTimeSec: 0,
                      actualEnergyKwh: 0,
                      estimatedToolWear: 0.012,
                      defectDetected: false,
                      qualityResult: 'PASS'
                    }));
                    pushLog('RESET: Manufacturing coordinate runbuffers reset to safe OP10 target parameters.', 'INFO');
                  }}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-all"
                >
                  Reset Run
                </button>
              </div>
            </div>

            {/* Simulated vs Actual vs Target Comparisons */}
            <div className="bg-slate-950 rounded-xl border border-slate-850 p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5 text-indigo-400" /> Planned (Plan) vs. Simulated vs. Actual Parameters
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Spindle speed comparison */}
                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">Spindle Cutting Speed</span>
                    <span className="font-mono text-cyan-400 text-[10px]">RPM</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-center mt-1">
                    <div className="p-1.5 bg-slate-950 rounded border border-slate-800/60">
                      <div className="text-slate-500">PLAN</div>
                      <div className="text-slate-300 font-bold mt-0.5">12,000</div>
                    </div>
                    <div className="p-1.5 bg-slate-950 rounded border border-slate-800/60">
                      <div className="text-slate-500">SIMULATED</div>
                      <div className="text-slate-300 font-bold mt-0.5">12,000</div>
                    </div>
                    <div className="p-1.5 bg-indigo-950/40 rounded border border-indigo-800/40">
                      <div className="text-indigo-400 font-bold">ACTUAL</div>
                      <div className="text-indigo-300 font-bold mt-0.5">
                        {processStats.actualSpindleSpeed !== null ? processStats.actualSpindleSpeed.toLocaleString() : 'UNAVAILABLE'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Feed rate comparison */}
                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">Axes Machining Feed Rate</span>
                    <span className="font-mono text-cyan-400 text-[10px]">mm/min</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-center mt-1">
                    <div className="p-1.5 bg-slate-950 rounded border border-slate-800/60">
                      <div className="text-slate-500">PLAN</div>
                      <div className="text-slate-300 font-bold mt-0.5">3,200</div>
                    </div>
                    <div className="p-1.5 bg-slate-950 rounded border border-slate-800/60">
                      <div className="text-slate-500">SIMULATED</div>
                      <div className="text-slate-300 font-bold mt-0.5">3,200</div>
                    </div>
                    <div className="p-1.5 bg-indigo-950/40 rounded border border-indigo-800/40">
                      <div className="text-indigo-400 font-bold">ACTUAL</div>
                      <div className="text-indigo-300 font-bold mt-0.5">
                        {processStats.actualFeedRate !== null ? processStats.actualFeedRate.toLocaleString() : 'UNAVAILABLE'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* High-Fidelity Principle Notice */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-400 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-slate-200">Industrial Digital Twin Principle Complied</strong>: We isolate planned constraints, simulated outcomes, and actual measurements cleanly. A simulated success index does NOT guarantee physical safety until confirmed by active metrology sensors and the evidence bus.
                </p>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Failures and Operations context */}
          <div className="flex flex-col gap-6">
            {/* Failure Mode Injector */}
            <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Physical Anomaly Injection
              </h3>

              <div className="flex flex-col gap-2 text-xs">
                <button
                  onClick={() => setActiveAnomaly('SPINDLE_CHATTER')}
                  className={`w-full text-left p-2.5 rounded border transition-all ${
                    activeAnomaly === 'SPINDLE_CHATTER'
                      ? 'bg-red-950/40 text-red-300 border-red-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Spindle Vibration Chatter
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Spikes vibration levels above 2.4g, inducing rough surface cuts.</p>
                </button>

                <button
                  onClick={() => setActiveAnomaly('COOLANT_FAILURE')}
                  className={`w-full text-left p-2.5 rounded border transition-all ${
                    activeAnomaly === 'COOLANT_FAILURE'
                      ? 'bg-red-950/40 text-red-300 border-red-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Coolant Pressure drop
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Simulates chip clogging causing immediate coolant flow failure.</p>
                </button>

                <button
                  onClick={() => setActiveAnomaly('HARDNESS_SPIKE')}
                  className={`w-full text-left p-2.5 rounded border transition-all ${
                    activeAnomaly === 'HARDNESS_SPIKE'
                      ? 'bg-amber-950/40 text-amber-300 border-amber-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Material Hardness Spike (Ti-64)
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Encountering hard alpha inclusions which speed tool degradation.</p>
                </button>

                <button
                  onClick={() => setActiveAnomaly('TOOL_WEAR')}
                  className={`w-full text-left p-2.5 rounded border transition-all ${
                    activeAnomaly === 'TOOL_WEAR'
                      ? 'bg-red-950/40 text-red-300 border-red-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Tool Flute Degradation (Wear)
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Forces carbide tool tip edge chipping to trigger visual warning limits.</p>
                </button>

                {activeAnomaly !== 'NONE' && (
                  <button
                    onClick={handleResolveAnomaly}
                    className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} /> Resolve failures & Re-calibrate Process
                  </button>
                )}
              </div>
            </div>

            {/* Industrial event log console */}
            <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 flex flex-col gap-3 flex-1 min-h-[220px]">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" /> Process Digital Thread Event Log
              </h3>

              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 max-h-[180px] custom-scrollbar">
                {logs.map((item, idx) => (
                  <div key={idx} className="p-2 bg-slate-900 border border-slate-800 rounded flex flex-col gap-0.5 text-[10px] font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">{item.time}</span>
                      <span className={`px-1 rounded text-[8px] font-extrabold uppercase ${
                        item.severity === 'ALARM'
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : item.severity === 'WARN'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : item.severity === 'SUCCESS'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.severity}
                      </span>
                    </div>
                    <p className="text-slate-300 mt-0.5 leading-relaxed">{item.msg}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'telemetry' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Telemetry Gauge 1: Vibration */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 flex flex-col justify-between h-[200px]">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500">Accelerometers Monitoring</span>
                <h4 className="text-sm font-bold text-slate-200 mt-1">Vibration Level</h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                processStats.vibrationG > 1.5 ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400'
              }`}>
                {processStats.vibrationG > 1.5 ? 'CHATTERING' : 'STABLE'}
              </span>
            </div>

            <div className="my-2">
              <div className="text-3xl font-extrabold tracking-tight font-mono text-slate-100 flex items-baseline gap-1.5">
                {processStats.vibrationG !== null ? processStats.vibrationG : 'UNAVAILABLE'} <span className="text-sm text-slate-500 font-normal">g_rms</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full transition-all duration-300 ${processStats.vibrationG !== null && processStats.vibrationG > 1.5 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${processStats.vibrationG !== null ? Math.min(100, (processStats.vibrationG / 3.0) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-mono flex justify-between">
              <span>Min: 0.05</span>
              <span>Target: 0.12</span>
              <span>Max Safe Limit: 1.50</span>
            </div>
          </div>

          {/* Telemetry Gauge 2: Spindle motor load */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 flex flex-col justify-between h-[200px]">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500">Peak Spindle Sensor</span>
                <h4 className="text-sm font-bold text-slate-200 mt-1">Servo Motor Load</h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400">
                GOOD
              </span>
            </div>

            <div className="my-2">
              <div className="text-3xl font-extrabold tracking-tight font-mono text-slate-100 flex items-baseline gap-1.5">
                {processStats.spindleLoad !== null ? `${processStats.spindleLoad}%` : 'UNAVAILABLE'} <span className="text-sm text-slate-500 font-normal">capacity</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${processStats.spindleLoad !== null ? Math.min(100, processStats.spindleLoad) : 0}%` }}
                />
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-mono flex justify-between">
              <span>Idle: 15%</span>
              <span>Typical: 35%</span>
              <span>Peak Threshold: 80%</span>
            </div>
          </div>

          {/* Telemetry Gauge 3: Coolant Pressure */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 flex flex-col justify-between h-[200px]">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500">Coolant Pressure sensor</span>
                <h4 className="text-sm font-bold text-slate-200 mt-1">Feed Valve Pressure</h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                processStats.coolantPressureBar < 5.0 ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400'
              }`}>
                {processStats.coolantPressureBar < 5.0 ? 'LOW PRESSURE' : 'NOMINAL'}
              </span>
            </div>

            <div className="my-2">
              <div className="text-3xl font-extrabold tracking-tight font-mono text-slate-100 flex items-baseline gap-1.5">
                {processStats.coolantPressureBar !== null ? processStats.coolantPressureBar : 'UNAVAILABLE'} <span className="text-sm text-slate-500 font-normal">Bar</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full transition-all duration-300 ${processStats.coolantPressureBar !== null && processStats.coolantPressureBar < 5.0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}
                  style={{ width: `${processStats.coolantPressureBar !== null ? Math.min(100, (processStats.coolantPressureBar / 25.0) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-mono flex justify-between">
              <span>Min Safe: 10.0</span>
              <span>Target: 18.0</span>
              <span>Max limit: 25.0</span>
            </div>
          </div>

          {/* Telemetry Gauge 4: Cumulative Tool Wear */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 flex flex-col justify-between h-[200px]">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500">Virtual Wear estimation</span>
                <h4 className="text-sm font-bold text-slate-200 mt-1">Carbide Flutes Wear</h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                processStats.estimatedToolWear > 0.05 ? 'bg-amber-950 text-amber-400' : 'bg-emerald-950 text-emerald-400'
              }`}>
                {processStats.estimatedToolWear > 0.05 ? 'REPLACE TOOL' : 'READY'}
              </span>
            </div>

            <div className="my-2">
              <div className="text-2xl font-extrabold tracking-tight font-mono text-slate-100 flex items-baseline gap-1.5">
                {processStats.estimatedToolWear !== null ? processStats.estimatedToolWear.toFixed(4) : 'UNAVAILABLE'} <span className="text-sm text-slate-500 font-normal">mm VB_max</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${processStats.estimatedToolWear !== null ? Math.min(100, (processStats.estimatedToolWear / 0.1) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-mono flex justify-between">
              <span>New Flutes: 0.00</span>
              <span>Current Wear</span>
              <span>Scrap limit: 0.1500</span>
            </div>
          </div>

          {/* Telemetry Gauge 5: Energy Accumulator */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 flex flex-col justify-between h-[200px]">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500">Cumulative energy monitoring</span>
                <h4 className="text-sm font-bold text-slate-200 mt-1">Energy Consumption</h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400">
                TRACKING
              </span>
            </div>

            <div className="my-2">
              <div className="text-3xl font-extrabold tracking-tight font-mono text-slate-100 flex items-baseline gap-1.5">
                {processStats.actualEnergyKwh} <span className="text-sm text-slate-500 font-normal">kWh</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (processStats.actualEnergyKwh / 1.5) * 100)}%` }}
                />
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-mono flex justify-between">
              <span>Planned: 0.85 kWh</span>
              <span>Current Run</span>
              <span>Limit: 2.50 kWh</span>
            </div>
          </div>

          {/* Telemetry Gauge 6: Quality / Metrology */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 flex flex-col justify-between h-[200px]">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500">CMM metrology scanner</span>
                <h4 className="text-sm font-bold text-slate-200 mt-1">Surface Finish Quality</h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                processStats.qualityResult === 'PASS'
                  ? 'bg-emerald-950 text-emerald-400'
                  : processStats.qualityResult === 'SCRAP'
                  ? 'bg-rose-950 text-rose-400'
                  : 'bg-amber-950 text-amber-400'
              }`}>
                {processStats.qualityResult}
              </span>
            </div>

            <div className="my-2">
              <div className="text-2xl font-extrabold tracking-tight font-mono text-slate-100 flex items-baseline gap-1.5">
                {processStats.defectDetected ? 'OUT OF TOLERANCE' : '0.42 Ra'}
                <span className="text-sm text-slate-500 font-normal">microns</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {processStats.defectDetected
                  ? `Anomalous vibration ${processStats.vibrationG}g breached limits.`
                  : 'All dimensional measurements reside within nominal 0.005mm limit.'}
              </p>
            </div>

            <div className="text-[10px] text-slate-500 font-mono flex justify-between">
              <span>RA Min: 0.1</span>
              <span>RA Max: 0.8</span>
              <span>Instrument: Zeiss Prismo</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'feasibility' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Inputs controller */}
          <div className="bg-slate-950 rounded-xl border border-slate-850 p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Boundary Conditions Controller
            </h3>

            <div className="flex flex-col gap-4">
              {/* Spindle speed slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-slate-400">Target Spindle Speed:</span>
                  <span className="text-indigo-400 font-bold">{spindleSpeedOverride.toLocaleString()} RPM</span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="20000"
                  step="500"
                  value={spindleSpeedOverride}
                  onChange={e => handleParameterChange(Number(e.target.value), feedRateOverride)}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Feed rate slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-slate-400">Target Feed Rate:</span>
                  <span className="text-indigo-400 font-bold">{feedRateOverride.toLocaleString()} mm/min</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="100"
                  value={feedRateOverride}
                  onChange={e => handleParameterChange(spindleSpeedOverride, Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {ecoRequired && (
                <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-lg flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-200">Engineering Change Order Required</h4>
                      <p className="text-[10px] text-amber-400/90 leading-relaxed mt-0.5">
                        Large deviations from original plan parameters require ECO approval. CNC execution is blocked until reviewed.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={handleApproveECO}
                      className="flex-1 py-1 bg-amber-600 hover:bg-amber-500 text-slate-900 rounded font-bold text-[10px] shadow"
                    >
                      Approve ECO & Sign Revision
                    </button>
                    <button
                      onClick={() => handleParameterChange(12000, 3200)}
                      className="px-2 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded font-mono text-[10px]"
                    >
                      Reset Original
                    </button>
                  </div>
                </div>
              )}

              {/* Status approvals workflow */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex justify-between items-center text-xs">
                <span className="text-slate-400">ECO Approval Status:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  approvalWorkflowState === 'APPROVED' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                }`}>
                  {approvalWorkflowState}
                </span>
              </div>
            </div>
          </div>

          {/* Feasibility Evaluator Results */}
          <div className="lg:col-span-2 bg-slate-950 rounded-xl border border-slate-850 p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> ProcessFeasibilityChecker Mathematical Decision Engine
            </h3>

            {(() => {
              // Dynamically call checker
              const res = ProcessFeasibilityChecker.verifyFeasibility(
                {
                  processId: 'PROC-99',
                  inputs: [],
                  outputs: [],
                  operations: [],
                  resources: [],
                  parameters: [],
                  constraints: [],
                  qualityRequirements: []
                },
                {
                  machine: { machineId: 'MAC-327', machineRevision: 'v1.0', configurationRevision: 'c1', kinematicRevision: 'k1', controllerRevision: 'f1' },
                  tool: { toolId: 'T-BALL-06', toolRevision: 'v1.0', toolAssembly: 'ASSY', toolOffset: { xOffsetMm: 0.1, zOffsetMm: -145, radiusMm: 3 } },
                  fixture: { fixtureId: 'FIX-42', fixtureRevision: 'v1', fixtureConfiguration: 'CLAMP-CONFIG' },
                  nc: { ncProgramId: 'O328.NC', ncProgramRevision: 'REV-A', postProcessorRevision: 'POST' }
                },
                { SpindleSpeed: spindleSpeedOverride, FeedRate: feedRateOverride, DepthOfCut: 1.5 },
                {
                  machineLimits: { maxRpm: 18000, maxFeed: 8000 },
                  toolLimits: { maxDepthOfCutMm: 3.0, maxWearMm: 0.25 },
                  materialLimits: { maxHardnessBhn: 340 },
                  qualityLimits: { surfaceRoughnessRaMicrons: 0.8 },
                  geometricConstraints: { clearanceHeightMm: 50 },
                  thermalLimits: { maxSpindleTempC: 85 },
                  safetyConstraints: { doorClosedRequired: true }
                }
              );

              const passesAll = res.feasible && approvalWorkflowState === 'APPROVED';

              return (
                <div className="flex flex-col gap-4 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Overall score */}
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Compatibility Score</span>
                      <div className={`text-4xl font-extrabold tracking-tight mt-1 ${passesAll ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {passesAll ? res.score : Math.max(0, res.score - 40)}%
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono mt-1">Limits Check: {passesAll ? 'STABLE' : 'RISK DETECTED'}</span>
                    </div>

                    {/* Final verdict flag */}
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Process Feasible Status</span>
                      <div className={`text-lg font-bold flex items-center gap-1.5 mt-2 ${passesAll ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {passesAll ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                        {passesAll ? 'FEASIBILITY CONFIRMED' : 'UNFEASIBLE LIMITS'}
                      </div>
                      <p className="text-[9px] text-slate-500 leading-relaxed mt-1">
                        Checks spindle speed, feed rate, tool engagement limits, and ECO signatures before allowing CNC execution.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col gap-1.5 flex-1 max-h-[160px] overflow-y-auto">
                    <span className="text-[10px] font-mono text-slate-500 uppercase mb-1">Constraints Evaluation Logs</span>
                    {res.reports.map((report, idx) => {
                      const isFail = report.startsWith('FAIL');
                      return (
                        <div key={idx} className="flex gap-2 text-[10px] font-mono leading-relaxed">
                          <span className={isFail ? 'text-red-400' : 'text-emerald-400'}>
                            {isFail ? '✗' : '✓'}
                          </span>
                          <span className={isFail ? 'text-red-300' : 'text-slate-300'}>
                            {report}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === 'gate' && (
        <div className="flex flex-col gap-6">
          {/* Summary widgets */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                gateReport.passed ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400' : 'bg-red-950/50 border-red-800 text-red-400'
              }`}>
                {gateReport.passed ? <ShieldCheck className="w-6 h-6" /> : <AlertOctagon className="w-6 h-6" />}
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Verification Status</span>
                <div className="text-sm font-bold mt-0.5">{gateReport.passed ? 'PASSED' : 'BLOCKED'}</div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center border bg-indigo-950/50 border-indigo-800 text-indigo-400">
                <Compass className="w-6 h-6 animate-spin" style={{ animationDuration: isReevaluating ? '1s' : '8s' }} />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Acceptance Verdict</span>
                <div className="text-sm font-extrabold mt-0.5 text-indigo-400">{gateReport.verdict}</div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center border bg-blue-950/50 border-blue-800 text-blue-400">
                <Binary className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Assertions Executed</span>
                <div className="text-sm font-bold mt-0.5">{gateReport.totalAssertions} / 128 (126+ Required)</div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center border bg-indigo-950/50 border-indigo-800 text-indigo-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Completeness Level</span>
                  <div className="text-sm font-bold mt-0.5">{gateReport.processTwinState?.completenessScore}% Score</div>
                </div>
              </div>
              <button
                disabled={isReevaluating}
                onClick={handleRunAcceptanceGate}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold shadow transition-all flex items-center gap-1.5 animate-pulse"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReevaluating ? 'animate-spin' : ''}`} />
                {isReevaluating ? 'Evaluating...' : 'Run Gate Tests'}
              </button>
            </div>
          </div>

          {/* Interactive loading step output */}
          {isReevaluating && (
            <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 font-mono text-xs flex flex-col gap-1.5">
              <span className="text-indigo-400 font-bold uppercase mb-1 flex items-center gap-1.5">
                <Activity className="w-4 h-4 animate-pulse" /> Re-calculating Numerical and Sequence Assertions
              </span>
              <div className="max-h-[180px] overflow-y-auto flex flex-col gap-1 text-slate-300">
                {gateLogs.map((logStr, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-slate-500">[{index + 1}]</span>
                    <span>{logStr}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter, search list of 128 assertions */}
          <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gate Assertion Checklist ({filteredAssertions.length} tests)</h3>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter assertions..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-750 text-xs px-2.5 py-1 rounded text-slate-300 focus:outline-none focus:border-indigo-500 placeholder-slate-500 font-mono"
                />
                <select
                  value={filterPassed}
                  onChange={e => setFilterPassed(e.target.value as any)}
                  className="bg-slate-900 border border-slate-750 text-xs px-2 py-1 rounded text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="all">All Results</option>
                  <option value="pass">Passed Only</option>
                  <option value="fail">Failed Only</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredAssertions.map((assertion, index) => {
                const isPass = assertion.startsWith('[PASS]');
                const label = assertion.replace('[PASS] ', '').replace('[FAIL] ', '');
                const [assertionId, ...descParts] = label.split(' - ');
                const description = descParts.join(' - ');

                return (
                  <div key={index} className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      {isPass ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 text-xs">
                      <span className="font-mono font-bold text-slate-200">{assertionId}</span>
                      <p className="text-slate-400 text-[10px] leading-relaxed">{description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
