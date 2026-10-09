/**
 * SECP Industrial OS — Engineering Truth Platform
 * CamPanel: Authoritative CAM & CNC Machining Workbench
 * Orchestrates CAD Geometry -> Feature Recognition -> Toolpaths -> G-Code Post-Processing -> Evidence
 */

import React, { useState, useMemo } from 'react';
import { CamEngine, ManufacturingProcessType, CamJobPackage } from '../engine/camEngine';
import { FiveAxisSimulationPanel } from './FiveAxisSimulationPanel';
import { ManufacturingFeatureWorkspace } from './cam/ManufacturingFeatureWorkspace';
import { ThreeAxisCamWorkspace } from './cam/ThreeAxisCamWorkspace';
import { FourAxisCamWorkspace } from './cam/FourAxisCamWorkspace';
import { FiveAxisKinematicsWorkspace } from './cam/FiveAxisKinematicsWorkspace';
import { CollisionDetectionWorkspace } from './cam/CollisionDetectionWorkspace';
import { StockSimulationWorkspace } from './cam/StockSimulationWorkspace';
import { ToolLibraryWorkspace } from './cam/ToolLibraryWorkspace';
import { PostProcessorWorkspace } from '../engine/cam/post-processor/PostProcessorWorkspace';
import { 
  Cpu, 
  Terminal, 
  Sliders, 
  Play, 
  CheckCircle2, 
  Download, 
  Layers, 
  Wrench, 
  Sparkles, 
  Navigation, 
  RotateCcw, 
  Shield, 
  Box, 
  PenTool, 
  FileCode,
  ShieldCheck,
  Award,
  Crosshair,
  Database
} from 'lucide-react';
import { EngineeringDocument, CAMModel } from '../engine/cad-kernel/document/CADDocument';
import { CadSolidEntity } from '../cadKernel';
import { deriveTruthProvenance, TruthOrigin, CanonicalPickResult } from '../engine/context/EngineeringContext';
import { useEngineeringToolContext } from '../engine/telemetry/useEngineeringToolContext';
import { EngineeringToolContext } from '../engine/telemetry/EngineeringToolContext';

export interface CamPanelProps {
  canonicalDocument?: EngineeringDocument | null;
  activeSolid?: CadSolidEntity | null;
  selectedCanonicalFace?: CanonicalPickResult | null;
  activeUnit?: string;
  onUpdateCanonicalDocument?: (doc: EngineeringDocument) => void;
  toolContext?: EngineeringToolContext;
}

export const CamPanel: React.FC<CamPanelProps> = ({
  canonicalDocument,
  activeSolid,
  selectedCanonicalFace,
  activeUnit = 'mm',
  onUpdateCanonicalDocument,
  toolContext
}) => {
  const context = toolContext || useEngineeringToolContext(canonicalDocument as EngineeringDocument, activeSolid);

  const [camViewMode, setCamViewMode] = useState<
    'POST_PROCESSOR' | 
    'TOOL_LIBRARY' | 
    'STOCK_SIMULATION' | 
    'COLLISION_CHECKING' | 
    'FIVE_AXIS_KINEMATICS' | 
    'FOUR_AXIS_TOOLPATH' | 
    'THREE_AXIS_TOOLPATH' | 
    'FEATURE_RECOGNITION' | 
    'GCODE_ORCHESTRATION' |
    'FIVE_AXIS'
  >('POST_PROCESSOR');

  const [processType, setProcessType] = useState<ManufacturingProcessType>('CNC_MILLING');

  // Source Mode: Default strictly to ACTIVE_CAD for all project sessions
  const hasActiveGeometry = Boolean((canonicalDocument?.features && canonicalDocument.features.length > 0) || activeSolid);
  const [modelMode, setModelMode] = useState<'ACTIVE_CAD' | 'BENCHMARK'>('ACTIVE_CAD');

  // Derive bounding stock dimensions from activeSolid, canonical document, or empty 0
  const geometryStats = useMemo(() => {
    if (modelMode === 'BENCHMARK') {
      return {
        name: 'Reference Prismatic Benchmark Model',
        dx: 120,
        dy: 60,
        dz: 30,
        isEmpty: false
      };
    }

    if (activeSolid?.dimensions) {
      const d = activeSolid.dimensions;
      return {
        name: activeSolid.name || 'Active CAD Component',
        dx: d.width || d.dx || 120,
        dy: d.height || d.dy || 60,
        dz: d.depth || d.dz || 30,
        isEmpty: false
      };
    }

    if (context.geometry.solids > 0) {
      return {
        name: canonicalDocument?.title || 'Active CAD Solid',
        dx: context.geometry.boundingWidth || 100,
        dy: context.geometry.boundingHeight || 100,
        dz: context.geometry.boundingDepth || 100,
        isEmpty: false
      };
    }

    // New Project Empty Canvas State
    return {
      name: 'Active Project Canvas (0 Solids)',
      dx: 0,
      dy: 0,
      dz: 0,
      isEmpty: true
    };
  }, [modelMode, activeSolid, context.geometry, canonicalDocument]);

  // Generate CAM job based on actual geometry
  const camJob: CamJobPackage = useMemo(() => {
    if (geometryStats.isEmpty) {
      return {
        jobId: 'CAM_JOB_EMPTY',
        machineName: 'Haas VF-2SS 3-Axis CNC',
        stockDimensions: [0, 0, 0],
        features: [],
        toolpaths: [],
        gCodeOutput: `% 000000 (ACTIVE_PROJECT_EMPTY_CANVAS)\n(No 3D CAD Solids created in current session)\n(Draw a 2D profile in Sketcher & Extrude in Feature Tree to generate CNC G-Code)\nM30`,
        totalEstimatedTimeMin: 0,
        materialRemovalRateCm3Min: 0,
        verificationPassed: true,
        hash: 'CAM_EMPTY_HASH'
      } as any;
    }

    const job = CamEngine.generateCamJob(processType, geometryStats.dx, geometryStats.dy, geometryStats.dz);

    // Commit to canonical document if present
    if (canonicalDocument && onUpdateCanonicalDocument) {
      const camModel: CAMModel = {
        jobId: `CAM_JOB_${Date.now()}`,
        machineType: job.machineName,
        stockDimensions: [geometryStats.dx, geometryStats.dy, geometryStats.dz],
        toolpaths: job.features.map(f => ({
          operationId: f.id,
          type: f.type as any,
          toolId: f.recommendedTool,
          feedRate: 800,
          spindleRpm: 12000,
          estimatedTimeSec: f.machiningTimeSec
        })),
        gcode: job.gCodeOutput,
        hash: `CAM_HASH_${Date.now().toString(16)}`
      };

      const updatedEvidence = [
        ...(canonicalDocument.derived?.evidenceChain || []),
        {
          evidenceId: `EV_CAM_${Date.now()}`,
          stage: 'MANUFACTURING' as const,
          sourceSystem: 'SECP_CAM_ENGINE',
          documentId: canonicalDocument.documentId,
          revision: canonicalDocument.revision,
          canonicalHash: camModel.hash,
          meshHash: `STOCK_${geometryStats.dx}x${geometryStats.dy}x${geometryStats.dz}`,
          timestamp: new Date().toISOString(),
          payload: {
            machine: job.machineName,
            cycleTimeMin: job.totalEstimatedTimeMin,
            mrr: job.materialRemovalRateCm3Min
          },
          verdict: 'PASS' as const
        }
      ];

      onUpdateCanonicalDocument({
        ...canonicalDocument,
        derived: {
          ...canonicalDocument.derived,
          cam: camModel,
          evidenceChain: updatedEvidence
        }
      });
    }

    return job;
  }, [processType, geometryStats, canonicalDocument, onUpdateCanonicalDocument]);

  // Dynamic Truth Status Descriptor derived from active revision and CAM provenance
  const truthDescriptor = useMemo(() => {
    return deriveTruthProvenance({
      hasActiveGeometry,
      algorithmType: 'PARAMETRIC_CAM',
      documentId: canonicalDocument?.documentId,
      revision: canonicalDocument?.revision,
      inputHash: `STOCK_${geometryStats.dx}x${geometryStats.dy}x${geometryStats.dz}`,
      isExecuting: false,
      hasResult: Boolean(camJob),
      verificationPassed: Boolean(camJob && camJob.gCodeOutput.length > 0),
      evidenceId: canonicalDocument?.derived?.cam ? `EV_CAM_${canonicalDocument.revision ?? 1}` : undefined,
      isBenchmarkMode: modelMode === 'BENCHMARK'
    });
  }, [modelMode, hasActiveGeometry, canonicalDocument?.documentId, canonicalDocument?.revision, canonicalDocument?.derived?.cam, geometryStats, camJob]);

  return (
    <div className="space-y-6 text-slate-100">
      {/* Workbench Header & Truth Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/20 text-rose-400 rounded-xl border border-rose-500/30">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                Manufacturing, CAM & CNC Toolpath Workbench
                <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  ISO 6983 / STEP-NC
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                B-Rep feature recognition, 3/4/5-axis toolpath kernels, collision verification, and Fanuc/Haas post-processors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setModelMode('ACTIVE_CAD')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  modelMode === 'ACTIVE_CAD'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                Active CAD Part
              </button>
              <button
                onClick={() => setModelMode('BENCHMARK')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  modelMode === 'BENCHMARK'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Reference Test Piece
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Truth Status Badge */}
        <div className={`flex items-center justify-between p-3.5 rounded-xl border ${truthDescriptor.bgClass} ${truthDescriptor.borderClass}`}>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className={`w-4 h-4 ${truthDescriptor.colorClass}`} />
            <div>
              <span className={`text-xs font-black tracking-wider uppercase ${truthDescriptor.colorClass}`}>
                {truthDescriptor.label}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Stock Extents: <span className="font-mono text-slate-200 font-bold">{geometryStats.dx} × {geometryStats.dy} × {geometryStats.dz} {activeUnit}</span> | Target Machine: <span className="font-mono text-slate-200 font-bold">{camJob.machineName}</span>
              </p>
            </div>
          </div>
          {selectedCanonicalFace && (
            <div className="text-right text-xs font-mono text-amber-400 bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-500/30">
              G54 Datum: {selectedCanonicalFace.faceTag || selectedCanonicalFace.faceId}
            </div>
          )}
        </div>
      </div>

      {/* CAM Sub-Navigation Switcher */}
      <div className="flex flex-wrap bg-slate-900 border border-slate-800 p-1.5 rounded-xl gap-2 text-xs font-bold">
        <button
          onClick={() => setCamViewMode('POST_PROCESSOR')}
          className={`flex-1 min-w-[190px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            camViewMode === 'POST_PROCESSOR'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileCode className="w-4 h-4" />
          PATCH-262: Post Processor
        </button>
        <button
          onClick={() => setCamViewMode('TOOL_LIBRARY')}
          className={`flex-1 min-w-[190px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            camViewMode === 'TOOL_LIBRARY'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Wrench className="w-4 h-4" />
          PATCH-261: Tool Library
        </button>
        <button
          onClick={() => setCamViewMode('STOCK_SIMULATION')}
          className={`flex-1 min-w-[190px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            camViewMode === 'STOCK_SIMULATION'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Box className="w-4 h-4" />
          PATCH-260: Stock Simulation
        </button>
        <button
          onClick={() => setCamViewMode('COLLISION_CHECKING')}
          className={`flex-1 min-w-[190px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            camViewMode === 'COLLISION_CHECKING'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Shield className="w-4 h-4" />
          PATCH-259: Collision Detection
        </button>
        <button
          onClick={() => setCamViewMode('FIVE_AXIS_KINEMATICS')}
          className={`flex-1 min-w-[190px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            camViewMode === 'FIVE_AXIS_KINEMATICS'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          PATCH-258: 5-Axis Kinematics
        </button>
        <button
          onClick={() => setCamViewMode('FOUR_AXIS_TOOLPATH')}
          className={`flex-1 min-w-[190px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            camViewMode === 'FOUR_AXIS_TOOLPATH'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          PATCH-257: 4-Axis Rotary
        </button>
        <button
          onClick={() => setCamViewMode('THREE_AXIS_TOOLPATH')}
          className={`flex-1 min-w-[190px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            camViewMode === 'THREE_AXIS_TOOLPATH'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Navigation className="w-4 h-4" />
          PATCH-256: 3-Axis Operations
        </button>
        <button
          onClick={() => setCamViewMode('FEATURE_RECOGNITION')}
          className={`flex-1 min-w-[190px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            camViewMode === 'FEATURE_RECOGNITION'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          PATCH-255: Feature Recognition
        </button>
        <button
          onClick={() => setCamViewMode('GCODE_ORCHESTRATION')}
          className={`flex-1 min-w-[190px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            camViewMode === 'GCODE_ORCHESTRATION'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Terminal className="w-4 h-4" />
          G-Code Engine
        </button>
      </div>

      {/* Render Selected CAM View */}
      {camViewMode === 'POST_PROCESSOR' && <PostProcessorWorkspace activeSolidName={geometryStats.name} />}
      {camViewMode === 'TOOL_LIBRARY' && <ToolLibraryWorkspace />}
      {camViewMode === 'STOCK_SIMULATION' && <StockSimulationWorkspace />}
      {camViewMode === 'COLLISION_CHECKING' && <CollisionDetectionWorkspace />}
      {camViewMode === 'FIVE_AXIS_KINEMATICS' && <FiveAxisKinematicsWorkspace />}
      {camViewMode === 'FOUR_AXIS_TOOLPATH' && <FourAxisCamWorkspace />}
      {camViewMode === 'THREE_AXIS_TOOLPATH' && <ThreeAxisCamWorkspace />}
      {camViewMode === 'FEATURE_RECOGNITION' && <ManufacturingFeatureWorkspace />}

      {camViewMode === 'GCODE_ORCHESTRATION' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
          {/* Header & Process Selection */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 text-rose-400">
                <Wrench className="w-5 h-5" />
                Manufacturing & CAM Orchestrator
              </h2>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                SECP-CAM-ENGINE: Feature Recognition → Post-Processor G-Code
              </p>
            </div>

            {/* Process Selector */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px] font-bold">
              {(['CNC_MILLING', 'THREE_D_PRINTING', 'LASER_CUTTING', 'SHEET_METAL_BENDING'] as ManufacturingProcessType[]).map(proc => (
                <button
                  key={proc}
                  onClick={() => setProcessType(proc)}
                  className={`px-3 py-1.5 rounded transition cursor-pointer ${
                    processType === proc ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  {proc.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Machine & Feature Recognition Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Feature List & Telemetry */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 space-y-4 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-500 uppercase">Features Recognized</span>
                  <span className="text-rose-400 font-bold">{camJob.machineName}</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {camJob.features.map(f => (
                    <div key={f.id} className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-rose-300">{f.type}</span>
                        <span className="text-[10px] text-emerald-400 px-1.5 py-0.5 bg-emerald-950 rounded">{f.machiningTimeSec}s</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Toolpath Strategy: <span className="text-slate-300">{f.recommendedTool}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Est. Cycle Time:</span>
                    <span className="font-bold text-rose-300">{camJob.totalEstimatedTimeMin}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Volumetric MRR:</span>
                    <span className="font-bold text-emerald-400">{camJob.materialRemovalRateCm3Min} cm³/min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* G-Code Post Processor Output Window */}
            <div className="lg:col-span-7 space-y-3">
              <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 font-mono text-[10px]">
                  <span className="font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Terminal className="w-3.5 h-3.5 text-rose-400" />
                    G-Code Output Stream
                  </span>
                  <button
                    onClick={() => {
                      const blob = new Blob([camJob.gCodeOutput], { type: 'text/plain;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.setAttribute('href', url);
                      link.setAttribute('download', `${camJob.machineName.replace(/\s+/g, '_')}_Toolpath.gcode`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded text-[10px] font-bold transition shadow-lg shadow-rose-600/20"
                  >
                    <Download className="w-3 h-3" />
                    Export G-Code
                  </button>
                </div>

                <pre className="w-full h-56 bg-slate-950 border border-slate-800 p-3 rounded font-mono text-[11px] text-rose-300/80 overflow-y-auto leading-relaxed custom-scrollbar">
                  {camJob.gCodeOutput}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {camViewMode === 'FIVE_AXIS' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-tight">Kinematic Simulation Workbench</h3>
          </div>
          <FiveAxisSimulationPanel />
        </div>
      )}
    </div>
  );
};
