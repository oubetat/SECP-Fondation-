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
  Binary
} from 'lucide-react';
import { HardAcceptanceGate327, HardAcceptanceGate327Report } from '../engine/digital_twin/HardAcceptanceGate327';
import { EvidenceBus314 } from '../engine/engineering_ai/copilot/EvidenceBus314';

export const MachineTwinPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'gate'>('telemetry');
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [anomaly, setAnomaly] = useState<'NONE' | 'BACKLASH' | 'C_AXIS_THERMAL' | 'VIBRATION' | 'DOOR_OPEN'>('NONE');
  const [gateReport, setGateReport] = useState<HardAcceptanceGate327Report>(() => HardAcceptanceGate327.runGate());
  const [isReevaluating, setIsReevaluating] = useState<boolean>(false);
  const [gateLogs, setGateLogs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPassed, setFilterPassed] = useState<'all' | 'pass' | 'fail'>('all');

  // Simulated live CNC machine state
  const [machiningCoords, setMachiningCoords] = useState({
    x: 12.45,
    y: -8.92,
    z: 145.2,
    a: 15.3,
    c: 45.0,
    spindleSpeed: 12000,
    spindleLoad: 34.5,
    motorTemp: 42.1,
    vibration: 0.12,
    lineNum: 412,
    feedrateOverride: 100,
    spindleOverride: 100
  });

  const [logs, setLogs] = useState<Array<{ time: string; msg: string; severity: 'INFO' | 'WARN' | 'ALARM' }>>([
    { time: '11:43:02', msg: 'System booted into AUTOMATIC mode. Program O327_TURBINE_BLADE.NC loaded.', severity: 'INFO' },
    { time: '11:43:10', msg: 'Axis X calibration offset verified via laser metrology.', severity: 'INFO' },
    { time: '11:43:15', msg: 'Evidence register token EVID-327-01 recorded onto the Evidence Bus.', severity: 'INFO' }
  ]);

  // Ref to hold changing values for intervals
  const angleRef = useRef<number>(0);

  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      angleRef.current += 0.05;
      const t = angleRef.current;

      setMachiningCoords(prev => {
        let xNoise = Math.sin(t) * 150;
        let yNoise = Math.cos(t) * 120;
        let zNoise = Math.sin(t * 0.5) * 50 + 100;
        let aNoise = Math.sin(t * 0.2) * 30;
        let cNoise = (t * 50) % 360;

        // Apply selected anomalies to numerical telemetry
        let motorTemp = 40.0 + Math.abs(Math.sin(t * 0.1)) * 12;
        let vibration = 0.10 + Math.abs(Math.sin(t * 2)) * 0.08;
        let spindleLoad = 30.0 + Math.sin(t * 1.5) * 10;
        let activeLine = prev.lineNum + (Math.floor(t) % 4 === 0 ? 1 : 0);

        if (anomaly === 'BACKLASH') {
          // Slide error / erratic drift
          xNoise += Math.cos(t * 10) * 8.5;
        } else if (anomaly === 'C_AXIS_THERMAL') {
          motorTemp += 45.0; // Rapid heat spike
        } else if (anomaly === 'VIBRATION') {
          vibration += 2.45; // Spindle chatter simulation
          spindleLoad += 15;
        }

        // Keep coordinates bounded by limits
        const targetX = Math.max(-500, Math.min(500, Number(xNoise.toFixed(3))));
        const targetY = Math.max(-400, Math.min(400, Number(yNoise.toFixed(3))));
        const targetZ = Math.max(-300, Math.min(300, Number(zNoise.toFixed(3))));
        const targetA = Math.max(-120, Math.min(120, Number(aNoise.toFixed(2))));
        const targetC = Math.max(-360, Math.min(360, Number(cNoise.toFixed(2))));

        return {
          ...prev,
          x: targetX,
          y: targetY,
          z: targetZ,
          a: targetA,
          c: targetC,
          spindleSpeed: Math.floor(12000 * (prev.spindleOverride / 100) + (Math.sin(t * 3) * 25)),
          spindleLoad: Number(spindleLoad.toFixed(1)),
          motorTemp: Number(motorTemp.toFixed(1)),
          vibration: Number(vibration.toFixed(2)),
          lineNum: activeLine
        };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isStreaming, anomaly]);

  // Push alarm logs when anomalies are selected
  useEffect(() => {
    if (anomaly === 'NONE') return;

    const timeStr = new Date().toLocaleTimeString();
    let newLog = { time: timeStr, msg: '', severity: 'ALARM' as const };

    switch (anomaly) {
      case 'BACKLASH':
        newLog.msg = 'CRITICAL: Axis X backlash drift detected. Sub-cron repeatability thresholds breached!';
        break;
      case 'C_AXIS_THERMAL':
        newLog.msg = 'WARNING: Axis C rotary motor temperature reaching 87.1°C thermal limit!';
        newLog.severity = 'WARN';
        break;
      case 'VIBRATION':
        newLog.msg = 'CRITICAL: Spindle harmonic chatter threshold exceeded! 2.57 g_rms vibration level detected.';
        break;
      case 'DOOR_OPEN':
        newLog.msg = 'ESTOP TRIGGERED: Primary safety door interlock shield opened during active AUTO mode!';
        break;
    }

    setLogs(prev => [newLog, ...prev].slice(0, 20));
  }, [anomaly]);

  const handleRecalibrate = () => {
    setAnomaly('NONE');
    const timeStr = new Date().toLocaleTimeString();
    const bus = EvidenceBus314.getInstance();
    const token = bus.registerEvidence(
      'MANUFACTURING_SOLVER',
      'RECALIBRATE-VMC327',
      'REV-327',
      'LaserInterferometerCalibration',
      'VALIDATED',
      { calibratedBacklashOffsetMm: 0.0, timestamp: Date.now() }
    );

    setLogs(prev => [
      {
        time: timeStr,
        msg: `SUCCESS: Dynamic recalibration sequence executed. Registered laser evidence with ID ${token.evidenceId}. All axis limits cleared.`,
        severity: 'INFO'
      },
      ...prev
    ].slice(0, 20));
  };

  const handleRunAcceptanceGate = () => {
    setIsReevaluating(true);
    setGateLogs([]);
    let logsAccumulator: string[] = [];

    // Simulate stepping through checks
    const steps = [
      'Reading core B-Rep CAD model representation metadata...',
      'Verifying identity contracts and manufacturer signatures on SN-VMC-327-0099...',
      'Querying Evidence Bus 314 for calibration certificates under REV-327...',
      'Analyzing 5 kinematics joints and limit boundaries sanity...',
      'Evaluating collision boundary tags for bed, tools, fixtures, and workpieces...',
      'Processing real-time telemetry stream data quality and override limits...',
      'Checking forward kinematics coordinate transform matrices orthogonal trace...',
      'Finalizing decision matrices...'
    ];

    let currentStepIdx = 0;
    const interval = setInterval(() => {
      if (currentStepIdx < steps.length) {
        logsAccumulator.push(`[SYSTEM_CHECK] ${steps[currentStepIdx]}`);
        setGateLogs([...logsAccumulator]);
        currentStepIdx++;
      } else {
        clearInterval(interval);
        const report = HardAcceptanceGate327.runGate();
        setGateReport(report);
        setIsReevaluating(false);
      }
    }, 400);
  };

  // Filtered assertion list
  const filteredAssertions = gateReport.details.filter(item => {
    const textMatches = item.toLowerCase().includes(searchQuery.toLowerCase());
    const isPass = item.startsWith('[PASS]');
    if (filterPassed === 'pass' && !isPass) return false;
    if (filterPassed === 'fail' && isPass) return false;
    return textMatches;
  });

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6" id="machine-digital-twin-root">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold tracking-tight">Machine Digital Twin Engine</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-full">
              PATCH-327
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Traceable digital representation of physical industrial machines, mapping 3D CAD B-Rep, kinematics joints, active NC code paths, and telemetry evidence.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'telemetry' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Machine Telemetry
          </button>
          <button
            onClick={() => setActiveTab('gate')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'gate' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Acceptance Gate ({gateReport.passedCount}/128)
          </button>
        </div>
      </div>

      {activeTab === 'telemetry' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2 Column Telemetry Displays */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* SVG Visual Kinematics Simulator */}
            <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 relative overflow-hidden h-[300px]">
              <div className="absolute top-3 left-4 flex items-center gap-2 z-10">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Dynamic Kinematic Visualizer (X-Z Projection)</span>
              </div>

              {/* CNC Kinematics Schematic Rendering */}
              <svg className="w-full h-full" viewBox="0 0 500 250">
                {/* Background Grid */}
                <defs>
                  <pattern id="twinGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#twinGrid)" rx="6" />

                {/* Machine Bed Enclosure (Static) */}
                <rect x="50" y="200" width="400" height="15" fill="#334155" rx="2" />
                <rect x="90" y="190" width="320" height="10" fill="#475569" />

                {/* CNC Columns and Rails */}
                <rect x="60" y="30" width="30" height="160" fill="#1e293b" />
                <rect x="410" y="30" width="30" height="160" fill="#1e293b" />
                <line x1="90" y1="50" x2="410" y2="50" stroke="#475569" strokeWidth="4" />

                {/* Hydraulic Vice / Fixture */}
                <rect x="210" y="165" width="80" height="25" fill="#64748b" rx="2" />
                {/* Titanium Workpiece */}
                <rect x="235" y="145" width="30" height="20" fill="#a1a1aa" stroke="#e4e4e7" strokeWidth="1" />

                {/* Moving Gantry toolhead and spindle assembly based on dynamic coordinates */}
                {(() => {
                  // Scale X from [-500, 500] to [120, 380]
                  const toolX = 250 + (machiningCoords.x / 500) * 120;
                  // Scale Z from [0, 300] to [130, 60] (closer to workpiece when z is smaller)
                  const toolZ = 135 - (machiningCoords.z / 300) * 70;
                  const spindleAngle = machiningCoords.a; // Rotate spindle assembly on A-axis

                  return (
                    <g transform={`translate(${toolX}, ${toolZ})`}>
                      {/* Z-Axis carriage slide */}
                      <rect x="-30" y="-80" width="60" height="40" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                      {/* Spindle head rotating based on A-axis */}
                      <g transform={`rotate(${spindleAngle}, 0, -10)`}>
                        <rect x="-15" y="-40" width="30" height="50" fill="#0284c7" rx="1" />
                        <rect x="-6" y="10" width="12" height="15" fill="#e2e8f0" />
                        {/* Carbide Cutting tool */}
                        <polygon points="-3,25 3,25 2,38 -2,38" fill="#f59e0b" className={isStreaming ? 'animate-pulse' : ''} />
                        {/* Laser sensor telemetry sweep line */}
                        <line x1="0" y1="38" x2="0" y2="60" stroke="#f43f5e" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
                      </g>
                    </g>
                  );
                })()}

                {/* Indicator text of active limits */}
                <text x="65" y="228" fill="#64748b" className="text-[9px] font-mono">X-Axis Travel: [-500mm, 500mm]</text>
                <text x="310" y="228" fill="#64748b" className="text-[9px] font-mono">Z-Axis Travel: [-300mm, 300mm]</text>
              </svg>

              {/* Floating Real-time Coordinate Overlay */}
              <div className="absolute bottom-3 right-4 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-750 flex gap-4 text-[10px] font-mono">
                <div>X: <span className="text-cyan-400 font-bold">{machiningCoords.x.toFixed(3)} mm</span></div>
                <div>Y: <span className="text-cyan-400 font-bold">{machiningCoords.y.toFixed(3)} mm</span></div>
                <div>Z: <span className="text-cyan-400 font-bold">{machiningCoords.z.toFixed(3)} mm</span></div>
                <div>A: <span className="text-amber-400 font-bold">{machiningCoords.a.toFixed(2)}°</span></div>
                <div>C: <span className="text-amber-400 font-bold">{machiningCoords.c.toFixed(2)}°</span></div>
              </div>
            </div>

            {/* Gauges & Telemetry Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kinematic Axis Feed & Overrides */}
              <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 flex flex-col gap-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" /> CNC Controller & Override Knobs
                </h3>

                <div className="flex flex-col gap-3.5 text-xs">
                  {/* Feedrate Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Feedrate Override:</span>
                      <span className="text-cyan-400 font-bold">{machiningCoords.feedrateOverride}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={machiningCoords.feedrateOverride}
                      onChange={e => setMachiningCoords(prev => ({ ...prev, feedrateOverride: Number(e.target.value) }))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>

                  {/* Spindle Override Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Spindle Speed Override:</span>
                      <span className="text-amber-400 font-bold">{machiningCoords.spindleOverride}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={machiningCoords.spindleOverride}
                      onChange={e => setMachiningCoords(prev => ({ ...prev, spindleOverride: Number(e.target.value) }))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mt-1">
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                      <span className="text-slate-400">Active NC Program:</span>
                      <div className="text-slate-200 font-bold mt-0.5 truncate">{machiningCoords.activeNCProgram}</div>
                    </div>
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                      <span className="text-slate-400">Active G-Code Block:</span>
                      <div className="text-slate-200 font-bold mt-0.5">N{machiningCoords.lineNum}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Physical Machine Health & Limits */}
              <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 flex flex-col justify-between gap-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-rose-400" /> Physical Spindle Metrics
                </h3>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  {/* Spindle Speed RPM */}
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-400">Spindle Speed</span>
                    <div className="text-lg font-bold text-slate-200 mt-1">
                      {machiningCoords.spindleSpeed} <span className="text-[10px] text-slate-500 font-normal">RPM</span>
                    </div>
                  </div>

                  {/* Motor Temp */}
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-400">Motor Temp</span>
                    <div className="text-lg font-bold text-slate-200 mt-1 flex items-center gap-1">
                      <span className={machiningCoords.motorTemp > 75 ? 'text-red-400' : 'text-slate-200'}>
                        {machiningCoords.motorTemp} °C
                      </span>
                      {machiningCoords.motorTemp > 75 && <Flame className="w-4 h-4 text-red-500 animate-pulse" />}
                    </div>
                  </div>

                  {/* Vibration Monitor */}
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-400">Spindle Vibration</span>
                    <div className="text-lg font-bold text-slate-200 mt-1">
                      <span className={machiningCoords.vibration > 1.5 ? 'text-red-400' : 'text-slate-200'}>
                        {machiningCoords.vibration} g_rms
                      </span>
                    </div>
                  </div>

                  {/* Load Percent */}
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-400">Spindle Motor Load</span>
                    <div className="text-lg font-bold text-slate-200 mt-1">
                      {machiningCoords.spindleLoad}%
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsStreaming(!isStreaming)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition-all border ${
                      isStreaming
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    {isStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isStreaming ? 'Stop Telemetry Stream' : 'Run Telemetry Stream'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right 1 Column Control Dashboard */}
          <div className="flex flex-col gap-6">
            {/* Anomaly Controls */}
            <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Synthetic Failures Injection
              </h3>

              <div className="flex flex-col gap-2 text-xs">
                <button
                  onClick={() => setAnomaly('BACKLASH')}
                  className={`w-full text-left p-2.5 rounded border transition-all ${
                    anomaly === 'BACKLASH'
                      ? 'bg-red-950/40 text-red-300 border-red-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Inject Axis X Backlash drift
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Simulates mechanical slippage in linear ball screw carriage</p>
                </button>

                <button
                  onClick={() => setAnomaly('C_AXIS_THERMAL')}
                  className={`w-full text-left p-2.5 rounded border transition-all ${
                    anomaly === 'C_AXIS_THERMAL'
                      ? 'bg-amber-950/40 text-amber-300 border-amber-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Inject C-Axis Motor Thermal Spike
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Forces rotary axis servo motor to report critical high temp</p>
                </button>

                <button
                  onClick={() => setAnomaly('VIBRATION')}
                  className={`w-full text-left p-2.5 rounded border transition-all ${
                    anomaly === 'VIBRATION'
                      ? 'bg-red-950/40 text-red-300 border-red-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Trigger Spindle Chattering Failure
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Spikes accelerometer g_rms counts representing harmonic resonance</p>
                </button>

                <button
                  onClick={() => setAnomaly('DOOR_OPEN')}
                  className={`w-full text-left p-2.5 rounded border transition-all ${
                    anomaly === 'DOOR_OPEN'
                      ? 'bg-red-950/40 text-red-300 border-red-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Simulate Safety Interlock Breach
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Triggers ESTOP by unlocking safety doors during run cycle</p>
                </button>

                {anomaly !== 'NONE' && (
                  <button
                    onClick={handleRecalibrate}
                    className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" /> Resolve & Calibrate Axis Encoders
                  </button>
                )}
              </div>
            </div>

            {/* Industrial Logs */}
            <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 flex flex-col gap-3 flex-1 min-h-[220px]">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" /> Machine Controller Event Log
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
      ) : (
        /* TAB 2: Acceptance Gate */
        <div className="flex flex-col gap-6">
          {/* Verdict Ribbon */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                gateReport.passed ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400' : 'bg-red-950/50 border-red-800 text-red-400'
              }`}>
                {gateReport.passed ? <ShieldCheck className="w-6 h-6" /> : <AlertOctagon className="w-6 h-6" />}
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Verification Status</span>
                <div className="text-sm font-bold mt-0.5">{gateReport.passed ? 'GATE COMPLETED' : 'BLOCKED'}</div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center border bg-cyan-950/50 border-cyan-800 text-cyan-400">
                <Compass className="w-6 h-6 animate-spin" style={{ animationDuration: isReevaluating ? '1s' : '8s' }} />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Acceptance Verdict</span>
                <div className="text-sm font-extrabold mt-0.5 text-cyan-400">{gateReport.verdict}</div>
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
                  <div className="text-sm font-bold mt-0.5">{gateReport.machineTwinState?.completenessScore}% Score</div>
                </div>
              </div>
              <button
                disabled={isReevaluating}
                onClick={handleRunAcceptanceGate}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold shadow transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReevaluating ? 'animate-spin' : ''}`} />
                {isReevaluating ? 'Evaluating...' : 'Run Gate Tests'}
              </button>
            </div>
          </div>

          {/* Simulation console output if active */}
          {isReevaluating && (
            <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 font-mono text-xs flex flex-col gap-1.5">
              <span className="text-cyan-400 font-bold uppercase mb-1 flex items-center gap-1.5">
                <Activity className="w-4 h-4 animate-pulse" /> Re-calculating Numerical and Kinematics Assertions
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

          {/* Search, Filter & Assertions List */}
          <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gate Assertion Checklist ({filteredAssertions.length} tests)</h3>
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter assertions..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-750 text-xs px-2.5 py-1 rounded text-slate-300 focus:outline-none focus:border-cyan-500 placeholder-slate-500 font-mono"
                />
                <select
                  value={filterPassed}
                  onChange={e => setFilterPassed(e.target.value as any)}
                  className="bg-slate-900 border border-slate-750 text-xs px-2 py-1 rounded text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
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
