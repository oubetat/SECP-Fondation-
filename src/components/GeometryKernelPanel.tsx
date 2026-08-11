/**
 * PATCH-SECP-003 — Geometry Kernel Workspace
 * Solid primitives, Boolean operations, Fillet, Chamfer, STEP Export/Import & Geometry Equality check.
 */

import React, { useState } from 'react';
import { CadGeometryKernel, CadSolidEntity, PrimitiveShapeType, BooleanOperationType } from '../engine/cadKernel';
import { Box, Layers, Scissors, CheckCircle2, Download, Upload, ShieldCheck, Cpu } from 'lucide-react';

interface GeometryKernelPanelProps {
  activeSolid: CadSolidEntity;
  onSolidChange: (solid: CadSolidEntity) => void;
  activeUnit: string;
}

export const GeometryKernelPanel: React.FC<GeometryKernelPanelProps> = ({
  activeSolid,
  onSolidChange,
  activeUnit,
}) => {
  const [stepData, setStepData] = useState<string>('');
  const [reimportedSolid, setReimportedSolid] = useState<CadSolidEntity | null>(null);
  const [equalityMatch, setEqualityMatch] = useState<boolean | null>(null);
  const [filletRadius, setFilletRadius] = useState<number>(10);
  const [chamferDist, setChamferDist] = useState<number>(5);

  const handleCreatePrimitive = (type: PrimitiveShapeType) => {
    let solid: CadSolidEntity;
    if (type === 'BOX') solid = CadGeometryKernel.createBox(250, 150, 100);
    else if (type === 'CYLINDER') solid = CadGeometryKernel.createCylinder(50, 180);
    else if (type === 'SPHERE') solid = CadGeometryKernel.createSphere(80);
    else if (type === 'CONE') solid = CadGeometryKernel.createCone(60, 20, 120);
    else solid = CadGeometryKernel.createTorus(100, 25);

    onSolidChange(solid);
    setStepData('');
    setReimportedSolid(null);
    setEqualityMatch(null);
  };

  const handleApplyBoolean = (op: BooleanOperationType) => {
    const toolCylinder = CadGeometryKernel.createCylinder(30, 200, 'Tool_Bore');
    const result = CadGeometryKernel.applyBooleanOperation(activeSolid, toolCylinder, op);
    onSolidChange(result);
  };

  const handleApplyFillet = () => {
    const result = CadGeometryKernel.applyFillet(activeSolid, filletRadius);
    onSolidChange(result);
  };

  const handleApplyChamfer = () => {
    const result = CadGeometryKernel.applyChamfer(activeSolid, chamferDist);
    onSolidChange(result);
  };

  const handleExportStep = () => {
    const step = CadGeometryKernel.exportToStepFormat(activeSolid);
    setStepData(step);
  };

  const handleReimportStep = () => {
    if (!stepData) return;
    const reimported = CadGeometryKernel.reimportStepFormat(stepData);
    setReimportedSolid(reimported);

    const isMatch = CadGeometryKernel.verifyGeometryEquality(activeSolid, reimported);
    setEqualityMatch(isMatch);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-cyan-400">
            <Cpu className="w-5 h-5 text-cyan-400" /> PATCH-SECP-003 — Geometry Kernel (C++ / OpenCASCADE Architecture)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            B-Rep Topology, Primitive Solids, Boolean Engine, STEP I/O & Geometry Verification.
          </p>
        </div>
        <div className="px-3 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300">
          Kernel Status: ONLINE (C++ Bridge Active)
        </div>
      </div>

      {/* Primitive Solid Creation Bar */}
      <div>
        <label className="text-xs text-slate-400 block mb-2 font-medium">1. Create Solid Primitives</label>
        <div className="flex flex-wrap gap-2">
          {(['BOX', 'CYLINDER', 'SPHERE', 'CONE', 'TORUS'] as PrimitiveShapeType[]).map(type => (
            <button
              key={type}
              onClick={() => handleCreatePrimitive(type)}
              className="px-3.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition border border-slate-700 flex items-center gap-1.5"
            >
              <Box className="w-3.5 h-3.5 text-cyan-400" /> {type}
            </button>
          ))}
        </div>
      </div>

      {/* Boolean Operations & Features Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
          <label className="text-xs text-slate-400 font-medium">2. Boolean Operations (Tool Solid)</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleApplyBoolean('FUSE')}
              className="px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-xs font-bold text-white rounded transition flex-1"
            >
              FUSE (Union)
            </button>
            <button
              onClick={() => handleApplyBoolean('CUT')}
              className="px-3 py-1.5 bg-cyan-600/80 hover:bg-cyan-600 text-xs font-bold text-white rounded transition flex-1"
            >
              CUT (Difference)
            </button>
            <button
              onClick={() => handleApplyBoolean('COMMON')}
              className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-xs font-bold text-white rounded transition flex-1"
            >
              COMMON (Intersect)
            </button>
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
          <label className="text-xs text-slate-400 font-medium">3. Edge Modifiers (Fillet & Chamfer)</label>
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-slate-400">Fillet:</span>
              <input
                type="number"
                value={filletRadius}
                onChange={e => setFilletRadius(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200"
              />
              <button
                onClick={handleApplyFillet}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold"
              >
                Apply
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-slate-400">Chamfer:</span>
              <input
                type="number"
                value={chamferDist}
                onChange={e => setChamferDist(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200"
              />
              <button
                onClick={handleApplyChamfer}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Solid B-Rep Properties Card */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
        <div>
          <span className="text-slate-500 block">Solid ID / Name</span>
          <span className="text-cyan-400 font-bold">{activeSolid.name}</span>
        </div>
        <div>
          <span className="text-slate-500 block">B-Rep Volume</span>
          <span className="text-emerald-400 font-bold">{activeSolid.volumeM3.toFixed(6)} m³</span>
        </div>
        <div>
          <span className="text-slate-500 block">Surface Area</span>
          <span className="text-indigo-400 font-bold">{activeSolid.surfaceAreaM2.toFixed(4)} m²</span>
        </div>
        <div>
          <span className="text-slate-500 block">Center of Gravity</span>
          <span className="text-slate-300">
            ({activeSolid.centerOfGravity.x.toFixed(2)}, {activeSolid.centerOfGravity.y.toFixed(2)}, {activeSolid.centerOfGravity.z.toFixed(2)})
          </span>
        </div>
      </div>

      {/* STEP Export / Re-Import Verification Workflow */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            4. STEP AP214 File I/O & Geometry Verification Workflow
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleExportStep}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export STEP
            </button>
            <button
              disabled={!stepData}
              onClick={handleReimportStep}
              className={`px-3 py-1.5 text-xs font-bold text-white rounded transition flex items-center gap-1.5 ${
                stepData ? 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer' : 'bg-slate-800 opacity-50 cursor-not-allowed'
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Re-Import STEP
            </button>
          </div>
        </div>

        {stepData && (
          <div className="flex flex-col gap-2">
            <textarea
              readOnly
              value={stepData}
              rows={4}
              className="w-full bg-slate-900 border border-slate-800 rounded p-3 text-[11px] font-mono text-slate-400 focus:outline-none"
            />
            {reimportedSolid && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>STEP File Re-Import Successful: Reimported Solid '{reimportedSolid.name}'</span>
                </div>
                {equalityMatch !== null && (
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 font-bold font-mono">
                    Geometry Equality Check: {equalityMatch ? 'PASS (100% Exact Match)' : 'FAILED'}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
