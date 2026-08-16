import React, { useState, useRef } from 'react';
import {
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Layers,
  Sparkles,
  ArrowRight,
  Cpu,
  FileText,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { AiCopilotEngine, CopilotPipelineResult } from '../engine/aiCopilotEngine';
import { MaterialsEngine } from '../engine/materials';
import { CadGeometryKernel, CadSolidEntity } from '../engine/cadKernel';

interface AiCopilotPanelProps {
  onApplySolidToViewport?: (solid: CadSolidEntity) => void;
}

export const AiCopilotPanel: React.FC<AiCopilotPanelProps> = ({ onApplySolidToViewport }) => {
  const [prompt, setPrompt] = useState<string>(
    'Design a steel beam to support a 20 kN load with minimum weight'
  );
  const [targetLoadKN, setTargetLoadKN] = useState<number>(20);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('mat-steel-1045');
  const [safetyFactorTarget, setSafetyFactorTarget] = useState<number>(1.5);
  const [maxDeflectionMm, setMaxDeflectionMm] = useState<number>(5.0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const [pipelineResult, setPipelineResult] = useState<CopilotPipelineResult | null>(() =>
    AiCopilotEngine.processEngineeringRequest({
      userPrompt: 'Design a steel beam to support a 20 kN load with minimum weight',
      targetLoadKN: 20,
      materialId: 'mat-steel-1045',
      maxDeflectionMm: 5.0,
      safetyFactorTarget: 1.5,
    })
  );

  const [appliedToCad, setAppliedToCad] = useState<boolean>(false);

  // Dynamic Parameter Extractor (Natural Language Parsing Engine)
  const parsePromptParameters = (text: string) => {
    // 1. Parse Load: e.g. "20 kN", "45 kilonewtons", "30kN"
    const loadMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:kn|kilonewtons?)\b/i);
    if (loadMatch) {
      const loadVal = parseFloat(loadMatch[1]);
      if (!isNaN(loadVal)) setTargetLoadKN(loadVal);
    }

    // 2. Parse Material: e.g. "steel", "titanium", "aluminum"
    if (/\b(?:steel|iron|carbon\s*steel)\b/i.test(text)) {
      setSelectedMaterial('mat-steel-1045');
    } else if (/\b(?:titanium|ti6al4v|ti-6al-4v|aerospace)\b/i.test(text)) {
      setSelectedMaterial('mat-titanium-ti6al4v');
    } else if (/\b(?:aluminum|al6061|al\s*6061|lightweight)\b/i.test(text)) {
      setSelectedMaterial('mat-aluminum-6061');
    }

    // 3. Parse Safety Factor: e.g. "safety factor 2.0", "sf 1.8", "safety 1.5"
    const sfMatch = text.match(/\b(?:sf|safety\s*factor|factor\s*of\s*safety|safety)\s*(\d+(?:\.\d+)?)\b/i);
    if (sfMatch) {
      const sfVal = parseFloat(sfMatch[1]);
      if (!isNaN(sfVal) && sfVal >= 1 && sfVal <= 10) {
        setSafetyFactorTarget(sfVal);
      }
    }

    // 4. Parse Max Deflection: e.g. "deflection 4.5", "deflect 3.0"
    const defMatch = text.match(/\b(?:deflection|deflect|max\s*deflection)\s*(\d+(?:\.\d+)?)\b/i);
    if (defMatch) {
      const defVal = parseFloat(defMatch[1]);
      if (!isNaN(defVal) && defVal > 0 && defVal <= 50) {
        setMaxDeflectionMm(defVal);
      }
    }
  };

  const handlePromptChange = (val: string) => {
    setPrompt(val);
    parsePromptParameters(val);
  };

  const getParsedHighlights = () => {
    const highlights = [];
    const loadMatch = prompt.match(/\b(\d+(?:\.\d+)?)\s*(?:kn|kilonewtons?)\b/i);
    if (loadMatch) highlights.push(`Load: ${loadMatch[1]} kN`);

    if (/\b(?:steel|iron|carbon\s*steel)\b/i.test(prompt)) {
      highlights.push('Mat: Steel');
    } else if (/\b(?:titanium|ti6al4v|ti-6al-4v|aerospace)\b/i.test(prompt)) {
      highlights.push('Mat: Titanium');
    } else if (/\b(?:aluminum|al6061|al\s*6061|lightweight)\b/i.test(prompt)) {
      highlights.push('Mat: Aluminum');
    }

    const sfMatch = prompt.match(/\b(?:sf|safety\s*factor|factor\s*of\s*safety|safety)\s*(\d+(?:\.\d+)?)\b/i);
    if (sfMatch) highlights.push(`S.F.: ${sfMatch[1]}`);

    const defMatch = prompt.match(/\b(?:deflection|deflect|max\s*deflection)\s*(\d+(?:\.\d+)?)\b/i);
    if (defMatch) highlights.push(`Deflection: ${defMatch[1]} mm`);

    return highlights;
  };

  const handleRunCopilot = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 1. Force keyboard to close on mobile
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!prompt.trim()) return;

    setIsLoading(true);
    setAppliedToCad(false);

    // Simulate AI synthesis delay for better UX
    setTimeout(() => {
      const result = AiCopilotEngine.processEngineeringRequest({
        userPrompt: prompt,
        targetLoadKN: Number(targetLoadKN) || 20,
        materialId: selectedMaterial,
        maxDeflectionMm: Number(maxDeflectionMm) || 5.0,
        safetyFactorTarget: Number(safetyFactorTarget) || 1.5,
      });
      setPipelineResult(result);
      setIsLoading(false);

      // Auto-generate 3D CAD solid for recommended candidate & sync to viewport
      if (result && result.recommendedCandidate) {
        const cand = result.recommendedCandidate;
        const generatedSolid = CadGeometryKernel.createBox(
          cand.flangeWidthMm || 120,
          cand.webHeightMm || 220,
          350,
          `AI-Copilot ${cand.name}`
        );
        generatedSolid.colorHex = '#6366f1';
        if (onApplySolidToViewport) {
          onApplySolidToViewport(generatedSolid);
          setAppliedToCad(true);
        }
      }

      // 2. Smooth scroll to results
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }, 700);
  };

  const handleApplyToCad = () => {
    setAppliedToCad(true);
    if (pipelineResult && pipelineResult.recommendedCandidate) {
      const cand = pipelineResult.recommendedCandidate;
      const generatedSolid = CadGeometryKernel.createBox(
        cand.flangeWidthMm || 120,
        cand.webHeightMm || 220,
        350,
        `AI-Copilot ${cand.name}`
      );
      generatedSolid.colorHex = '#6366f1';
      if (onApplySolidToViewport) {
        onApplySolidToViewport(generatedSolid);
      }
    }
  };

  const samplePrompts = [
    { text: 'Design a steel beam to support a 20 kN load with minimum weight', load: 20, mat: 'mat-steel-1045' },
    { text: 'Optimize titanium bracket for 45 kN aerospace load', load: 45, mat: 'mat-titanium-ti6al4v' },
    { text: 'Lightweight aluminum beam for 15 kN bending load', load: 15, mat: 'mat-aluminum-6061' },
  ];

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight">AI Engineering Copilot</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-full">
              PATCH-SECP-024
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Grounded AI Engineering Copilot that synthesizes design requirements, evaluates section profiles, and verifies safety via SECP physics FEA engines.
          </p>
        </div>
      </div>

      {/* AI Engineering Pipeline Visual Flow */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
        <span className="text-indigo-400 font-bold flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> 1. Requirements</span>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <span className="text-cyan-400 font-bold flex items-center gap-1"><Sliders className="w-3.5 h-3.5" /> 2. Eng Spec</span>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <span className="text-amber-400 font-bold flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> 3. Candidates</span>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <span className="text-purple-400 font-bold flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> 4. CAD Params</span>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <span className="text-emerald-400 font-bold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> 5. FEM Simulation</span>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <span className="text-rose-400 font-bold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> 6. Optimization</span>
      </div>

      {/* Copilot Request Box */}
      <form onSubmit={handleRunCopilot} className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" /> Natural Language Engineering Request
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={e => handlePromptChange(e.target.value)}
              placeholder="e.g. Design a steel beam to support a 20 kN load with minimum weight..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-sans"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {isLoading ? 'Processing...' : 'Run Copilot'}
            </button>
          </div>
          {getParsedHighlights().length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Live Parser:</span>
              {getParsedHighlights().map((hl, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 rounded text-[10px] font-mono flex items-center gap-1 font-semibold animate-pulse">
                  <Check className="w-2.5 h-2.5 text-emerald-400" /> {hl}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick Sample Prompts */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400">Quick Examples:</span>
          {samplePrompts.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPrompt(sample.text);
                setTargetLoadKN(sample.load);
                setSelectedMaterial(sample.mat);
              }}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded text-[11px] transition-all"
            >
              "{sample.text}"
            </button>
          ))}
        </div>

        {/* Bound Parameters Input */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Applied Load (kN)</label>
            <input
              type="number"
              value={targetLoadKN}
              onChange={e => setTargetLoadKN(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-indigo-300 font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Material Selection</label>
            <select
              value={selectedMaterial}
              onChange={e => setSelectedMaterial(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
            >
              {MaterialsEngine.getPreloadedMaterials().map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.yieldStrengthMPa} MPa)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Target Safety Factor</label>
            <input
              type="number"
              step="0.1"
              value={safetyFactorTarget}
              onChange={e => setSafetyFactorTarget(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-emerald-300 font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Max Deflection (mm)</label>
            <input
              type="number"
              step="0.5"
              value={maxDeflectionMm}
              onChange={e => setMaxDeflectionMm(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono"
            />
          </div>
        </div>
      </form>

      {/* Copilot Pipeline Execution Output */}
      <div ref={resultRef} />
      {pipelineResult && (
        <div className="flex flex-col gap-6">
          {/* AI Explanation Summary */}
          <div className="bg-indigo-950/30 border border-indigo-800/60 p-4 rounded-lg flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
              <Bot className="w-4 h-4 text-indigo-400" /> SECP AI Copilot Synthesis & Verification
            </div>
            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-sans">
              {pipelineResult.aiExplanation}
            </p>
          </div>

          {/* Derived Engineering Spec */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Derived Engineering Specification
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Yield Strength</span>
                <span className="font-mono text-slate-100 font-bold">{pipelineResult.spec.yieldStrengthMPa} MPa</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Allowable Design Stress</span>
                <span className="font-mono text-cyan-400 font-bold">{pipelineResult.spec.allowableStressMPa} MPa</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Req. Section Modulus (Z_req)</span>
                <span className="font-mono text-amber-400 font-bold">{pipelineResult.spec.requiredSectionModulusCm3} cm³</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Material Density</span>
                <span className="font-mono text-slate-300 font-bold">{pipelineResult.spec.densityKgM3} kg/m³</span>
              </div>
            </div>
          </div>

          {/* Evaluated Candidates Comparison Table */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Evaluated Section Candidates (FEA Verified)
              </h3>
              <span className="text-[11px] text-slate-400">
                Optimal Choice: <strong className="text-indigo-400">{pipelineResult.recommendedCandidate.name}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-mono text-[11px]">
                    <th className="py-2 px-3">Candidate Profile</th>
                    <th className="py-2 px-3">Dimensions (HxWxT)</th>
                    <th className="py-2 px-3">Mass (kg)</th>
                    <th className="py-2 px-3">Max Stress</th>
                    <th className="py-2 px-3">Safety Factor</th>
                    <th className="py-2 px-3">Deflection</th>
                    <th className="py-2 px-3">FEA Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {pipelineResult.candidates.map(cand => {
                    const isRec = cand.id === pipelineResult.recommendedCandidate.id;
                    return (
                      <tr key={cand.id} className={isRec ? 'bg-indigo-950/40 text-indigo-200 font-bold' : ''}>
                        <td className="py-2.5 px-3 flex items-center gap-1.5">
                          {isRec && <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                          {cand.name}
                        </td>
                        <td className="py-2.5 px-3">{cand.webHeightMm}x{cand.flangeWidthMm}x{cand.wallThicknessMm}mm</td>
                        <td className="py-2.5 px-3 font-bold text-amber-300">{cand.massKg} kg</td>
                        <td className="py-2.5 px-3">{cand.maxVonMisesStressMPa} MPa</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">{cand.safetyFactor}</td>
                        <td className="py-2.5 px-3">{cand.maxDeflectionMm} mm</td>
                        <td className="py-2.5 px-3">
                          {cand.isVerifiedByFem ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED PASS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5" /> UNCOMPLIANT
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action: Apply Optimal Parameters to CAD Engine */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-200">
                Apply Optimal CAD Parameters ({pipelineResult.recommendedCandidate.name})
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pushes WebHeight = {pipelineResult.recommendedCandidate.webHeightMm}mm, FlangeWidth = {pipelineResult.recommendedCandidate.flangeWidthMm}mm into SECP B-Rep Parametric Feature Tree.
              </p>
            </div>

            <button
              onClick={handleApplyToCad}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                appliedToCad
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
              }`}
            >
              {appliedToCad ? <Check className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
              {appliedToCad ? 'Applied to 3D Viewport Kernel!' : 'Load to CAD Canvas'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
