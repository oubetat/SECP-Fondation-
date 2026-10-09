/**
 * SECP CAD/CAE Platform - Material Constitutive Models Workspace
 * PATCH-233 — Material Constitutive Engine
 *
 * Provides a comprehensive engineering UI to:
 * - Inspect material definitions, constitutive laws, units, & provenance
 * - Interactively test Linear Elasticity, Orthotropic, Anisotropic, & J2 Plasticity
 * - Execute finite-difference vs analytical consistent tangent (dSigma/dEps) checks
 * - Simulate temperature dependency E(T), Yield(T)
 * - Run Hard Acceptance Gate 233 qualification battery (15 criteria)
 */

import React, { useState, useMemo } from 'react';
import { Activity, Layers, ShieldCheck, Cpu, FileCheck, CheckCircle2, Binary } from 'lucide-react';
import { MaterialConstitutiveLibrary } from '../../engine/fem/material/constitutive/MaterialConstitutiveLibrary';
import { MaterialConstitutiveDefinition, MaterialPointState } from '../../engine/fem/material/constitutive/ConstitutiveTypes';
import { IsotropicLinearElasticModel } from '../../engine/fem/material/constitutive/IsotropicLinearElasticModel';
import { OrthotropicElasticModel } from '../../engine/fem/material/constitutive/OrthotropicElasticModel';
import { J2ConstitutivePlasticityModel } from '../../engine/fem/material/constitutive/J2ConstitutivePlasticityModel';
import { MaterialPointStateManager } from '../../engine/fem/material/constitutive/MaterialPointStateManager';
import { ConsistentTangentEngine } from '../../engine/fem/material/constitutive/ConsistentTangentEngine';
import { FEMConstitutivePipelineIntegrator } from '../../engine/fem/material/constitutive/FEMConstitutivePipelineIntegrator';
import { HardAcceptanceGate233, HardGateResult233 } from '../../engine/fem/material/constitutive/HardAcceptanceGate233';

export const MaterialConstitutiveWorkspace: React.FC = () => {
  const materials = useMemo(() => MaterialConstitutiveLibrary.list(), []);
  const [selectedMatId, setSelectedMatId] = useState<string | null>(() => materials[0]?.id || 'MAT_STEEL_4340');
  const [strain11, setStrain11] = useState<number | null>(null); 
  const [shear12, setShear12] = useState<number | null>(null);
  const [temperatureK, setTemperatureK] = useState<number | null>(null); 
  const [activeTab, setActiveTab] = useState<'RESPONSE' | 'TANGENT' | 'SCHEMA' | 'GATE'>('RESPONSE');
  const [gateResult, setGateResult] = useState<HardGateResult233 | null>(null);

  const selectedDef = useMemo(() => {
    if (!selectedMatId) return null;
    return MaterialConstitutiveLibrary.get(selectedMatId);
  }, [selectedMatId]);

  // Compute live constitutive response given user inputs
  const evaluationResult = useMemo(() => {
    if (!selectedDef || temperatureK === null || strain11 === null || shear12 === null) {
      return { error: 'Incomplete parameters' };
    }
    const sm = new MaterialPointStateManager();
    const state: MaterialPointState = sm.initializeState('UI_ELEM_1', 0, temperatureK);

    const strainIncrement = [strain11, 0, 0, 0, 0, shear12];

    if (!selectedDef) return { error: 'No material selected' };

    try {
      if (selectedDef.constitutiveType === 'ORTHOTROPIC_LINEAR_ELASTIC') {
        const model = new OrthotropicElasticModel(selectedDef);
        return { response: model.updateStress(strainIncrement, state), tangent: model.Stiffness6x6, model };
      }
      if (selectedDef.constitutiveType === 'J2_PLASTICITY') {
        const model = new J2ConstitutivePlasticityModel(selectedDef);
        const resp = model.updateStress(strainIncrement, state);
        const tangentReport = ConsistentTangentEngine.verifyTangentByFiniteDifference(model, state, strainIncrement);
        return { response: resp, tangent: resp.tangent, tangentReport, model };
      }
      const model = new IsotropicLinearElasticModel(selectedDef);
      return { response: model.updateStress(strainIncrement, state), tangent: model.C_el, model };
    } catch (err: any) {
      return { error: err.message };
    }
  }, [selectedDef, strain11, shear12, temperatureK]);

  // Compute element stiffness integration via full pipeline
  const pipelineResult = useMemo(() => {
    try {
      const sm = new MaterialPointStateManager();
      return FEMConstitutivePipelineIntegrator.integrateElement({
        elementId: 'UI_BAR_ELEM',
        elementType: 'BAR2',
        nodeCoords: [[0, 0, 0], [1.0, 0, 0]],
        nodeDisplacements: [0, strain11],
        materialDef: selectedDef,
        stateManager: sm,
        temperatureK
      });
    } catch (err) {
      return null;
    }
  }, [selectedDef, strain11, temperatureK]);

  const runGate233 = () => {
    const res = HardAcceptanceGate233.runGate();
    setGateResult(res);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans p-6 overflow-y-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PATCH-233
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Material Constitutive Engine
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Gauss point mechanical response, radial return plasticity, consistent tangent matrix (dσ/dε), &amp; FEM integration pipeline.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={runGate233}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-900/20 transition"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Execute Gate 233 Battery</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Controls & Selector, Right Workspaces */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Material Selector & Parameter Sliders */}
        <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Select Material Definition
            </label>
            <select
              value={selectedMatId}
              onChange={(e) => setSelectedMatId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {materials.map((m, idx) => {
                const matId = m.identity?.materialId || (m as any).id || `mat-${idx}`;
                const name = m.identity?.name || (m as any).name || 'Material';
                return (
                  <option key={matId} value={matId}>
                    {name} ({m.constitutiveType || 'ISOTROPIC'})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Gauss Point Strain Controls
            </h3>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Axial Strain ε11</span>
                <span className="font-mono text-emerald-400">{(strain11 * 100).toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="-0.01"
                max="0.05"
                step="0.0005"
                value={strain11}
                onChange={(e) => setStrain11(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Shear Strain γ12</span>
                <span className="font-mono text-cyan-400 font-medium">{(shear12 * 100).toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.02"
                step="0.0005"
                value={shear12}
                onChange={(e) => setShear12(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Integration Temperature T</span>
                <span className="font-mono text-amber-400">
                  {temperatureK.toFixed(1)} K ({(temperatureK - 273.15).toFixed(1)}°C)
                </span>
              </div>
              <input
                type="range"
                min="273.15"
                max="873.15"
                step="10"
                value={temperatureK}
                onChange={(e) => setTemperatureK(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Properties Card */}
          <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
            <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">Material Identity</h4>
            <div className="flex justify-between text-slate-400">
              <span>Family:</span>
              <span className="text-slate-200 font-mono">{selectedDef?.identity?.family || 'METALS'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Density ρ:</span>
              <span className="text-slate-200 font-mono">{selectedDef?.density || 0} kg/m³</span>
            </div>
            {selectedDef?.elastic?.E && (
              <div className="flex justify-between text-slate-400">
                <span>Young's Modulus E:</span>
                <span className="text-slate-200 font-mono">{(selectedDef.elastic.E / 1e9).toFixed(1)} GPa</span>
              </div>
            )}
            {selectedDef?.plastic && (
              <div className="flex justify-between text-slate-400">
                <span>Yield Stress σy0:</span>
                <span className="text-slate-200 font-mono font-semibold text-amber-400">
                  {(selectedDef.plastic.initialYieldStress / 1e6).toFixed(1)} MPa
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Tabbed Engineering Views */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 space-x-4">
            <button
              onClick={() => setActiveTab('RESPONSE')}
              className={`pb-3 text-xs font-semibold tracking-wider transition border-b-2 ${
                activeTab === 'RESPONSE'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Gauss Point Mechanical Response
            </button>
            <button
              onClick={() => setActiveTab('TANGENT')}
              className={`pb-3 text-xs font-semibold tracking-wider transition border-b-2 ${
                activeTab === 'TANGENT'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Consistent Tangent (C_tangent)
            </button>
            <button
              onClick={() => setActiveTab('SCHEMA')}
              className={`pb-3 text-xs font-semibold tracking-wider transition border-b-2 ${
                activeTab === 'SCHEMA'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Material Architecture &amp; Provenance
            </button>
            <button
              onClick={() => setActiveTab('GATE')}
              className={`pb-3 text-xs font-semibold tracking-wider transition border-b-2 ${
                activeTab === 'GATE'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Gate 233 Qualification
            </button>
          </div>

          {/* Tab 1: Mechanical Response View */}
          {activeTab === 'RESPONSE' && (
            <div className="space-y-6">
              {evaluationResult.error ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {evaluationResult.error}
                </div>
              ) : (
                <>
                  {/* Status Badges & Key Indicators */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">Yield Status</span>
                      <div className="mt-1 flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                            evaluationResult.response?.updatedState.status === 'PLASTIC'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {evaluationResult.response?.updatedState.status}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">Axial Stress σ11</span>
                      <div className="text-base font-bold font-mono text-white mt-0.5">
                        {((evaluationResult.response?.stress[0] || 0) / 1e6).toFixed(2)} MPa
                      </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">Equiv Plastic Strain</span>
                      <div className="text-base font-bold font-mono text-cyan-400 mt-0.5">
                        {(evaluationResult.response?.equivalentPlasticStrain || 0).toExponential(3)}
                      </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">Elastic Energy We</span>
                      <div className="text-base font-bold font-mono text-purple-400 mt-0.5">
                        {((evaluationResult.response?.elasticEnergyDensity || 0) / 1e3).toFixed(2)} kJ/m³
                      </div>
                    </div>
                  </div>

                  {/* Stress Vector 6x1 */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Binary className="w-4 h-4 text-emerald-400" />
                      Computed 6-Component Stress Vector σ (Voigt Pa)
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {['σ11', 'σ22', 'σ33', 'σ23', 'σ13', 'σ12'].map((label, idx) => (
                        <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 font-mono block">{label}</span>
                          <span className="text-xs font-mono font-bold text-emerald-400 mt-1 block">
                            {((evaluationResult.response?.stress[idx] || 0) / 1e6).toFixed(2)} MPa
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pipeline Integration Result */}
                  {pipelineResult && (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-cyan-400" />
                        FEM Element Integration Pipeline (Element Stiffness K_e)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Evaluated K_e = ∫ Bᵀ C_tangent B dV using live Gauss point material update.
                      </p>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs overflow-x-auto text-cyan-300">
                        Element Stiffness Matrix K_e (2x2 BAR2):
                        <div className="mt-1">
                          [{pipelineResult.elementStiffness[0].map((v) => (v / 1e6).toFixed(1)).join(', ')} MPa/m]
                        </div>
                        <div>
                          [{pipelineResult.elementStiffness[1].map((v) => (v / 1e6).toFixed(1)).join(', ')} MPa/m]
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab 2: Consistent Tangent View */}
          {activeTab === 'TANGENT' && (
            <div className="space-y-6">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Algorithmic Consistent Tangent Matrix C_tangent = dσ/dε (6x6 GPa)
                  </h3>
                  {evaluationResult.tangentReport && (
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        evaluationResult.tangentReport.isValid
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      FD Check: {evaluationResult.tangentReport.isValid ? 'PASSED (Error < 1e-3)' : 'FAILED'}
                    </span>
                  )}
                </div>

                {evaluationResult.tangent && (
                  <div className="overflow-x-auto bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <table className="w-full text-center font-mono text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-800">
                          <th className="p-2">#</th>
                          <th className="p-2">ε11</th>
                          <th className="p-2">ε22</th>
                          <th className="p-2">ε33</th>
                          <th className="p-2">γ23</th>
                          <th className="p-2">γ13</th>
                          <th className="p-2">γ12</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluationResult.tangent.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-900 hover:bg-slate-900/40">
                            <td className="p-2 text-slate-500 font-bold">σ{rIdx + 1}</td>
                            {row.map((val, cIdx) => (
                              <td
                                key={cIdx}
                                className={`p-2 font-mono ${
                                  Math.abs(val) > 1e6
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-slate-600'
                                }`}
                              >
                                {(val / 1e9).toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {evaluationResult.tangentReport && (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1 font-mono text-slate-400">
                    <div>Relative Frobenius Norm Error vs Finite Difference: <span className="text-emerald-400 font-bold">{evaluationResult.tangentReport.relativeErrorNorm.toExponential(3)}</span></div>
                    <div>Maximum Matrix Element Difference: <span className="text-cyan-400">{(evaluationResult.tangentReport.maxDifference / 1e6).toFixed(2)} MPa</span></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Schema & Provenance View */}
          {activeTab === 'SCHEMA' && (
            <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-xs">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Material Definition Architecture &amp; Provenance Ledger
              </h3>

              <div className="space-y-3 font-mono bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300 overflow-x-auto">
                <div><span className="text-slate-500">Material ID:</span> {selectedDef?.identity?.materialId || 'N/A'}</div>
                <div><span className="text-slate-500">Canonical Name:</span> {selectedDef?.identity?.name || 'N/A'}</div>
                <div><span className="text-slate-500">Constitutive Law:</span> {selectedDef?.constitutiveType || 'N/A'}</div>
                <div><span className="text-slate-500">Source Specification:</span> {selectedDef?.identity?.source || 'N/A'}</div>
                <div><span className="text-slate-500">Benchmark Reference Flag:</span> {selectedDef?.identity?.isTestBenchmarkReference ? 'TRUE' : 'FALSE'}</div>
                <div><span className="text-slate-500">Provenance Hash:</span> <span className="text-emerald-400">{selectedDef?.provenance?.provenanceHash || 'N/A'}</span></div>
                <div><span className="text-slate-500">Revision Number:</span> {selectedDef?.provenance?.revision || '0'}</div>
                <div><span className="text-slate-500">Timestamp:</span> {selectedDef?.provenance?.timestamp || 'N/A'}</div>
              </div>
            </div>
          )}

          {/* Tab 4: Gate 233 Qualification Results */}
          {activeTab === 'GATE' && (
            <div className="space-y-6">
              {!gateResult ? (
                <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
                  <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-white">Gate 233 Qualification Battery</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
                    Executes the 15 required criteria (233.01 through 233.15) covering schema, elasticity, plasticity, tangent matrix, determinism, and evidence.
                  </p>
                  <button
                    onClick={runGate233}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg transition"
                  >
                    Run Qualification Battery
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Gate Result Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      gateResult.overallPassed
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <CheckCircle2 className="w-6 h-6" />
                      <div>
                        <h4 className="font-bold text-sm">
                          {gateResult.overallPassed ? 'HARD ACCEPTANCE GATE 233: PASSED 100%' : 'GATE 233 FAILED'}
                        </h4>
                        <p className="text-xs opacity-80">
                          {gateResult.passCount} of {gateResult.totalTests} criteria passed engineering audit.
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs bg-slate-950 px-3 py-1 rounded border border-slate-800">
                      {gateResult.provenanceHash.slice(0, 20)}...
                    </span>
                  </div>

                  {/* Individual Criteria Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {gateResult.results.map((r) => (
                      <div
                        key={r.testId}
                        className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-emerald-400 font-bold">[{r.testId}] {r.name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                              r.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {r.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{r.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
