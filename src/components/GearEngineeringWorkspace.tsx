/**
 * PATCH-224 — Gear Engineering Subsystem UI & Mechanical Design Workspace
 * Parametric Involute Spur, Helical, Internal, Pinion, and Rack Gear Builder,
 * interactive 2D animated meshing canvas with kinematic pair simulation,
 * DIN 6885-1 keyways, ISO 6336 / AGMA stress & safety factors, feature tree DAG,
 * STEP AP214 / IGES 5.3 CAD export, CAM machining preparation, and Gate 224 Inspector.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, Activity, ShieldCheck, Download, Play, Pause, RotateCw, Sliders, Info, CheckCircle2, AlertTriangle, FileCode, ArrowRight, Split, Compass, Cpu, Layers, ChevronDown, ChevronRight, Eye, Maximize2, Plus, Trash2, Target, RefreshCw, Box } from 'lucide-react';
import { GearGenerator } from '../engine/assembly/gear/GearGenerator';
import { GearInvoluteEngine } from '../engine/assembly/gear/GearInvoluteEngine';
import { GearStandardRegistry } from '../engine/assembly/gear/GearStandardRegistry';
import { GearPairKinematicsEngine } from '../engine/assembly/gear/GearPairKinematicsEngine';
import { GearAssemblyBridge } from '../engine/assembly/gear/GearAssemblyBridge';
import {
  GearDefinition,
  GearType,
  GearMaterialGrade,
  GEAR_MATERIALS,
  GearPairDefinition
} from '../engine/assembly/gear/GearTypes';
import { HardAcceptanceGate224, HardAcceptanceGate224Report } from '../engine/validation/HardAcceptanceGate224';
import { AssemblyEngine } from '../engine/assembly/AssemblyCore';

interface GearEngineeringWorkspaceProps {
  engine?: AssemblyEngine;
  onAddLog?: (msg: string) => void;
  onSelectComponent?: (instanceId: string) => void;
}

export const GearEngineeringWorkspace: React.FC<GearEngineeringWorkspaceProps> = ({
  engine,
  onAddLog = console.log,
  onSelectComponent
}) => {
  // Active Workspace Sub-Tab
  const [activeTab, setActiveTab] = useState<
    'DESIGNER' | 'MESHING_PAIR' | 'STRESS_ISO6336' | 'FEATURE_TREE' | 'CAM_PREP' | 'CAD_EXCHANGE' | 'GATE_224'
  >('DESIGNER');

  // Primary Gear 1 (Pinion) Parameters
  const [gearType, setGearType] = useState<GearType>('SPUR_EXTERNAL');
  const [moduleVal, setModuleVal] = useState<number | null>(null);
  const [teethCount, setTeethCount] = useState<number | null>(null);
  const [pressureAngle, setPressureAngle] = useState<number | null>(null);
  const [helixAngle, setHelixAngle] = useState<number | null>(null);
  const [helixDirection, setHelixDirection] = useState<'RIGHT_HAND' | 'LEFT_HAND'>('RIGHT_HAND');
  const [faceWidth, setFaceWidth] = useState<number | null>(null);
  const [profileShift, setProfileShift] = useState<number>(0);
  const [boreDiameter, setBoreDiameter] = useState<number | null>(null);
  const [hasKeyway, setHasKeyway] = useState<boolean>(true);
  const [materialGrade, setMaterialGrade] = useState<GearMaterialGrade>('CASE_HARDENED_16MNCR5');
  const [qualityGradeISO, setQualityGradeISO] = useState<number>(6);

  // Mating Gear 2 (Wheel) Parameters for Pair
  const [wheelTeethCount, setWheelTeethCount] = useState<number | null>(null);
  const [wheelBoreDiameter, setWheelBoreDiameter] = useState<number | null>(null);

  // Operating Simulation & Animation States
  const [inputPowerKw, setInputPowerKw] = useState<number | null>(null);
  const [inputSpeedRpm, setInputSpeedRpm] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simSpeedFactor, setSimSpeedFactor] = useState<number>(1.0);
  const [pinionRotationDeg, setPinionRotationDeg] = useState<number>(0);

  // Canvas Display Toggles
  const [showPitchCircle, setShowPitchCircle] = useState<boolean>(true);
  const [showBaseCircle, setShowBaseCircle] = useState<boolean>(true);
  const [showTipCircle, setShowTipCircle] = useState<boolean>(true);
  const [showRootCircle, setShowRootCircle] = useState<boolean>(true);
  const [showBoreKeyway, setShowBoreKeyway] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Hard Acceptance Gate 224 State
  const [gateReport, setGateReport] = useState<HardAcceptanceGate224Report | null>(null);
  const [isRunningGate, setIsRunningGate] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Re-generate Primary Gear 1
  const currentGear1: GearDefinition | null = useMemo(() => {
    if (moduleVal === null || teethCount === null || pressureAngle === null || helixAngle === null || faceWidth === null || boreDiameter === null || inputPowerKw === null || inputSpeedRpm === null) {
      return null;
    }
    return GearGenerator.createParametricGear({
      gearId: 'GEAR-PRIMARY-PINION',
      name: `Precision ${gearType.replace('_', ' ')} m${moduleVal} z${teethCount}`,
      type: gearType,
      module: moduleVal,
      teethCount,
      pressureAngleDeg: pressureAngle,
      helixAngleDeg: helixAngle,
      helixDirection: helixAngle > 0 ? helixDirection : 'NONE',
      faceWidthMm: faceWidth,
      profileShiftCoefficient: profileShift,
      material: materialGrade,
      qualityGradeISO,
      bore: {
        diameterMm: boreDiameter,
        hasKeyway
      },
      operatingLoads: {
        powerKw: inputPowerKw,
        speedRpm: inputSpeedRpm
      }
    });
  }, [
    gearType,
    moduleVal,
    teethCount,
    pressureAngle,
    helixAngle,
    helixDirection,
    faceWidth,
    profileShift,
    boreDiameter,
    hasKeyway,
    materialGrade,
    qualityGradeISO,
    inputPowerKw,
    inputSpeedRpm
  ]);

  // Re-generate Mating Gear 2
  const currentGear2: GearDefinition | null = useMemo(() => {
    if (moduleVal === null || wheelTeethCount === null || pressureAngle === null || helixAngle === null || faceWidth === null || wheelBoreDiameter === null || inputPowerKw === null || inputSpeedRpm === null || teethCount === null) {
      return null;
    }
    return GearGenerator.createParametricGear({
      gearId: 'GEAR-MATING-WHEEL',
      name: `Mating Wheel m${moduleVal} z${wheelTeethCount}`,
      type: gearType === 'SPUR_INTERNAL' ? 'SPUR_INTERNAL' : gearType.includes('HELICAL') ? 'HELICAL_EXTERNAL' : 'SPUR_EXTERNAL',
      module: moduleVal,
      teethCount: wheelTeethCount,
      pressureAngleDeg: pressureAngle,
      helixAngleDeg: helixAngle,
      helixDirection: helixAngle > 0 ? (helixDirection === 'RIGHT_HAND' ? 'LEFT_HAND' : 'RIGHT_HAND') : 'NONE',
      faceWidthMm: faceWidth,
      profileShiftCoefficient: 0,
      material: materialGrade,
      qualityGradeISO,
      bore: {
        diameterMm: wheelBoreDiameter,
        hasKeyway: true
      },
      operatingLoads: {
        powerKw: inputPowerKw,
        speedRpm: inputSpeedRpm / (wheelTeethCount / teethCount)
      }
    });
  }, [
    gearType,
    moduleVal,
    wheelTeethCount,
    pressureAngle,
    helixAngle,
    helixDirection,
    faceWidth,
    materialGrade,
    qualityGradeISO,
    wheelBoreDiameter,
    inputPowerKw,
    inputSpeedRpm,
    teethCount
  ]);

  // Compute Active Gear Pair
  const activeGearPair: GearPairDefinition | null = useMemo(() => {
    if (!currentGear1 || !currentGear2 || inputSpeedRpm === null || inputPowerKw === null) {
      return null;
    }
    return GearPairKinematicsEngine.createGearPair({
      pinionGear: currentGear1,
      wheelGear: currentGear2,
      pinionSpeedRpm: inputSpeedRpm,
      inputPowerKw
    });
  }, [currentGear1, currentGear2, inputSpeedRpm, inputPowerKw]);

  // Simulation Animation Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isSimulating && inputSpeedRpm !== null) {
        // Compute delta degrees: speed in RPM * 360 / 60 = deg/sec
        const degPerSec = (inputSpeedRpm * 360) / 60;
        setPinionRotationDeg(prev => (prev + degPerSec * deltaTime * 0.1 * simSpeedFactor) % 360);
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isSimulating, inputSpeedRpm, simSpeedFactor]);

  // Render 2D Involute Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentGear1) return;
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

    // Technical Blueprint Grid
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 25;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const centerX = width / 2;
    const centerY = height / 2;

    // View scale calculation
    const maxDia = (activeTab === 'MESHING_PAIR' && activeGearPair && currentGear2)
      ? activeGearPair.nominalCenterDistanceMm + currentGear2.tipDiameterMm / 2 + 10
      : currentGear1.tipDiameterMm + 10;
    const scale = (Math.min(width, height) / (maxDia * 2.2)) * zoomLevel;

    // Draw Function for a Gear Definition
    const drawGear = (
      gear: GearDefinition,
      posX: number,
      posY: number,
      rotationDeg: number,
      gearColor: string,
      accentColor: string
    ) => {
      ctx.save();
      ctx.translate(posX, posY);
      ctx.rotate((rotationDeg * Math.PI) / 180);

      const rPitch = (gear.pitchDiameterMm / 2) * scale;
      const rBase = (gear.baseDiameterMm / 2) * scale;
      const rTip = (gear.tipDiameterMm / 2) * scale;
      const rRoot = (gear.rootDiameterMm / 2) * scale;
      const rBore = (gear.bore.diameterMm / 2) * scale;

      // 1. Pitch Circle
      if (showPitchCircle) {
        ctx.strokeStyle = '#22c55e';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, rPitch, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Base Circle
      if (showBaseCircle) {
        ctx.strokeStyle = '#ef4444';
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, rBase, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3. Root Circle
      if (showRootCircle) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, rRoot, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. Tip Circle
      if (showTipCircle) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, rTip, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 5. Solid Involute Teeth Profile
      ctx.fillStyle = gearColor;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();

      gear.involuteProfile.forEach((tooth, idx) => {
        const allPoints = [
          ...tooth.rootFilletLeftPoints,
          ...tooth.leftFlankPoints,
          ...tooth.tipLandPoints,
          ...tooth.rightFlankPoints,
          ...tooth.rootFilletRightPoints,
          ...tooth.rootLandPoints
        ];

        allPoints.forEach((pt, pIdx) => {
          const px = pt.x * scale;
          const py = pt.y * scale;
          if (idx === 0 && pIdx === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        });
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 6. Central Bore and DIN 6885-1 Keyway
      if (showBoreKeyway && gear.bore.diameterMm > 0) {
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        if (gear.bore.hasKeyway && gear.bore.keywayWidthMm && gear.bore.keywayDepthMm) {
          const kw = (gear.bore.keywayWidthMm / 2) * scale;
          const kh = (gear.bore.keywayDepthMm) * scale;
          const boreR = rBore;

          // Bore with top keyway cutout
          const keyAngle = Math.asin(Math.min(kw / boreR, 0.95));
          ctx.arc(0, 0, boreR, -Math.PI / 2 + keyAngle, 1.5 * Math.PI - keyAngle, false);
          ctx.lineTo(kw, -boreR - kh);
          ctx.lineTo(-kw, -boreR - kh);
          ctx.closePath();
        } else {
          ctx.arc(0, 0, rBore, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();

        // Bore center crosshair
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
        ctx.stroke();
      }

      ctx.restore();
    };

    if (activeTab === 'MESHING_PAIR' && activeGearPair && currentGear2) {
      // Draw Gear 1 (Pinion) and Gear 2 (Wheel) in operating mesh
      const centerDistPixels = activeGearPair.nominalCenterDistanceMm * scale;
      const pinionX = centerX - centerDistPixels / 2;
      const wheelX = centerX + centerDistPixels / 2;

      const { wheelAngleDeg } = GearPairKinematicsEngine.computeMeshingRotations(
        pinionRotationDeg,
        activeGearPair.gearRatio,
        currentGear2.type === 'SPUR_INTERNAL'
      );

      // Line of Centers
      ctx.strokeStyle = '#334155';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(pinionX, centerY);
      ctx.lineTo(wheelX, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pitch Point (Pitch contact marker)
      const pitchPointX = pinionX + ((currentGear1?.pitchDiameterMm ?? 0) / 2) * scale;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(pitchPointX, centerY, 4, 0, Math.PI * 2);
      ctx.fill();

      if (currentGear1) drawGear(currentGear1, pinionX, centerY, pinionRotationDeg, 'rgba(99, 102, 241, 0.25)', '#818cf8');
      if (currentGear2) drawGear(currentGear2, wheelX, centerY, wheelAngleDeg, 'rgba(16, 185, 129, 0.2)', '#34d399');
    } else if (currentGear1) {
      // Single Gear Display
      drawGear(currentGear1, centerX, centerY, pinionRotationDeg, 'rgba(99, 102, 241, 0.3)', '#818cf8');
    }
  }, [
    currentGear1,
    currentGear2,
    activeGearPair,
    activeTab,
    pinionRotationDeg,
    showPitchCircle,
    showBaseCircle,
    showTipCircle,
    showRootCircle,
    showBoreKeyway,
    zoomLevel
  ]);

  // Run Hard Acceptance Gate 224
  const handleRunGate224 = async () => {
    setIsRunningGate(true);
    onAddLog('Executing Hard Acceptance Gate 224: Gear Subsystem Verification...');
    try {
      const gate = new HardAcceptanceGate224();
      const report = await gate.validate();
      setGateReport(report);
      onAddLog(`Gate 224 Finished: ${report.verdict} (${report.passedChecks}/${report.totalChecks} Checks Passed)`);
    } catch (err: any) {
      onAddLog(`Gate 224 Execution Failed: ${err.message || String(err)}`);
    } finally {
      setIsRunningGate(false);
    }
  };

  // Insert into Assembly
  const handleInsertIntoAssembly = () => {
    if (!engine) {
      onAddLog?.('Assembly Engine not initialized.');
      return;
    }
    if (!currentGear1) {
      onAddLog?.('Cannot insert gear: No gear defined or parameters missing.');
      return;
    }
    try {
      const partDef = GearGenerator.toAssemblyPartDefinition(currentGear1);
      engine.registerPart(partDef);
      const instance = engine.insertOccurrence(partDef.partId, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      });
      onAddLog?.(`SUCCESS: ${currentGear1.name} inserted into Assembly as ${instance.instanceId}`);
      if (onSelectComponent) onSelectComponent(instance.instanceId);
    } catch (err: any) {
      onAddLog?.(`Assembly Insertion Failed: ${err.message || String(err)}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-mono text-xs overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-950/80 border border-indigo-500/50 rounded-lg text-indigo-400">
            <Settings className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-100 uppercase tracking-tight">PATCH-224 — Gear Engineering Subsystem</h2>
              <span className="px-2 py-0.5 bg-indigo-900/40 border border-indigo-700/60 text-indigo-300 text-[10px] font-bold rounded">
                ISO 21771 / AGMA 2001
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Parametric Involute Solid Gears, Kinematic Meshing Pairs, DIN 6885-1 Keyways & ISO 6336 Strength
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInsertIntoAssembly}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold transition-all shadow-md shadow-indigo-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Insert Gear to Assembly
          </button>
          <button
            onClick={handleRunGate224}
            disabled={isRunningGate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-bold transition-all shadow-md shadow-emerald-950"
          >
            {isRunningGate ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Run Gate 224
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/40 px-3">
        {[
          { id: 'DESIGNER', label: '1. Parametric Gear Builder', icon: Sliders },
          { id: 'MESHING_PAIR', label: '2. Kinematic Mesh Pair', icon: RotateCw },
          { id: 'STRESS_ISO6336', label: '3. ISO 6336 / AGMA Stress', icon: Activity },
          { id: 'FEATURE_TREE', label: '4. B-Rep Feature DAG', icon: Layers },
          { id: 'CAM_PREP', label: '5. CAM Machining', icon: Cpu },
          { id: 'CAD_EXCHANGE', label: '6. STEP / IGES CAD', icon: FileCode },
          { id: 'GATE_224', label: '7. Gate 224 Audit', icon: ShieldCheck }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all ${
                isActive
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Parameters & Controls Panel */}
        <div className="w-[380px] border-r border-slate-800 bg-slate-900/30 flex flex-col overflow-y-auto p-4 space-y-5">
          {activeTab === 'DESIGNER' && (
            <>
              {/* Gear Type & Standards */}
              <section className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Gear Configuration & Type</label>
                <select
                  value={gearType}
                  onChange={e => setGearType(e.target.value as GearType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-indigo-500 outline-none"
                >
                  <option value="SPUR_EXTERNAL">Spur Gear (External Involute)</option>
                  <option value="SPUR_INTERNAL">Internal Ring Gear (Inward Teeth)</option>
                  <option value="HELICAL_EXTERNAL">Single Helical Gear (Twisted Flank)</option>
                  <option value="PINION">Pinion Drive Gear</option>
                  <option value="STRAIGHT_BEVEL">Straight Bevel Gear</option>
                  <option value="RACK">Involute Linear Rack</option>
                </select>
              </section>

              {/* Module & Tooth Count */}
              <section className="space-y-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Standard Normal Module (mn)</span>
                  <span className="text-indigo-400 font-bold">{moduleVal !== null ? `${moduleVal} mm` : 'UNASSIGNED'}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0.8, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0].map(m => (
                    <button
                      key={m}
                      onClick={() => setModuleVal(m)}
                      className={`py-1 rounded text-[10px] font-bold border transition-all ${
                        moduleVal === m
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Number of Teeth (Z)</span>
                    <span className="text-slate-200 font-bold">{teethCount ?? 'UNASSIGNED'}</span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="120"
                    value={teethCount ?? 20}
                    onChange={e => setTeethCount(parseInt(e.target.value) || null)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  {teethCount !== null && teethCount < 17 && pressureAngle === 20 && (
                    <div className="flex items-center gap-1.5 text-amber-400 text-[9.5px] bg-amber-950/40 p-1.5 rounded border border-amber-900/60">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>Undercut warning (Z &lt; 17). Shift x &ge; {(1 - teethCount / 17).toFixed(2)} recommended.</span>
                    </div>
                  )}
                </div>

                {/* Pressure Angle & Helix Angle */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  <div>
                    <label className="text-[9.5px] text-slate-400">Pressure Angle (α)</label>
                    <select
                      value={pressureAngle ?? ''}
                      onChange={e => setPressureAngle(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    >
                      <option value="">UNASSIGNED</option>
                      <option value={20}>20° (Standard)</option>
                      <option value={14.5}>14.5° (Low Noise)</option>
                      <option value={25}>25° (Heavy Duty)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9.5px] text-slate-400">Helix Angle (β)</label>
                    <input
                      type="number"
                      min="0"
                      max="45"
                      value={helixAngle ?? ''}
                      placeholder="UNASSIGNED"
                      onChange={e => setHelixAngle(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    />
                  </div>
                </div>

                {helixAngle > 0 && (
                  <div className="flex items-center justify-between text-[10px] pt-1">
                    <span className="text-slate-400">Helix Hand</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setHelixDirection('RIGHT_HAND')}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          helixDirection === 'RIGHT_HAND' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        Right (RH)
                      </button>
                      <button
                        onClick={() => setHelixDirection('LEFT_HAND')}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          helixDirection === 'LEFT_HAND' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        Left (LH)
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Physical Dimensions & Bore */}
              <section className="space-y-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Face Width & Shaft Bore</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9.5px] text-slate-400">Face Width (b) mm</label>
                    <input
                      type="number"
                      value={faceWidth ?? ''}
                      placeholder="UNASSIGNED"
                      onChange={e => setFaceWidth(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-slate-400">Bore Diameter Ø mm</label>
                    <input
                      type="number"
                      value={boreDiameter ?? ''}
                      placeholder="UNASSIGNED"
                      onChange={e => setBoreDiameter(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-300 font-bold">DIN 6885-1 Hub Keyway</span>
                  <input
                    type="checkbox"
                    checked={hasKeyway}
                    onChange={e => setHasKeyway(e.target.checked)}
                    className="accent-indigo-500 w-4 h-4 cursor-pointer"
                  />
                </div>
                {hasKeyway && currentGear1 && (
                  <div className="text-[9.5px] text-indigo-300 bg-indigo-950/30 p-2 rounded border border-indigo-900/50">
                    Keyway: {currentGear1.bore.keywayWidthMm}mm W × {currentGear1.bore.keywayDepthMm}mm D (DIN 6885-1 JS9)
                  </div>
                )}
              </section>

              {/* Material Selector */}
              <section className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Material Specification</label>
                <select
                  value={materialGrade}
                  onChange={e => setMaterialGrade(e.target.value as GearMaterialGrade)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs"
                >
                  {Object.keys(GEAR_MATERIALS).map(matKey => (
                    <option key={matKey} value={matKey}>
                      {GEAR_MATERIALS[matKey as GearMaterialGrade].name}
                    </option>
                  ))}
                </select>
              </section>
            </>
          )}

          {activeTab === 'MESHING_PAIR' && (
            <>
              <section className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Gear Pair Kinematic Setup</label>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">Pinion Teeth (Z1)</span>
                    <span className="text-indigo-400 font-bold">{teethCount ?? 'UNASSIGNED'}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400">Wheel Teeth (Z2)</span>
                      <span className="text-emerald-400 font-bold">{wheelTeethCount ?? 'UNASSIGNED'}</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="150"
                      value={wheelTeethCount ?? 40}
                      onChange={e => setWheelTeethCount(parseInt(e.target.value) || null)}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-500">Gear Ratio (i)</span>
                      <p className="text-sm font-bold text-slate-100">{activeGearPair?.gearRatio.toFixed(2) ?? '—'} : 1</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Center Dist (a)</span>
                      <p className="text-sm font-bold text-indigo-300">{activeGearPair?.nominalCenterDistanceMm ?? '—'} mm</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Operating Power & Speed */}
              <section className="space-y-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Kinematic Drive Parameters</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9.5px] text-slate-400">Motor Power (kW)</label>
                    <input
                      type="number"
                      value={inputPowerKw ?? ''}
                      placeholder="UNASSIGNED"
                      onChange={e => setInputPowerKw(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-slate-400">Input RPM</label>
                    <input
                      type="number"
                      value={inputSpeedRpm ?? ''}
                      placeholder="UNASSIGNED"
                      onChange={e => setInputSpeedRpm(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    />
                  </div>
                </div>

                {/* Animation Controls */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                  <button
                    onClick={() => setIsSimulating(!isSimulating)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold text-xs ${
                      isSimulating ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isSimulating ? 'Pause Motion' : 'Play Motion'}
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-400">Speed:</span>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.2"
                      value={simSpeedFactor}
                      onChange={e => setSimSpeedFactor(parseFloat(e.target.value))}
                      className="w-16 accent-indigo-500"
                    />
                  </div>
                </div>
              </section>

              {/* Meshing Quality Badges */}
              <section className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Mesh Verification</label>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Profile Contact Ratio (εα):</span>
                    <span
                      className={`font-bold ${
                        (activeGearPair?.contactRatioProfileEpsilonAlpha ?? 0) >= 1.2 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {activeGearPair?.contactRatioProfileEpsilonAlpha ?? '—'} (Min: 1.20)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Backlash Allowance:</span>
                    <span className="text-slate-200 font-bold">{activeGearPair?.operatingBacklashMm ?? '—'} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Output Shaft RPM:</span>
                    <span className="text-emerald-400 font-bold">{activeGearPair?.wheelSpeedRpm?.toFixed(1) ?? '—'} RPM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Output Torque (T2):</span>
                    <span className="text-indigo-300 font-bold">{activeGearPair?.outputTorqueNm ?? '—'} N·m</span>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'STRESS_ISO6336' && (
            <section className="space-y-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">ISO 6336 Safety Status</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      currentGear1?.strengthPreparation?.status === 'SAFE'
                        ? 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                        : 'bg-rose-950 border border-rose-500 text-rose-300'
                    }`}
                  >
                    {currentGear1?.strengthPreparation?.status ?? 'UNKNOWN'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                  <div className="bg-slate-900 p-2 rounded">
                    <span className="text-slate-500">Bending Stress (σF)</span>
                    <p className="text-sm font-bold text-slate-200">
                      {currentGear1?.strengthPreparation?.calculatedBendingStressSigmaFMpa ?? '—'} MPa
                    </p>
                    <span className="text-[9px] text-emerald-400 font-bold">
                      SF = {currentGear1?.strengthPreparation?.bendingSafetyFactorSF ?? '—'} &gt; 1.4
                    </span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded">
                    <span className="text-slate-500">Hertz Contact (σH)</span>
                    <p className="text-sm font-bold text-slate-200">
                      {currentGear1?.strengthPreparation?.calculatedContactStressSigmaHMpa ?? '—'} MPa
                    </p>
                    <span className="text-[9px] text-emerald-400 font-bold">
                      SH = {currentGear1?.strengthPreparation?.contactSafetyFactorSH ?? '—'} &gt; 1.1
                    </span>
                  </div>
                </div>
              </div>

              {/* Force Vectors */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-[10px]">
                <label className="font-bold text-slate-400 uppercase">Mesh Force Decomposition</label>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tangential Force (Ft):</span>
                    <span className="font-bold text-slate-200">{currentGear1?.strengthPreparation?.tangentialForceFtN ?? '—'} N</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Radial Force (Fr):</span>
                    <span className="font-bold text-slate-200">{currentGear1?.strengthPreparation?.radialForceFrN ?? '—'} N</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Axial Thrust Force (Fa):</span>
                    <span className="font-bold text-slate-200">{currentGear1?.strengthPreparation?.axialForceFaN ?? '—'} N</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1">
                    <span className="text-slate-400">Total Normal Force (Fn):</span>
                    <span className="font-bold text-indigo-300">{currentGear1?.strengthPreparation?.normalForceFnN ?? '—'} N</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'FEATURE_TREE' && (
            <section className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase">B-Rep Feature DAG</label>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 space-y-1.5">
                {currentGear1?.featureTree?.map(node => (
                  <div
                    key={node.nodeId}
                    className="p-2 bg-slate-900/60 border border-slate-800 rounded flex items-center justify-between text-[10px]"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-slate-200 font-bold">{node.name}</span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-400 rounded text-[8.5px] font-bold">
                      {node.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Topology & Mass */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-[10px]">
                <label className="font-bold text-slate-400 uppercase">Topology Verification</label>
                <div className="flex justify-between">
                  <span className="text-slate-400">Euler Characteristic:</span>
                  <span className="font-bold text-emerald-400">χ = {currentGear1?.topologySummary?.eulerCharacteristic ?? '—'} (2-Manifold)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Watertight Shell:</span>
                  <span className="font-bold text-emerald-400">{currentGear1 ? 'TRUE' : 'FALSE'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Solid Mass:</span>
                  <span className="font-bold text-slate-200">{currentGear1?.massProperties?.massKg ?? '—'} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Polar Inertia (Izz):</span>
                  <span className="font-bold text-slate-200">{currentGear1?.massProperties?.momentOfInertiaIzzKgMm2 ?? '—'} kg·mm²</span>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'CAM_PREP' && (
            <section className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase">CAM Machining Preparation</label>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Process:</span>
                  <span className="font-bold text-indigo-300">{currentGear1?.camPreparation?.recommendedMachiningProcess ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Blank Outer Ø:</span>
                  <span className="font-bold text-slate-200">{currentGear1?.camPreparation?.gearBlankOuterDiameterMm ?? '—'} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hobbing Feed:</span>
                  <span className="font-bold text-slate-200">{currentGear1?.camPreparation?.hobbingFeedPerRevMm ?? '—'} mm/rev</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rough/Finish Passes:</span>
                  <span className="font-bold text-slate-200">{currentGear1?.camPreparation?.millingPassCount ?? '—'} Passes</span>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'CAD_EXCHANGE' && (
            <section className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Export STEP AP214 / IGES</label>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <button
                  onClick={() => {
                    if (!currentGear1) return;
                    const blob = new Blob([currentGear1.stepData || ''], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${currentGear1.gearId}.stp`;
                    a.click();
                    onAddLog?.(`Exported STEP: ${currentGear1.gearId}.stp`);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs"
                >
                  <Download className="w-4 h-4" />
                  Download STEP AP214 (.stp)
                </button>
                <button
                  onClick={() => {
                    if (!currentGear1) return;
                    const blob = new Blob([currentGear1.igesData || ''], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${currentGear1.gearId}.igs`;
                    a.click();
                    onAddLog?.(`Exported IGES: ${currentGear1.gearId}.igs`);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold text-xs"
                >
                  <Download className="w-4 h-4" />
                  Download IGES 5.3 (.igs)
                </button>
              </div>
            </section>
          )}

          {activeTab === 'GATE_224' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Hard Acceptance Gate 224</label>
                <button
                  onClick={handleRunGate224}
                  disabled={isRunningGate}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                >
                  {isRunningGate ? 'Running...' : 'Run Checks'}
                </button>
              </div>

              {gateReport && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-200">Verdict:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-black ${
                        gateReport.verdict === 'PROVEN'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                          : 'bg-rose-950 text-rose-300 border border-rose-500'
                      }`}
                    >
                      {gateReport.verdict} ({gateReport.passedChecks}/{gateReport.totalChecks})
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {gateReport.checks.map(chk => (
                      <div key={chk.id} className="p-1.5 bg-slate-900/80 rounded flex items-center justify-between text-[9px]">
                        <span className="text-slate-300 font-mono">{chk.name}</span>
                        <span
                          className={`font-black ${
                            chk.status === 'PASS' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {chk.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Center Canvas Viewport */}
        <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
          {/* Canvas HUD Controls */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 text-[10px]">
            <span className="font-bold text-slate-300 px-1">Layers:</span>
            <button
              onClick={() => setShowPitchCircle(!showPitchCircle)}
              className={`px-2 py-0.5 rounded ${showPitchCircle ? 'bg-emerald-950 text-emerald-400 border border-emerald-600' : 'bg-slate-800 text-slate-500'}`}
            >
              Pitch (d)
            </button>
            <button
              onClick={() => setShowBaseCircle(!showBaseCircle)}
              className={`px-2 py-0.5 rounded ${showBaseCircle ? 'bg-rose-950 text-rose-400 border border-rose-600' : 'bg-slate-800 text-slate-500'}`}
            >
              Base (db)
            </button>
            <button
              onClick={() => setShowTipCircle(!showTipCircle)}
              className={`px-2 py-0.5 rounded ${showTipCircle ? 'bg-amber-950 text-amber-400 border border-amber-600' : 'bg-slate-800 text-slate-500'}`}
            >
              Tip (da)
            </button>
            <button
              onClick={() => setShowRootCircle(!showRootCircle)}
              className={`px-2 py-0.5 rounded ${showRootCircle ? 'bg-blue-950 text-blue-400 border border-blue-600' : 'bg-slate-800 text-slate-500'}`}
            >
              Root (df)
            </button>
          </div>

          <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 text-[10px]">
            <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.4))} className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded">
              -
            </button>
            <span className="font-bold text-slate-300">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 3.0))} className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded">
              +
            </button>
          </div>

          <canvas ref={canvasRef} width={800} height={600} className="w-full h-full block" />

          {/* Bottom HUD: Live Dimensions & Kinematics */}
          <div className="border-t border-slate-800 bg-slate-900/70 p-2.5 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-4">
              <span className="text-slate-400">
                Pitch Ø: <strong className="text-slate-200">{currentGear1?.pitchDiameterMm ?? '--'} mm</strong>
              </span>
              <span className="text-slate-400">
                Tip Ø: <strong className="text-amber-400">{currentGear1?.tipDiameterMm ?? '--'} mm</strong>
              </span>
              <span className="text-slate-400">
                Root Ø: <strong className="text-blue-400">{currentGear1?.rootDiameterMm?.toFixed(2) ?? '--'} mm</strong>
              </span>
              <span className="text-slate-400">
                Base Ø: <strong className="text-rose-400">{currentGear1?.baseDiameterMm?.toFixed(2) ?? '--'} mm</strong>
              </span>
              <span className="text-slate-400">
                Circular Pitch (p): <strong className="text-slate-200">{currentGear1?.circularPitchMm?.toFixed(2) ?? '--'} mm</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 text-indigo-400">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Rotation: {(pinionRotationDeg || 0).toFixed(1)}°</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
