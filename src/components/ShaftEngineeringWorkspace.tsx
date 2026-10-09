/**
 * PATCH-223 — Shaft Engineering Subsystem UI & Mechanical Design Workspace
 * Parametric multi-section stepped/hollow/tapered shaft builder, visual interactive 2D profile canvas,
 * feature tree manager (keyways, retaining grooves, metric threads, cross holes, flats, shoulders),
 * ISO 286 / DIN 6885 / DIN 471 calculators, bearing seat recognition, assembly mating,
 * FEA strength/fatigue estimation, STEP AP214 / IGES export, and Hard Acceptance Gate 223 inspector.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Cylinder, Plus, Trash2, Settings, Layers, Activity, ShieldCheck, Download, Play, RotateCw, Sliders, Info, CheckCircle2, AlertTriangle, FileCode, ArrowRight, Split, Compass, Cpu, ChevronDown, ChevronRight, Eye, Crosshair, Lock, Unlock, Maximize2 } from 'lucide-react';
import { ShaftGenerator } from '../engine/assembly/shaft/ShaftGenerator';
import { ShaftStandardRegistry } from '../engine/assembly/shaft/ShaftStandardRegistry';
import { ShaftAssemblyBridge } from '../engine/assembly/shaft/ShaftAssemblyBridge';
import {
  ShaftDefinition,
  ShaftSection,
  GenericShaftFeature,
  KeywayFeature,
  SnapRingGrooveFeature,
  ThreadedShaftFeature,
  CrossHoleFeature,
  FlatFeature,
  ShaftMaterialGrade,
  SHAFT_MATERIALS
} from '../engine/assembly/shaft/ShaftTypes';
import { HardAcceptanceGate223, HardAcceptanceGate223Report } from '../engine/validation/HardAcceptanceGate223';
import { AssemblyEngine } from '../engine/assembly/AssemblyCore';
import { AssemblyComponent } from '../engine/assembly/AssemblyConstraintTypes';

interface ShaftEngineeringWorkspaceProps {
  engine: AssemblyEngine;
  onAddLog: (msg: string) => void;
  onSelectComponent: (instanceId: string) => void;
}

export const ShaftEngineeringWorkspace: React.FC<ShaftEngineeringWorkspaceProps> = ({
  engine,
  onAddLog,
  onSelectComponent
}) => {
  // Navigation sub-tabs
  const [subTab, setSubTab] = useState<'DESIGNER' | 'FEATURE_TREE' | 'BEARING_SEATS' | 'STRENGTH_FEA' | 'GATE_223'>('DESIGNER');

  // Shaft Master Parameters
  const [shaftName, setShaftName] = useState<string>('');
  const [materialGrade, setMaterialGrade] = useState<ShaftMaterialGrade>('CARBON_STEEL_C45');

  // Multi-Sections State
  const [sections, setSections] = useState<Array<{
    diameter: number;
    length: number;
    type: 'CYLINDRICAL' | 'STEPPED' | 'TAPERED' | 'HOLLOW';
    endDiameter?: number;
    innerDiameter?: number;
    surfaceFinishRa?: number;
    toleranceClass?: string;
    designation?: string;
  }>>([]);

  // Features State (Keyways, Grooves, Threads, Holes, Flats)
  const [features, setFeatures] = useState<GenericShaftFeature[]>([]);

  // Strength Loads Input
  const [appliedBendingMoment, setAppliedBendingMoment] = useState<number | null>(null);
  const [appliedTorsionalMoment, setAppliedTorsionalMoment] = useState<number | null>(null);
  const [appliedAxialForce, setAppliedAxialForce] = useState<number | null>(null);

  // Active Gate 223 Result State
  const [gate223Result, setGate223Result] = useState<HardAcceptanceGate223Report | null>(null);
  const [isRunningGate, setIsRunningGate] = useState<boolean>(false);
  const [selectedEvidenceFile, setSelectedEvidenceFile] = useState<string | null>(null);

  // Active Computed Shaft
  const currentShaft: ShaftDefinition | null = useMemo(() => {
    if (sections.length === 0) return null;
    return ShaftGenerator.createParametricShaft({
      name: shaftName || 'Unnamed Shaft',
      material: materialGrade,
      sections,
      features,
      appliedLoads: {
        bendingMomentNm: appliedBendingMoment ?? 0,
        torsionalMomentNm: appliedTorsionalMoment ?? 0,
        axialForceN: appliedAxialForce ?? 0
      }
    });
  }, [shaftName, materialGrade, sections, features, appliedBendingMoment, appliedTorsionalMoment, appliedAxialForce]);

  // Canvas Reference for 2D Section Cut Visualization
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw 2D Profile on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Synchronize canvas dimensions with parent element
    const parent = canvas.parentElement;
    if (parent && parent.clientWidth > 0 && parent.clientHeight > 0) {
      if (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    }

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Centerline Axis
    const centerY = height / 2;
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([8, 4, 2, 4]);
    ctx.beginPath();
    ctx.moveTo(20, centerY);
    ctx.lineTo(width - 20, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Compute Scaling
    const totalL = currentShaft?.massProperties?.totalLengthMm ?? 100;
    const maxR = currentShaft?.massProperties?.boundingRadiusMm ?? 20;
    const drawWidth = width - 80;
    const drawHeight = height - 80;
    const scaleX = drawWidth / (totalL || 1);
    const scaleY = (drawHeight / 2) / (maxR * 1.5 || 1);
    const startX = 40;

    // Draw Sections
    currentShaft?.sections?.forEach((sec, idx) => {
      const x = startX + sec.startZ * scaleX;
      const w = sec.length * scaleX;
      const hTop = (sec.diameter / 2) * scaleY;
      const hBot = (sec.diameter / 2) * scaleY;

      // Outer solid contour
      ctx.fillStyle = idx % 2 === 0 ? '#334155' : '#475569';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;

      ctx.fillRect(x, centerY - hTop, w, hTop * 2);
      ctx.strokeRect(x, centerY - hTop, w, hTop * 2);

      // Hollow section indication
      if (sec.innerDiameter && sec.innerDiameter > 0) {
        const hIn = (sec.innerDiameter / 2) * scaleY;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, centerY - hIn, w, hIn * 2);
        ctx.strokeStyle = '#64748b';
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x, centerY - hIn, w, hIn * 2);
        ctx.setLineDash([]);
      }

      // Section dimension label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Ø${sec.diameter}`, x + w / 2, centerY - hTop - 8);
      ctx.fillText(`${sec.length}mm`, x + w / 2, centerY + hBot + 14);
    });

    // Draw Features on Profile
    currentShaft?.features?.forEach(feat => {
      if (feat.suppressed) return;

      if (feat.type === 'KEYWAY') {
        const kw = feat as KeywayFeature;
        const sec = currentShaft?.sections[kw.sectionIndex];
        if (sec) {
          const x = startX + (sec.startZ + kw.offsetFromSectionStart) * scaleX;
          const w = kw.length * scaleX;
          const topY = centerY - (sec.diameter / 2) * scaleY;
          const depthH = kw.depth * scaleY;

          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(x, topY, w, depthH);
          ctx.strokeStyle = '#fbbf24';
          ctx.strokeRect(x, topY, w, depthH);
        }
      } else if (feat.type === 'SNAP_RING_GROOVE') {
        const gr = feat as SnapRingGrooveFeature;
        const sec = currentShaft.sections[gr.sectionIndex];
        if (sec) {
          const x = startX + (sec.startZ + gr.offsetFromSectionStart) * scaleX;
          const w = gr.grooveWidth * scaleX;
          const topY = centerY - (sec.diameter / 2) * scaleY;
          const depthH = ((sec.diameter - gr.grooveDiameter) / 2) * scaleY;

          ctx.fillStyle = '#ec4899';
          ctx.fillRect(x, topY, Math.max(w, 2), depthH);
          ctx.fillRect(x, centerY + (sec.diameter / 2) * scaleY - depthH, Math.max(w, 2), depthH);
        }
      }
    });
  }, [currentShaft]);

  // Handle Adding Section
  const handleAddSection = () => {
    const lastSec = sections[sections.length - 1];
    const newDia = lastSec ? lastSec.diameter : 25;
    setSections([...sections, {
      diameter: newDia,
      length: 40,
      type: 'CYLINDRICAL',
      toleranceClass: 'h6',
      surfaceFinishRa: 1.6,
      designation: `Section ${sections.length + 1}`
    }]);
    onAddLog(`[SHAFT-ENGINE] Added Section ${sections.length + 1} (Ø${newDia}x40mm)`);
  };

  // Handle Remove Section
  const handleRemoveSection = (index: number) => {
    if (sections.length <= 1) return;
    const next = [...sections];
    next.splice(index, 1);
    setSections(next);
    onAddLog(`[SHAFT-ENGINE] Removed Section ${index + 1}`);
  };

  // Handle Section Change
  const handleSectionChange = (index: number, field: string, val: any) => {
    const next = [...sections];
    next[index] = { ...next[index], [field]: val };
    setSections(next);
  };

  // Handle Add Keyway
  const handleAddKeyway = (secIdx: number) => {
    const sec = sections[secIdx];
    if (!sec) return;
    const std = ShaftStandardRegistry.getKeywayForDiameter(sec.diameter);
    const newKw: KeywayFeature = {
      featureId: `KW-${Date.now().toString().slice(-4)}`,
      type: 'KEYWAY',
      name: `Keyway DIN 6885-1 (${std.width}x${std.shaftDepth})`,
      sectionIndex: secIdx,
      standard: 'DIN_6885_1',
      keyType: 'PARALLEL_ROUND_ENDS_FORM_A',
      width: std.width,
      depth: std.shaftDepth,
      length: Math.min(sec.length * 0.7, 36),
      offsetFromSectionStart: 5,
      angularOrientationDeg: 0,
      suppressed: false
    };
    setFeatures([...features, newKw]);
    onAddLog(`[SHAFT-ENGINE] Added DIN 6885-1 Keyway on Section ${secIdx + 1}`);
  };

  // Handle Add Circlip Groove
  const handleAddGroove = (secIdx: number) => {
    const sec = sections[secIdx];
    if (!sec) return;
    const std = ShaftStandardRegistry.getSnapRingForDiameter(sec.diameter);
    const newGr: SnapRingGrooveFeature = {
      featureId: 'SR-' + Date.now().toString().slice(-4),
      type: 'SNAP_RING_GROOVE',
      name: `Circlip Groove DIN 471 (${sec.diameter}x${std.ringThickness})`,
      sectionIndex: secIdx,
      standard: 'DIN_471',
      grooveDiameter: std.grooveDiameter,
      grooveWidth: std.grooveWidth,
      offsetFromSectionStart: Math.max(sec.length - 8, 2),
      suppressed: false
    };
    setFeatures([...features, newGr]);
    onAddLog(`[SHAFT-ENGINE] Added DIN 471 Groove on Section ${secIdx + 1}`);
  };

  // Handle Add Metric Thread
  const handleAddThread = (secIdx: number) => {
    const sec = sections[secIdx];
    if (!sec) return;
    const std = ShaftStandardRegistry.getMetricThreadSpec(sec.diameter);
    const newTh: ThreadedShaftFeature = {
      featureId: 'TH-' + Date.now().toString().slice(-4),
      type: 'THREADED_SECTION',
      name: `External Thread M${sec.diameter}x${std.standardPitch}`,
      sectionIndex: secIdx,
      standard: 'METRIC_ISO_M',
      nominalDiameter: sec.diameter,
      pitch: std.standardPitch,
      threadLength: sec.length * 0.8,
      offsetFromSectionStart: 0,
      direction: 'RIGHT_HAND',
      termination: 'UNDERCUT_DIN_76',
      classTolerance: '6g',
      suppressed: false
    };
    setFeatures([...features, newTh]);
    onAddLog(`[SHAFT-ENGINE] Added M${sec.diameter} Thread on Section ${secIdx + 1}`);
  };

  // Insert Shaft Component into Assembly
  const handleInsertIntoAssembly = () => {
    if (!currentShaft) {
      onAddLog('[ASSEMBLY] Cannot insert shaft: No geometry defined.');
      return;
    }
    const partDef = ShaftGenerator.toAssemblyPartDefinition(currentShaft);
    engine.registerPart(partDef);

    const instanceId = `INST-${currentShaft.shaftId}`;
    const comp: AssemblyComponent = {
      instanceId,
      partId: currentShaft.shaftId,
      name: currentShaft.name,
      placementTransform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      },
      worldTransform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      },
      suppressed: false,
      fixed: false,
      colorHex: '#94a3b8'
    };

    engine.addComponent(comp);
    ShaAssemblyRegister(currentShaft, comp);
    onSelectComponent(instanceId);
    onAddLog(`[ASSEMBLY] Instantiated Parametric Shaft [${currentShaft.name}] into assembly.`);
  };

  const ShaAssemblyRegister = (def: ShaftDefinition, comp: AssemblyComponent) => {
    ShaftAssemblyBridge.registerDefinition(def);
    ShaftAssemblyBridge.registerInstance({
      instanceId: comp.instanceId,
      shaftId: def.shaftId,
      partNumber: def.manufacturingMetadata.partNumber,
      assemblyComponent: comp,
      shaftDefinition: def,
      mountedBearings: [],
      mountedGears: [],
      currentRotationDeg: 0,
      angularVelocityRpm: 1500,
      status: 'COUPLED'
    });
  };

  // Run Hard Acceptance Gate 223
  const handleRunGate223 = async () => {
    setIsRunningGate(true);
    onAddLog('[GATE-223] Commencing Hard Acceptance Gate 223 Validation Suite...');
    try {
      const gate = new HardAcceptanceGate223();
      const res = await gate.validate();
      setGate223Result(res);
      if (res.verdict === 'PROVEN') {
        onAddLog(`[GATE-223] PASS! Verdict: ${res.verdict} (${res.passedChecks}/${res.totalChecks} Checks Passed)`);
      } else {
        onAddLog(`[GATE-223] FAILED! Checks: ${res.passedChecks}/${res.totalChecks}`);
      }
    } catch (e: any) {
      onAddLog(`[GATE-223] Error: ${e.message}`);
    } finally {
      setIsRunningGate(false);
    }
  };

  // Export STEP
  const handleDownloadStep = () => {
    if (!currentShaft) {
      onAddLog('[EXCHANGE] Cannot export STEP: No geometry defined.');
      return;
    }
    const blob = new Blob([currentShaft.stepData || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentShaft.shaftId}.stp`;
    a.click();
    URL.revokeObjectURL(url);
    onAddLog(`[EXCHANGE] Exported STEP AP214 Solid [${currentShaft.shaftId}.stp]`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 1. Header Bar */}
      <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Cylinder className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-100">{shaftName || 'Unnamed Shaft'}</h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                {currentShaft?.validationStatus ?? 'UNVERIFIED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Parametric Solid Shaft • {currentShaft?.sections?.length ?? 0} Sections • L={currentShaft?.massProperties?.totalLengthMm ?? 0}mm • m={currentShaft?.massProperties?.massKg ?? 0}kg
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadStep}
            className="px-2.5 py-1.5 rounded text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            STEP AP214
          </button>
          <button
            onClick={handleInsertIntoAssembly}
            className="px-3 py-1.5 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Insert to Assembly
          </button>
        </div>
      </div>

      {/* 2. Visual 2D Profile Canvas */}
      <div className="h-44 bg-slate-900/80 border-b border-slate-800 p-3 relative flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] text-slate-400 z-10">
          <span className="font-mono flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            Cross-Section 2D Profile & Mechanical Features
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400"></span> Base Solid</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Keyway</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400"></span> Circlip Groove</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> Axis Z</span>
          </div>
        </div>

        <div className="flex-1 w-full relative my-1 overflow-hidden rounded border border-slate-800">
          <canvas
            ref={canvasRef}
            width={750}
            height={110}
            className="w-full h-full block bg-slate-950"
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>Z=0.0mm</span>
          <span>Material: {SHAFT_MATERIALS[materialGrade].name}</span>
          <span>Z={currentShaft?.massProperties?.totalLengthMm ?? 0}mm</span>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/40 text-[11px] font-bold">
        <button
          onClick={() => setSubTab('DESIGNER')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            subTab === 'DESIGNER'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Sections & Geometry
        </button>
        <button
          onClick={() => setSubTab('FEATURE_TREE')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            subTab === 'FEATURE_TREE'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Feature Tree ({currentShaft?.features?.length ?? 0})
        </button>
        <button
          onClick={() => setSubTab('BEARING_SEATS')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            subTab === 'BEARING_SEATS'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Bearing Seats ({currentShaft?.bearingSeats?.length ?? 0})
        </button>
        <button
          onClick={() => setSubTab('STRENGTH_FEA')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            subTab === 'STRENGTH_FEA'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Strength & FEA
        </button>
        <button
          onClick={() => setSubTab('GATE_223')}
          className={`flex-1 py-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            subTab === 'GATE_223'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Gate 223
        </button>
      </div>

      {/* 4. Tab Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {subTab === 'DESIGNER' && (
          <div className="space-y-4">
            {/* Global Settings */}
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Shaft Designation</label>
                <input
                  type="text"
                  value={shaftName}
                  onChange={e => setShaftName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Material Grade</label>
                <select
                  value={materialGrade}
                  onChange={e => setMaterialGrade(e.target.value as ShaftMaterialGrade)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {Object.keys(SHAFT_MATERIALS).map(m => (
                    <option key={m} value={m}>{SHAFT_MATERIALS[m as ShaftMaterialGrade].name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sections Editor List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Multi-Sections Definition</h3>
                <button
                  onClick={handleAddSection}
                  className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Section
                </button>
              </div>

              {sections.map((sec, idx) => (
                <div key={idx} className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={sec.designation || ''}
                        onChange={e => handleSectionChange(idx, 'designation', e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none border-b border-transparent focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddKeyway(idx)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800 hover:bg-amber-900/80"
                      >
                        + Keyway
                      </button>
                      <button
                        onClick={() => handleAddGroove(idx)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-950/60 text-pink-300 border border-pink-800 hover:bg-pink-900/80"
                      >
                        + Circlip
                      </button>
                      <button
                        onClick={() => handleAddThread(idx)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-800 hover:bg-indigo-900/80"
                      >
                        + Thread
                      </button>
                      {sections.length > 1 && (
                        <button
                          onClick={() => handleRemoveSection(idx)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-xs">
                    <div>
                      <span className="block text-[9px] text-slate-500">Diameter (Ø mm)</span>
                      <input
                        type="number"
                        value={sec.diameter}
                        onChange={e => handleSectionChange(idx, 'diameter', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500">Length (L mm)</span>
                      <input
                        type="number"
                        value={sec.length}
                        onChange={e => handleSectionChange(idx, 'length', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500">Type</span>
                      <select
                        value={sec.type}
                        onChange={e => handleSectionChange(idx, 'type', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                      >
                        <option value="CYLINDRICAL">Cylindrical</option>
                        <option value="TAPERED">Tapered</option>
                        <option value="HOLLOW">Hollow</option>
                      </select>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500">Tolerance (ISO 286)</span>
                      <input
                        type="text"
                        value={sec.toleranceClass || 'h6'}
                        onChange={e => handleSectionChange(idx, 'toleranceClass', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500">Finish Ra (µm)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={sec.surfaceFinishRa || 1.6}
                        onChange={e => handleSectionChange(idx, 'surfaceFinishRa', parseFloat(e.target.value) || 1.6)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === 'FEATURE_TREE' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Parametric Feature Tree & DAG</h3>
            <div className="bg-slate-900/60 rounded-lg border border-slate-800 divide-y divide-slate-800">
              {currentShaft?.featureTree?.map((node, idx) => (
                <div key={node.nodeId} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono text-slate-500">#{idx}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{node.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {node.type}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Parents: [{node.parentNodes.join(', ') || 'ROOT'}]
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      node.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {node.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === 'BEARING_SEATS' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Automatic Bearing Seat Recognition</h3>
            <div className="grid grid-cols-2 gap-3">
              {currentShaft?.bearingSeats?.map((seat, idx) => (
                <div key={idx} className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Seat #{idx + 1} (Section {seat.sectionIndex + 1})</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {seat.bearingSeatStatus}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                    <div>Journal Ø: <strong className="text-slate-200">{seat.journalDiameter} mm</strong> ({seat.isoFitClass})</div>
                    <div>Length: <strong className="text-slate-200">{seat.journalLength} mm</strong></div>
                    <div>Z Position: <strong className="text-slate-200">{seat.axialPositionZ} mm</strong></div>
                    <div>Shoulder Ø: <strong className="text-slate-200">{seat.shoulderDiameter ? `${seat.shoulderDiameter} mm` : 'None'}</strong></div>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-500 block mb-1">Recommended Bearings:</span>
                    <div className="flex flex-wrap gap-1">
                      {seat.matchingBearingPartNumbers.map(b => (
                        <span key={b} className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === 'STRENGTH_FEA' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Bending Moment (N·m)</label>
                <input
                  type="number"
                  value={appliedBendingMoment}
                  onChange={e => setAppliedBendingMoment(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Torsional Moment (N·m)</label>
                <input
                  type="number"
                  value={appliedTorsionalMoment}
                  onChange={e => setAppliedTorsionalMoment(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Axial Force (N)</label>
                <input
                  type="number"
                  value={appliedAxialForce}
                  onChange={e => setAppliedAxialForce(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                />
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Von Mises Stress</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {currentShaft?.strengthPreparation?.equivalentVonMisesStressMpa ?? '--'} <span className="text-xs font-normal text-slate-400">MPa</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Yield: {SHAFT_MATERIALS[materialGrade].yieldStrengthMpa} MPa
                </span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Static Safety Factor</span>
                <span className={`text-lg font-black font-mono ${(currentShaft?.strengthPreparation?.staticSafetyFactor ?? 0) >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {currentShaft?.strengthPreparation?.staticSafetyFactor ?? '--'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Target SF &gt; 1.5</span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Fatigue Life (Goodman)</span>
                <span className="text-lg font-black text-sky-400 font-mono">
                  {currentShaft?.strengthPreparation?.fatigueSafetyFactorGoodman ?? '--'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Endurance: {SHAFT_MATERIALS[materialGrade].fatigueLimitEnduranceMpa} MPa</span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">1st Critical Speed</span>
                <span className="text-lg font-black text-purple-400 font-mono">
                  {currentShaft?.strengthPreparation?.firstCriticalSpeedRpm ?? '--'} <span className="text-xs font-normal text-slate-400">RPM</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Rayleigh-Dunkley Approx</span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Torsional Twist</span>
                <span className="text-lg font-black text-slate-200 font-mono">
                  {currentShaft?.strengthPreparation?.torsionalDeflectionDegPerM ?? '--'} <span className="text-xs font-normal text-slate-400">°/m</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">G: {SHAFT_MATERIALS[materialGrade].shearModulusGpa} GPa</span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Bending Deflection</span>
                <span className="text-lg font-black text-slate-200 font-mono">
                  {currentShaft?.strengthPreparation?.maximumBendingDeflectionUm ?? '--'} <span className="text-xs font-normal text-slate-400">µm</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">E: {SHAFT_MATERIALS[materialGrade].youngsModulusGpa} GPa</span>
              </div>
            </div>
          </div>
        )}

        {subTab === 'GATE_223' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-200">Hard Acceptance Gate 223</h3>
                <p className="text-[11px] text-slate-400">Multi-stage formal verification gate for parametric shafts.</p>
              </div>
              <button
                onClick={handleRunGate223}
                disabled={isRunningGate}
                className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 disabled:opacity-50"
              >
                {isRunningGate ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run Gate 223
              </button>
            </div>

            {gate223Result && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border flex items-center justify-between ${
                  gate223Result.verdict === 'PROVEN' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-red-950/40 border-red-800 text-red-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">Verdict: {gate223Result.verdict}</div>
                      <div className="text-[10px] text-slate-400">{gate223Result.passedChecks} of {gate223Result.totalChecks} Checks Passed</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{gate223Result.timestamp}</span>
                </div>

                <div className="bg-slate-900/60 rounded-lg border border-slate-800 divide-y divide-slate-800">
                  {gate223Result.checks.map(c => (
                    <div key={c.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-200">{c.id} — {c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.description}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        c.status === 'PASS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
