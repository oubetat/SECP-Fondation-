/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-262 — Real CAM Post Processor & NC Generation Workspace UI
 */

import React, { useState, useEffect } from 'react';
import { FileCode, Cpu, Settings2, CheckCircle2, AlertTriangle, XCircle, Play, Download, Copy, Layers, ShieldCheck, RotateCw, GitCompare, Terminal, Activity, Maximize2 } from 'lucide-react';

import {
  PostProcessorDefinition,
  PostConfiguration,
  MachineDefinition,
  NCProgram,
  NCBlock,
  PostProcessingEvidence
} from './PostTypes';
import { MachineDefinitionRegistry } from './MachineDefinitionRegistry';
import { ControllerProfiles } from './ControllerProfiles';
import { PostProcessorEngine, NCDiffLine } from './PostProcessorEngine';
import { CAMOperationData } from './NCIntermediateRepresentation';
import { ToolSnapshot } from '../tool-library/ToolTypes';
import { HardAcceptanceGate262, Gate262Report } from './HardAcceptanceGate262';
import { generateDeterministicHash } from '../../../lib/hash';

export interface PostProcessorWorkspaceProps {
  activeSolidName?: string;
  activeProjectName?: string;
}

export const PostProcessorWorkspace: React.FC<PostProcessorWorkspaceProps> = ({
  activeSolidName,
  activeProjectName
}) => {
  const defaultComment = (activeSolidName || activeProjectName) 
    ? `${(activeSolidName || activeProjectName || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_')} OP1`
    : 'CUSTOM CAD PROJECT OP1';

  const [machines, setMachines] = useState<MachineDefinition[]>([]);
  const [profiles, setProfiles] = useState<PostProcessorDefinition[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('MACHINE_HAAS_VF4SS');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('POST_HAAS_NGC');

  // Config State
  const [programName, setProgramName] = useState<string>('O1001');
  const [programComment, setProgramComment] = useState<string>(defaultComment);
  const [units, setUnits] = useState<'METRIC_MM' | 'IMPERIAL_INCH'>('METRIC_MM');
  const [wcs, setWcs] = useState<'G54' | 'G55' | 'G56' | 'G57' | 'G58' | 'G59'>('G54');
  const [enableLineNumbers, setEnableLineNumbers] = useState<boolean>(true);
  const [enableModalOpt, setEnableModalOpt] = useState<boolean>(true);
  const [enableSafetyBlocks, setEnableSafetyBlocks] = useState<boolean>(true);
  const [enableRTCP, setEnableRTCP] = useState<boolean>(false);

  // Scenario
  const [selectedScenario, setSelectedScenario] = useState<'3AXIS_POCKET' | '4AXIS_ROTARY' | '5AXIS_IMPELLER' | 'MULTITOOL_PART'>('3AXIS_POCKET');

  // Output
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ncProgram, setNcProgram] = useState<NCProgram | null>(null);
  const [evidence, setEvidence] = useState<PostProcessingEvidence | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<NCBlock | null>(null);

  // Gate 262 Modal State
  const [gateReport, setGateReport] = useState<Gate262Report | null>(null);
  const [isRunningGate, setIsRunningGate] = useState<boolean>(false);
  const [showGateModal, setShowGateModal] = useState<boolean>(false);

  // Diff Tool
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [diffTextB, setDiffTextB] = useState<string>('');
  const [diffResults, setDiffResults] = useState<NCDiffLine[]>([]);

  // Init
  useEffect(() => {
    async function init() {
      await MachineDefinitionRegistry.initialize();
      await ControllerProfiles.initialize();
      const allMach = MachineDefinitionRegistry.getAllMachines();
      const allProf = ControllerProfiles.getAllProfiles();
      setMachines(allMach);
      setProfiles(allProf);
    }
    init();
  }, []);

  // When scenario changes, auto select sensible machine & controller
  const handleScenarioChange = (scenario: typeof selectedScenario) => {
    setSelectedScenario(scenario);
    if (scenario === '3AXIS_POCKET') {
      setSelectedMachineId('MACHINE_HAAS_VF4SS');
      setSelectedProfileId('POST_HAAS_NGC');
      setEnableRTCP(false);
    } else if (scenario === '4AXIS_ROTARY') {
      setSelectedMachineId('MACHINE_FANUC_ROBODRILL');
      setSelectedProfileId('POST_FANUC_31I');
      setEnableRTCP(false);
    } else if (scenario === '5AXIS_IMPELLER') {
      setSelectedMachineId('MACHINE_DMG_DMU50');
      setSelectedProfileId('POST_SIEMENS_840D');
      setEnableRTCP(true);
    } else if (scenario === 'MULTITOOL_PART') {
      setSelectedMachineId('MACHINE_HERMLE_C42U');
      setSelectedProfileId('POST_HEIDENHAIN_TNC640');
      setEnableRTCP(false);
    }
  };

  // Build Mock Operations based on Scenario
  const buildScenarioOperations = (): CAMOperationData[] => {
    const t1: ToolSnapshot = {
      snapshotId: 'SNAP_T1_ROUGH',
      toolId: 'TOOL_1',
      toolNumber: 1,
      toolType: 'END_MILL',
      name: 'Flat End Mill D12mm (Roughing)',
      geometry: { nominalDiameterMm: 12, cuttingEdgeLengthMm: 30, overallLengthMm: 100, fluteCount: 4, cornerType: 'SHARP' },
      holder: { holderId: 'HLD_1', name: 'ER32 Collet', gaugeLengthMm: 45, maxDiameterMm: 50, segments: [] },
      cuttingParameters: { spindleRpm: 6000, cuttingFeedMmMin: 1800, plungeFeedMmMin: 400, rampAngleDeg: 2.5 },
      version: 1,
      createdAt: Date.now(),
      snapshotHash: 'HASH_SNAP_T1'
    };

    const t2: ToolSnapshot = {
      snapshotId: 'SNAP_T2_FINISH',
      toolId: 'TOOL_2',
      toolNumber: 2,
      toolType: 'BALL_END_MILL',
      name: 'Ball End Mill D6mm (Finishing)',
      geometry: { nominalDiameterMm: 6, cuttingEdgeLengthMm: 20, overallLengthMm: 90, fluteCount: 2, cornerType: 'FULL_BALL' },
      holder: { holderId: 'HLD_2', name: 'Shrink Fit 6mm', gaugeLengthMm: 50, maxDiameterMm: 40, segments: [] },
      cuttingParameters: { spindleRpm: 12000, cuttingFeedMmMin: 2200, plungeFeedMmMin: 600, rampAngleDeg: 3.0 },
      version: 1,
      createdAt: Date.now(),
      snapshotHash: 'HASH_SNAP_T2'
    };

    if (selectedScenario === '3AXIS_POCKET') {
      return [
        {
          operationId: 'OP_POCKET_ROUGH',
          operationName: 'High-Efficiency Adaptive Pocket Roughing',
          toolNumber: 1,
          toolSnapshot: t1,
          spindleRpm: 6500,
          spindleDirection: 'CW',
          coolant: 'M8_FLOOD',
          workOffset: wcs,
          points: [
            { x: 0, y: 0, z: 25, isRapid: true },
            { x: 20, y: 15, z: 2, isRapid: true },
            { x: 20, y: 15, z: -8, feedRate: 350, segmentId: 'SEG_HELIX_ENTRY' },
            { x: 80, y: 15, z: -8, feedRate: 2000, segmentId: 'SEG_PASS_1' },
            { x: 80, y: 65, z: -8, feedRate: 2000, segmentId: 'SEG_PASS_2' },
            { x: 20, y: 65, z: -8, feedRate: 2000, segmentId: 'SEG_PASS_3' },
            { x: 20, y: 15, z: -8, feedRate: 2000, segmentId: 'SEG_PASS_4' },
            { x: 30, y: 25, z: -8, feedRate: 1800, segmentId: 'SEG_ISLAND_CLEAR' },
            { x: 70, y: 25, z: -8, feedRate: 1800, segmentId: 'SEG_ISLAND_CLEAR_2' },
            { x: 70, y: 55, z: -8, feedRate: 1800, segmentId: 'SEG_ISLAND_CLEAR_3' },
            { x: 30, y: 55, z: -8, feedRate: 1800, segmentId: 'SEG_ISLAND_CLEAR_4' },
            { x: 30, y: 25, z: -8, feedRate: 1800, segmentId: 'SEG_ISLAND_CLEAR_5' },
            { x: 30, y: 25, z: 25, isRapid: true, segmentId: 'SEG_RETRACT' }
          ]
        }
      ];
    } else if (selectedScenario === '4AXIS_ROTARY') {
      return [
        {
          operationId: 'OP_ROTARY_CYLINDER',
          operationName: '4-Axis Continuous Cylindrical Profiling',
          toolNumber: 1,
          toolSnapshot: t1,
          spindleRpm: 8000,
          spindleDirection: 'CW',
          coolant: 'M8_FLOOD',
          workOffset: wcs,
          points: [
            { x: 0, y: 0, z: 50, a: 0, isRapid: true, segmentId: 'SEG_APPROACH' },
            { x: 10, y: 0, z: 20, a: 0, feedRate: 400, segmentId: 'SEG_PLUNGE' },
            { x: 30, y: 0, z: 20, a: 90, feedRate: 1200, segmentId: 'SEG_ROT_1' },
            { x: 60, y: 0, z: 20, a: 180, feedRate: 1200, segmentId: 'SEG_ROT_2' },
            { x: 90, y: 0, z: 20, a: 270, feedRate: 1200, segmentId: 'SEG_ROT_3' },
            { x: 120, y: 0, z: 20, a: 360, feedRate: 1200, segmentId: 'SEG_ROT_4' },
            { x: 120, y: 0, z: 50, a: 360, isRapid: true, segmentId: 'SEG_SAFE_RETRACT' }
          ]
        }
      ];
    } else if (selectedScenario === '5AXIS_IMPELLER') {
      return [
        {
          operationId: 'OP_5AXIS_SWARF',
          operationName: '5-Axis Simultaneous Impeller Blade Swarf Milling',
          toolNumber: 2,
          toolSnapshot: t2,
          spindleRpm: 12000,
          spindleDirection: 'CW',
          coolant: 'M88_THROUGH_SPINDLE',
          workOffset: wcs,
          useRTCP: true,
          points: [
            { x: 0, y: 0, z: 120, b: 0, c: 0, isRapid: true, segmentId: 'SEG_5X_APPROACH' },
            { x: 15, y: 25, z: 45, b: 12.4, c: 35.8, feedRate: 600, segmentId: 'SEG_BLADE_LEAD_IN' },
            { x: 35, y: 40, z: 40, b: 18.2, c: 55.4, feedRate: 1400, segmentId: 'SEG_BLADE_SWARF_1' },
            { x: 55, y: 60, z: 35, b: 24.6, c: 78.1, feedRate: 1400, segmentId: 'SEG_BLADE_SWARF_2' },
            { x: 75, y: 80, z: 30, b: 29.8, c: 102.5, feedRate: 1400, segmentId: 'SEG_BLADE_SWARF_3' },
            { x: 95, y: 95, z: 25, b: 32.0, c: 125.0, feedRate: 1400, segmentId: 'SEG_BLADE_SWARF_4' },
            { x: 95, y: 95, z: 120, b: 0, c: 0, isRapid: true, segmentId: 'SEG_5X_RETRACT' }
          ]
        }
      ];
    } else {
      // MULTITOOL_PART
      return [
        {
          operationId: 'OP_ROUGH_FACE',
          operationName: 'Operation 1: Facing & Step Roughing D12',
          toolNumber: 1,
          toolSnapshot: t1,
          spindleRpm: 6000,
          spindleDirection: 'CW',
          coolant: 'M8_FLOOD',
          workOffset: wcs,
          points: [
            { x: -50, y: -50, z: 15, isRapid: true, segmentId: 'SEG_OP1_APP' },
            { x: -50, y: -50, z: 0, feedRate: 400, segmentId: 'SEG_OP1_PLUNGE' },
            { x: 50, y: -50, z: 0, feedRate: 2000, segmentId: 'SEG_OP1_CUT1' },
            { x: 50, y: 50, z: 0, feedRate: 2000, segmentId: 'SEG_OP1_CUT2' },
            { x: -50, y: 50, z: 0, feedRate: 2000, segmentId: 'SEG_OP1_CUT3' },
            { x: -50, y: -50, z: 15, isRapid: true, segmentId: 'SEG_OP1_RET' }
          ]
        },
        {
          operationId: 'OP_FINISH_CONTOUR',
          operationName: 'Operation 2: Fine 3D Ball Profiling D6',
          toolNumber: 2,
          toolSnapshot: t2,
          spindleRpm: 14000,
          spindleDirection: 'CW',
          coolant: 'M88_THROUGH_SPINDLE',
          workOffset: wcs,
          points: [
            { x: -40, y: -40, z: 10, isRapid: true, segmentId: 'SEG_OP2_APP' },
            { x: -40, y: -40, z: -5, feedRate: 300, segmentId: 'SEG_OP2_PLUNGE' },
            { x: 40, y: -40, z: -5, feedRate: 1500, segmentId: 'SEG_OP2_CUT1' },
            { x: 40, y: 40, z: -5, feedRate: 1500, segmentId: 'SEG_OP2_CUT2' },
            { x: -40, y: 40, z: -5, feedRate: 1500, segmentId: 'SEG_OP2_CUT3' },
            { x: -40, y: -40, z: 15, isRapid: true, segmentId: 'SEG_OP2_RET' }
          ]
        }
      ];
    }
  };

  // Run Post Processor
  const handlePostProcess = async () => {
    setIsProcessing(true);
    try {
      const machine = machines.find(m => m.machineId === selectedMachineId) || machines[0];
      const postDef = profiles.find(p => p.postId === selectedProfileId) || profiles[0];

      const configData = {
        configId: `CFG_${programName}_${Date.now()}`,
        programNumberOrName: programName,
        programComment,
        units,
        selectedWorkOffset: wcs,
        enableLineNumbers,
        lineNumberIncrement: 10,
        enableModalOptimization: enableModalOpt,
        enableSafetyBlocks,
        enableRTCP,
        compensationApplication: 'CAM_APPLIED' as const,
        linearPrecision: 3,
        rotaryPrecision: 4
      };
      const configHash = await generateDeterministicHash(configData);
      const configuration: PostConfiguration = { ...configData, configHash };

      const operations = buildScenarioOperations();

      const result = await PostProcessorEngine.execute({
        programName,
        programComment,
        operations,
        machine,
        postDefinition: postDef,
        configuration
      });

      setNcProgram(result.program);
      setEvidence(result.evidence);
      if (result.program.blocks.length > 0) {
        setSelectedBlock(result.program.blocks[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto post on mount once registries are loaded
  useEffect(() => {
    if (machines.length > 0 && profiles.length > 0 && !ncProgram) {
      handlePostProcess();
    }
  }, [machines, profiles]);

  // Execute Gate 262
  const handleRunGate = async () => {
    setIsRunningGate(true);
    try {
      const report = await HardAcceptanceGate262.executeGate();
      setGateReport(report);
      setShowGateModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunningGate(false);
    }
  };

  // Compare Diff
  const handleRunDiff = () => {
    if (!ncProgram) return;
    const diff = PostProcessorEngine.compareNC(ncProgram.rawGCodeText, diffTextB);
    setDiffResults(diff);
    setShowDiff(true);
  };

  const handleDownloadNC = () => {
    if (!ncProgram) return;
    const ext = selectedProfileId.includes('SIEMENS') ? '.mpf' : selectedProfileId.includes('HEIDENHAIN') ? '.h' : '.nc';
    const blob = new Blob([ncProgram.rawGCodeText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${programName}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadEvidence = () => {
    if (!evidence) return;
    const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Evidence_${programName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeMachine = machines.find(m => m.machineId === selectedMachineId);
  const activeProfile = profiles.find(p => p.postId === selectedProfileId);

  return (
    <div id="post-processor-workspace" className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans">
      {/* HEADER BAR */}
      <header id="post-header-bar" className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-white">PATCH-262 — Real CAM Post Processor Engine</h1>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                ISO & Dialect Verified
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Deterministic NC Generator • Kinematics Preserving • Bidirectional Source Mapping • Controller Dialects
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-run-gate-262"
            onClick={handleRunGate}
            disabled={isRunningGate}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 rounded-lg hover:bg-emerald-900/60 transition disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            {isRunningGate ? 'Verifying Gate 262...' : 'Hard Acceptance Gate 262'}
          </button>

          <button
            id="btn-post-process-main"
            onClick={handlePostProcess}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isProcessing ? 'Generating NC...' : 'Generate NC Program'}
          </button>
        </div>
      </header>

      {/* MAIN CONTENT SPLIT */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* LEFT COLUMN: MACHINE & CONFIGURATION DECK */}
        <div id="post-config-sidebar" className="col-span-3 border-r border-slate-800 bg-slate-900/40 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* SCENARIO SELECTOR */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" /> CAM Machining Scenario
            </label>
            <select
              id="select-scenario"
              value={selectedScenario}
              onChange={(e) => handleScenarioChange(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="3AXIS_POCKET">3-Axis Adaptive Pocket Roughing (Haas NGC)</option>
              <option value="4AXIS_ROTARY">4-Axis Rotary Cylinder Engraving (Fanuc 31i)</option>
              <option value="5AXIS_IMPELLER">5-Axis Impeller Swarf Milling (Siemens TRAORI)</option>
              <option value="MULTITOOL_PART">Multi-Operation Tool Changes (Heidenhain TNC)</option>
            </select>
          </div>

          {/* TARGET MACHINE */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" /> CNC Machine Definition
            </label>
            <select
              id="select-machine"
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {machines.map(m => (
                <option key={m.machineId} value={m.machineId}>
                  {m.name} ({m.machineType})
                </option>
              ))}
            </select>
            {activeMachine && (
              <div className="text-[11px] font-mono text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80 flex flex-col gap-1">
                <div>Travel: X [{activeMachine.axes.X.minLimit}, {activeMachine.axes.X.maxLimit}] Y [{activeMachine.axes.Y.minLimit}, {activeMachine.axes.Y.maxLimit}] Z [{activeMachine.axes.Z.minLimit}, {activeMachine.axes.Z.maxLimit}] mm</div>
                <div>Spindle: {activeMachine.spindle.maxRpm.toLocaleString()} RPM • Max Feed: {activeMachine.axes.X.maxFeedRate.toLocaleString()} mm/min</div>
              </div>
            )}
          </div>

          {/* POST PROCESSOR PROFILE */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" /> Controller Dialect Profile
            </label>
            <select
              id="select-post-profile"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {profiles.map(p => (
                <option key={p.postId} value={p.postId}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* CONFIGURATION PARAMETERS */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-slate-400" /> Post Configuration
            </label>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400">Program ID</span>
                <input
                  id="input-prog-name"
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Work Coordinate</span>
                <select
                  id="select-wcs"
                  value={wcs}
                  onChange={(e) => setWcs(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="G54">G54 (Primary)</option>
                  <option value="G55">G55</option>
                  <option value="G56">G56</option>
                  <option value="G57">G57</option>
                  <option value="G58">G58</option>
                  <option value="G59">G59</option>
                </select>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400">Program Header Comment</span>
              <input
                id="input-prog-comment"
                type="text"
                value={programComment}
                onChange={(e) => setProgramComment(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              />
            </div>

            {/* TOGGLES */}
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Line Numbering (N10, N20)</span>
                <input
                  id="toggle-line-num"
                  type="checkbox"
                  checked={enableLineNumbers}
                  onChange={(e) => setEnableLineNumbers(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Modal Optimization (Suppress duplicate G/M)</span>
                <input
                  id="toggle-modal-opt"
                  type="checkbox"
                  checked={enableModalOpt}
                  onChange={(e) => setEnableModalOpt(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Safety Blocks & Retract Codes</span>
                <input
                  id="toggle-safety"
                  type="checkbox"
                  checked={enableSafetyBlocks}
                  onChange={(e) => setEnableSafetyBlocks(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>5-Axis RTCP (TCPC / TRAORI)</span>
                <input
                  id="toggle-rtcp"
                  type="checkbox"
                  checked={enableRTCP}
                  onChange={(e) => setEnableRTCP(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
              </label>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: G-CODE EDITOR & SOURCE CODE VIEWER */}
        <div id="post-gcode-viewer" className="col-span-5 border-r border-slate-800 flex flex-col bg-slate-950">
          {/* TOOLBAR */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/60 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-mono text-slate-200">{programName}</span>
              <span className="text-[10px] text-slate-500">({ncProgram ? `${ncProgram.totalLines} lines` : '0 lines'})</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-copy-gcode"
                onClick={() => {
                  if (ncProgram) navigator.clipboard.writeText(ncProgram.rawGCodeText);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
              <button
                id="btn-download-nc"
                onClick={handleDownloadNC}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
              >
                <Download className="w-3 h-3" /> Download NC
              </button>
            </div>
          </div>

          {/* CODE SCROLL AREA */}
          <div className="flex-1 overflow-y-auto font-mono text-xs p-3 space-y-0.5 bg-slate-950">
            {ncProgram ? (
              ncProgram.blocks.map((block, idx) => {
                const isSelected = selectedBlock?.sequenceNumber === block.sequenceNumber;
                return (
                  <div
                    key={idx}
                    id={`gcode-line-${idx}`}
                    onClick={() => setSelectedBlock(block)}
                    className={`flex items-baseline px-2 py-0.5 rounded cursor-pointer transition select-text ${
                      isSelected
                        ? 'bg-blue-600/30 text-blue-200 border-l-2 border-blue-500'
                        : 'hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <span className="w-10 text-right pr-4 text-slate-600 select-none text-[11px]">
                      {idx + 1}
                    </span>
                    <span className="flex-1 font-mono tracking-tight">
                      {block.rawText}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-slate-500 p-6 text-center">Click "Generate NC Program" to post toolpath.</div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SOURCE MAP INSPECTOR & VALIDATION DECK */}
        <div id="post-inspector-panel" className="col-span-4 flex flex-col bg-slate-900/30 p-4 gap-4 overflow-y-auto">
          {/* VALIDATION STATUS CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Machine & Dialect Verification
              </span>
              {ncProgram?.validationStatus === 'VALIDATED' ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> VALIDATED
                </span>
              ) : ncProgram?.validationStatus === 'LIMIT_EXCEEDED' ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/30">
                  <XCircle className="w-3.5 h-3.5" /> LIMIT EXCEEDED
                </span>
              ) : (
                <span className="text-xs text-slate-500">PENDING</span>
              )}
            </div>

            {ncProgram && (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 pt-1">
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">ESTIMATED TIME</div>
                  <div className="text-amber-300 font-semibold">{ncProgram.estimatedCycleTimeSec}s</div>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">TOTAL BLOCKS</div>
                  <div className="text-blue-300 font-semibold">{ncProgram.totalBlocks}</div>
                </div>
              </div>
            )}

            {ncProgram && ncProgram.validationErrors.length > 0 && (
              <div className="text-xs text-rose-300 bg-rose-950/40 p-2 rounded border border-rose-800/50 space-y-1">
                {ncProgram.validationErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <XCircle className="w-3.5 h-3.5 mt-0.5 text-rose-400 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BIDIRECTIONAL SOURCE MAP INSPECTOR */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2 flex-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" /> Source Map & Kinematic Pose
            </span>

          {selectedBlock ? (
            <div className="space-y-2.5 text-xs">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono space-y-1">
                <div className="text-blue-400 font-bold text-[13px]">{selectedBlock.rawText}</div>
                <div className="text-slate-500 text-[11px]">Command Type: <span className="text-slate-300">{selectedBlock.commandType}</span></div>
                {selectedBlock.sourceOperationName && (
                  <div className="text-slate-500 text-[11px]">Source Op: <span className="text-emerald-400">{selectedBlock.sourceOperationName}</span></div>
                )}
                {selectedBlock.sourceToolpathSegmentId && (
                  <div className="text-slate-500 text-[11px]">Segment: <span className="text-amber-400">{selectedBlock.sourceToolpathSegmentId}</span></div>
                )}
              </div>

              {selectedBlock.modalStateAfter && (
                <>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-slate-500">Modal State</span>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono bg-slate-950 p-2 rounded border border-slate-800">
                      <div>Motion: <span className="text-slate-300">{selectedBlock.modalStateAfter?.motionMode || 'NONE'}</span></div>
                      <div>Plane: <span className="text-slate-300">{selectedBlock.modalStateAfter?.plane || 'G17'}</span></div>
                      <div>Spindle: <span className="text-slate-300">{selectedBlock.modalStateAfter?.spindleState || 'OFF'} ({selectedBlock.modalStateAfter?.currentSpindleRpm || 0} RPM)</span></div>
                      <div>Coolant: <span className="text-slate-300">{selectedBlock.modalStateAfter?.coolantState || 'OFF'}</span></div>
                      <div>Feed: <span className="text-slate-300">{selectedBlock.modalStateAfter?.currentFeedRate || 0} mm/min</span></div>
                      <div>Tool: <span className="text-slate-300">T{selectedBlock.modalStateAfter?.activeToolNumber || 0} (H{selectedBlock.modalStateAfter?.activeToolHOffset || 0})</span></div>
                    </div>
                  </div>

                  {selectedBlock.modalStateAfter.currentPosition && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-slate-500">Machine Pose Coordinates</span>
                      <div className="grid grid-cols-3 gap-1 text-[11px] font-mono bg-slate-950 p-2 rounded border border-slate-800 text-center">
                        <div>X: <span className="text-amber-400">{selectedBlock.modalStateAfter.currentPosition.x?.toFixed(3) ?? '-'}</span></div>
                        <div>Y: <span className="text-amber-400">{selectedBlock.modalStateAfter.currentPosition.y?.toFixed(3) ?? '-'}</span></div>
                        <div>Z: <span className="text-amber-400">{selectedBlock.modalStateAfter.currentPosition.z?.toFixed(3) ?? '-'}</span></div>
                        <div>A: <span className="text-purple-400">{selectedBlock.modalStateAfter.currentPosition.a?.toFixed(3) ?? '-'}°</span></div>
                        <div>B: <span className="text-purple-400">{selectedBlock.modalStateAfter.currentPosition.b?.toFixed(3) ?? '-'}°</span></div>
                        <div>C: <span className="text-purple-400">{selectedBlock.modalStateAfter.currentPosition.c?.toFixed(3) ?? '-'}°</span></div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-xs py-4 text-center">Select any G-code line on the left to inspect.</div>
          )}
          </div>

          {/* CRYPTOGRAPHIC PROVENANCE HASH */}
          {evidence && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Evidence Certificate
                </span>
                <button
                  id="btn-download-evidence"
                  onClick={handleDownloadEvidence}
                  className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> JSON
                </button>
              </div>

              <div className="text-[10px] font-mono text-slate-400 bg-slate-950 p-2 rounded border border-slate-800 space-y-1">
                <div>NC Hash: <span className="text-slate-200">{evidence.ncProgramHash.substring(0, 24)}...</span></div>
                <div>Post Hash: <span className="text-slate-200">{evidence.postDefinitionHash.substring(0, 24)}...</span></div>
                <div>Machine Hash: <span className="text-slate-200">{evidence.machineHash.substring(0, 24)}...</span></div>
                <div>Digest SHA-256: <span className="text-emerald-400">{evidence.provenanceDigestSha256.substring(0, 24)}...</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HARD ACCEPTANCE GATE 262 MODAL */}
      {showGateModal && gateReport && (
        <div id="gate-262-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${gateReport.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">HARD ACCEPTANCE GATE 262 — REAL CAM POST PROCESSOR</h2>
                  <p className="text-xs text-slate-400">Formal Verification Battery • Reference Benchmarks A–G & 15 Adversarial Edge Tests</p>
                </div>
              </div>
              <button
                id="btn-close-gate-modal"
                onClick={() => setShowGateModal(false)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition"
              >
                Close
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {/* STATUS SUMMARY */}
              <div className={`p-4 rounded-lg border flex items-center justify-between ${
                gateReport.passed
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                <div className="flex items-center gap-3">
                  {gateReport.passed ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <XCircle className="w-6 h-6 text-rose-400" />}
                  <div>
                    <div className="font-bold text-sm">
                      {gateReport.passed ? 'ALL GATE 262 REQUIREMENTS SATISFIED' : 'GATE 262 QUALIFICATION FAILED'}
                    </div>
                    <div className="text-xs opacity-80">
                      {gateReport.passedTests} of {gateReport.totalTests} tests passed with 100% cryptographic determinism.
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  <div>SHA-256 Digest:</div>
                  <div className="text-amber-300">{gateReport.complianceCertificateDigestSha256.substring(0, 20)}...</div>
                </div>
              </div>

              {/* TEST RESULTS LIST */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Execution Battery Breakdown</h3>
                <div className="space-y-1.5 max-h-96 overflow-y-auto font-mono text-xs">
                  {gateReport.testResults.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        {t.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="text-slate-200">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400">
                        <span className="text-[10px] text-slate-500">{t.durationMs.toFixed(1)}ms</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}>
                          {t.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
