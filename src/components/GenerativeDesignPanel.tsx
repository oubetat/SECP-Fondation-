import React, { useState } from 'react';
import {
  Sparkles,
  Sliders,
  CheckCircle2,
  Cpu,
  Layers,
  Filter,
  TrendingDown,
  ShieldCheck,
  Check,
  Zap,
} from 'lucide-react';
import { GenerativeDesignEngine, GenerativeDesignSummary, GenerativeCandidate } from '../engine/generativeDesignEngine';
import { MaterialsEngine } from '../engine/materials';

export const GenerativeDesignPanel: React.FC = () => {
  const [loadKN, setLoadKN] = useState<number>(20);
  const [materialId, setMaterialId] = useState<string>('mat-titanium-ti6al4v');
  const [candidateCount, setCandidateCount] = useState<number>(100);
  const [volumeReductionPct, setVolumeReductionPct] = useState<number>(50);
  const [minSafetyFactor, setMinSafetyFactor] = useState<number>(1.5);

  const [summary, setSummary] = useState<GenerativeDesignSummary | null>(() =>
    GenerativeDesignEngine.runGenerativeOptimization({
      loadKN: 20,
      materialId: 'mat-titanium-ti6al4v',
      maxVolumeReductionPct: 50,
      minSafetyFactor: 1.5,
      candidateCount: 100,
      envelopeLengthMm: 500,
      envelopeWidthMm: 120,
      envelopeHeightMm: 180,
    })
  );

  const [selectedCandidate, setSelectedCandidate] = useState<GenerativeCandidate | null>(
    () => summary?.bestBalanced || null
  );

  const [isLoadedToCad, setIsLoadedToCad] = useState<boolean>(false);

  const handleRunGenerative = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setIsLoadedToCad(false);
    const result = GenerativeDesignEngine.runGenerativeOptimization({
      loadKN: Number(loadKN) || 20,
      materialId,
      maxVolumeReductionPct: Number(volumeReductionPct) || 50,
      minSafetyFactor: Number(minSafetyFactor) || 1.5,
      candidateCount: Number(candidateCount) || 100,
      envelopeLengthMm: 500,
      envelopeWidthMm: 120,
      envelopeHeightMm: 180,
    });
    setSummary(result);
    setSelectedCandidate(result.bestBalanced || result.bestLightweight || null);
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold tracking-tight">Generative Topology Optimization</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-amber-950 text-amber-400 border border-amber-800 rounded-full">
              PATCH-SECP-025
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generates 10 / 100 / 1000 candidate lattice variations, verifies stress & deflection via SECP physics engines, and ranks designs along the Pareto Frontier.
          </p>
        </div>

        <button
          onClick={handleRunGenerative}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-amber-600/30"
        >
          <Zap className="w-4 h-4" /> Run {candidateCount} Generative Runs
        </button>
      </div>

      {/* Constraints & Sweep Configuration Form */}
      <form onSubmit={handleRunGenerative} className="bg-slate-950 p-4 rounded-lg border border-slate-800 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Applied Force (kN)</label>
          <input
            type="number"
            value={loadKN}
            onChange={e => setLoadKN(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Material Selection</label>
          <select
            value={materialId}
            onChange={e => setMaterialId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
          >
            {MaterialsEngine.getPreloadedMaterials().map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Candidate Sweep Count</label>
          <select
            value={candidateCount}
            onChange={e => setCandidateCount(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-cyan-300 font-mono"
          >
            <option value={10}>10 Candidates (Fast)</option>
            <option value={100}>100 Candidates (Standard)</option>
            <option value={1000}>1000 Candidates (Deep Search)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Target Mass Reduction: {volumeReductionPct}%</label>
          <input
            type="range"
            min={20}
            max={80}
            value={volumeReductionPct}
            onChange={e => setVolumeReductionPct(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Min Safety Factor ($SF$)</label>
          <input
            type="number"
            step="0.1"
            value={minSafetyFactor}
            onChange={e => setMinSafetyFactor(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-emerald-300 font-mono"
          />
        </div>
      </form>

      {/* Optimization Results Benchmark Summary */}
      {summary && (
        <div className="flex flex-col gap-6">
          {/* Top Banner Benchmarks */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Generated Candidates</span>
              <div className="text-xl font-mono font-bold text-slate-100 mt-1">{summary.totalGenerated}</div>
              <span className="text-[10px] text-slate-400">Time: {summary.executionTimeMs} ms</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Compliant Designs</span>
              <div className="text-xl font-mono font-bold text-emerald-400 mt-1">{summary.compliantCount}</div>
              <span className="text-[10px] text-slate-400">SF ≥ {summary.constraints.minSafetyFactor}</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Pareto Frontier</span>
              <div className="text-xl font-mono font-bold text-amber-400 mt-1">{summary.paretoFrontierCount}</div>
              <span className="text-[10px] text-slate-400">Non-Dominated Optimal</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Best Mass Saving</span>
              <div className="text-xl font-mono font-bold text-cyan-400 mt-1">{summary.bestLightweight?.massKg} kg</div>
              <span className="text-[10px] text-slate-400">SF = {summary.bestLightweight?.safetyFactor}</span>
            </div>
          </div>

          {/* Pareto Optimal Winners Spotlight */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Winner 1: Lightest */}
            {summary.bestLightweight && (
              <div
                onClick={() => setSelectedCandidate(summary.bestLightweight)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedCandidate?.id === summary.bestLightweight.id
                    ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-amber-400 font-bold mb-2">
                  <span className="flex items-center gap-1.5"><TrendingDown className="w-4 h-4" /> Lightest Compliant</span>
                  <span className="font-mono text-[10px] bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                    Candidate #{summary.bestLightweight.candidateNumber}
                  </span>
                </div>
                <div className="text-lg font-mono font-bold text-slate-100">{summary.bestLightweight.massKg} kg</div>
                <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                  <div>Safety Factor: <strong className="text-emerald-400">{summary.bestLightweight.safetyFactor}</strong></div>
                  <div>Max Stress: <strong className="text-slate-200">{summary.bestLightweight.maxVonMisesStressMPa} MPa</strong></div>
                  <div>Lattice Density: <strong>{summary.bestLightweight.latticeDensityPct}%</strong></div>
                </div>
              </div>
            )}

            {/* Winner 2: Balanced Hybrid */}
            {summary.bestBalanced && (
              <div
                onClick={() => setSelectedCandidate(summary.bestBalanced)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedCandidate?.id === summary.bestBalanced.id
                    ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-cyan-400 font-bold mb-2">
                  <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Recommended Hybrid</span>
                  <span className="font-mono text-[10px] bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                    Candidate #{summary.bestBalanced.candidateNumber}
                  </span>
                </div>
                <div className="text-lg font-mono font-bold text-slate-100">{summary.bestBalanced.massKg} kg</div>
                <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                  <div>Safety Factor: <strong className="text-emerald-400">{summary.bestBalanced.safetyFactor}</strong></div>
                  <div>Max Stress: <strong className="text-slate-200">{summary.bestBalanced.maxVonMisesStressMPa} MPa</strong></div>
                  <div>Overall Score: <strong className="text-cyan-300">{summary.bestBalanced.score}/100</strong></div>
                </div>
              </div>
            )}

            {/* Winner 3: High Safety */}
            {summary.bestHighSafety && (
              <div
                onClick={() => setSelectedCandidate(summary.bestHighSafety)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedCandidate?.id === summary.bestHighSafety.id
                    ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-emerald-400 font-bold mb-2">
                  <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> High Safety Margin</span>
                  <span className="font-mono text-[10px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Candidate #{summary.bestHighSafety.candidateNumber}
                  </span>
                </div>
                <div className="text-lg font-mono font-bold text-slate-100">{summary.bestHighSafety.massKg} kg</div>
                <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                  <div>Safety Factor: <strong className="text-emerald-400">{summary.bestHighSafety.safetyFactor}</strong></div>
                  <div>Max Stress: <strong className="text-slate-200">{summary.bestHighSafety.maxVonMisesStressMPa} MPa</strong></div>
                  <div>Lattice Density: <strong>{summary.bestHighSafety.latticeDensityPct}%</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* Selected Candidate Detailed CAD Topology Inspection */}
          {selectedCandidate && (
            <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded font-semibold">
                    Selected Candidate #{selectedCandidate.candidateNumber}
                  </span>
                  <span className="text-xs text-slate-400">
                    Topology: {selectedCandidate.topologyCategory}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-1">
                  <div>Wall Thickness: <strong className="font-mono text-slate-200">{selectedCandidate.wallThicknessMm} mm</strong></div>
                  <div>Hole Radius: <strong className="font-mono text-slate-200">{selectedCandidate.lighteningHoleRadiusMm} mm</strong></div>
                  <div>Stiffening Ribs: <strong className="font-mono text-slate-200">{selectedCandidate.ribCount} ribs</strong></div>
                  <div>Deflection: <strong className="font-mono text-slate-200">{selectedCandidate.maxDeflectionMm} mm</strong></div>
                </div>
              </div>

              <button
                onClick={() => setIsLoadedToCad(true)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  isLoadedToCad
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
                }`}
              >
                {isLoadedToCad ? <Check className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                {isLoadedToCad ? 'Loaded to CAD Tree!' : 'Load Candidate to Active CAD Model'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
