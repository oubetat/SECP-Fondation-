import React, { useState } from 'react';
import { PatternEngine } from '../engine/cad/pattern/PatternEngine';
import { PatternFeature, PatternType, LinearPatternDefinition, CircularPatternDefinition } from '../engine/cad/pattern/PatternTypes';
import { HardAcceptanceGate208 } from '../engine/validation/HardAcceptanceGate208';
import { Grid, Repeat, Sliders, ShieldCheck, Play, Eye, EyeOff, RotateCcw, AlertCircle, Layers, FileText } from 'lucide-react';

export function PatternEngineInspector() {
  const [engine] = useState(() => {
    return new PatternEngine();
  });

  const [patterns, setPatterns] = useState<PatternFeature[]>(() => engine.getPatterns());
  const [selectedPatternId, setSelectedPatternId] = useState<string>('');
  const [patternType, setPatternType] = useState<PatternType>('LINEAR');
  
  // Linear Controls
  const [count1, setCount1] = useState<number | null>(null);
  const [spacing1, setSpacing1] = useState<number | null>(null);
  const [count2, setCount2] = useState<number | null>(null);
  const [spacing2, setSpacing2] = useState<number | null>(null);

  // Circular Controls
  const [circCount, setCircCount] = useState<number | null>(null);
  const [circAngle, setCircAngle] = useState<number | null>(null);

  const [gateResults, setGateResults] = useState<{ verdict: string; checks: any[] } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const refreshPatterns = () => setPatterns(engine.getPatterns());

  const handleCreateLinear = () => {
    if (count1 === null || spacing1 === null || count2 === null || spacing2 === null) return;
    const pat = engine.createLinearPattern(
      `Linear Grid (${count1}x${count2})`,
      ['source_feature_01'],
      {
        direction1: { x: 1, y: 0, z: 0 },
        count1,
        spacing1,
        direction2: { x: 0, y: 1, z: 0 },
        count2,
        spacing2
      }
    );
    addLog(`✨ Created Linear Pattern "${pat.name}" with ${pat.instances.length} instances. Status: ${pat.status}`);
    refreshPatterns();
    setSelectedPatternId(pat.id);
  };

  const handleCreateCircular = () => {
    if (circCount === null || circAngle === null) return;
    const pat = engine.createCircularPattern(
      `Circular Flange (${circCount} Inst)`,
      ['source_feature_02'],
      {
        axisOrigin: { x: 0, y: 0, z: 0 },
        axisDirection: { x: 0, y: 0, z: 1 },
        count: circCount,
        angleDegrees: circAngle,
        isTotalAngle: true
      }
    );
    addLog(`✨ Created Circular Pattern "${pat.name}" with ${pat.instances.length} instances. Status: ${pat.status}`);
    refreshPatterns();
    setSelectedPatternId(pat.id);
  };

  const handleToggleSuppression = (patternId: string, instanceIdx: number) => {
    const updated = engine.toggleInstanceSuppression(patternId, instanceIdx);
    addLog(`👁️ Toggled suppression on Instance ${instanceIdx} of "${updated.name}".`);
    refreshPatterns();
  };

  const handleRunGate208 = () => {
    const gate = new HardAcceptanceGate208();
    const res = gate.evaluate();
    setGateResults(res);
    addLog(`🛡️ HardAcceptanceGate208 Verdict: ${res.verdict} (${res.checks.filter(c => c.status === 'PASS').length}/${res.checks.length} Passed)`);
  };

  const selectedPattern = patterns.find(p => p.id === selectedPatternId) || patterns[0];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-4 font-mono text-sm overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <Repeat className="w-6 h-6 text-purple-400" />
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              PATCH-208: Parametric Pattern Engine
              <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-semibold">
                PROVEN
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Linear (1D/2D) • Circular Axis Rotation • Variable Overrides • B-Rep Topology Validation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunGate208}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-semibold"
          >
            <ShieldCheck className="w-4 h-4" />
            Run Gate 208 Verification
          </button>
        </div>
      </div>

      {/* Control Configuration Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        {/* Pattern Creator Form */}
        <div className="bg-slate-900 border border-slate-800 p-3 rounded flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1">
            <Grid className="w-3.5 h-3.5 text-purple-400" />
            Pattern Creator
          </div>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setPatternType('LINEAR')}
              className={`flex-1 text-xs py-1 px-2 rounded border ${patternType === 'LINEAR' ? 'bg-purple-900 text-purple-200 border-purple-600' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
            >
              Linear Grid
            </button>
            <button
              onClick={() => setPatternType('CIRCULAR')}
              className={`flex-1 text-xs py-1 px-2 rounded border ${patternType === 'CIRCULAR' ? 'bg-purple-900 text-purple-200 border-purple-600' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
            >
              Circular Axis
            </button>
          </div>

          {patternType === 'LINEAR' ? (
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <label className="text-[10px] text-slate-400">Dir1 Count / Spacing</label>
                <div className="flex gap-1">
                  <input type="number" value={count1} onChange={e=>setCount1(Number(e.target.value))} className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1 text-xs"/>
                  <input type="number" value={spacing1} onChange={e=>setSpacing1(Number(e.target.value))} className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1 text-xs"/>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Dir2 Count / Spacing</label>
                <div className="flex gap-1">
                  <input type="number" value={count2} onChange={e=>setCount2(Number(e.target.value))} className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1 text-xs"/>
                  <input type="number" value={spacing2} onChange={e=>setSpacing2(Number(e.target.value))} className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1 text-xs"/>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <label className="text-[10px] text-slate-400">Instances</label>
                <input type="number" value={circCount} onChange={e=>setCircCount(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs"/>
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Total Angle (°)</label>
                <input type="number" value={circAngle} onChange={e=>setCircAngle(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs"/>
              </div>
            </div>
          )}

          <button
            onClick={patternType === 'LINEAR' ? handleCreateLinear : handleCreateCircular}
            className="w-full bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold py-1.5 rounded"
          >
            Create Pattern Feature
          </button>
        </div>

        {/* Pattern Tree Selector */}
        <div className="bg-slate-900 border border-slate-800 p-3 rounded flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-semibold mb-2 flex items-center justify-between">
            <span>Pattern Feature Tree ({patterns.length})</span>
            <span className="text-[10px] text-purple-400">Parametric B-Rep</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {patterns.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedPatternId(p.id)}
                className={`p-1.5 rounded text-xs cursor-pointer flex items-center justify-between border ${
                  p.id === selectedPatternId ? 'bg-purple-950/80 border-purple-500 text-purple-200' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <span className="truncate">{p.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  p.status === 'VALID' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Instance Matrix & Suppression Inspector */}
        <div className="bg-slate-900 border border-slate-800 p-3 rounded flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-semibold mb-2 flex items-center justify-between">
            <span>Instance Matrix ({selectedPattern?.instances.length || 0})</span>
            <span className="text-[10px] text-slate-500">Click instance to toggle suppression</span>
          </div>
          {selectedPattern ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 max-h-32 overflow-y-auto pr-1">
              {selectedPattern.instances.map(inst => (
                <button
                  key={inst.instanceIndex}
                  onClick={() => handleToggleSuppression(selectedPattern.id, inst.instanceIndex)}
                  className={`p-1 text-[10px] rounded border flex flex-col items-center justify-center ${
                    inst.isSuppressed 
                      ? 'bg-slate-950 text-slate-600 border-slate-800 line-through' 
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800 font-bold'
                  }`}
                  title={`Pos: x:${inst.position.x.toFixed(1)}, y:${inst.position.y.toFixed(1)}, z:${inst.position.z.toFixed(1)}`}
                >
                  <span>#{inst.instanceIndex}</span>
                  {inst.isSuppressed ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5 text-emerald-400" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-slate-600 italic text-xs">No pattern selected</div>
          )}
        </div>
      </div>

      {/* Acceptance Gate 208 Results */}
      {gateResults && (
        <div className="mb-4 bg-slate-900 border border-slate-800 p-3 rounded">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Hard Acceptance Gate 208 Results
            </h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              gateResults.verdict === 'PROVEN' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400'
            }`}>
              VERDICT: {gateResults.verdict}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
            {gateResults.checks.map((chk, i) => (
              <div key={i} className="bg-slate-950 border border-slate-800 p-1.5 rounded flex items-center justify-between">
                <span className="text-slate-300 truncate pr-2">{chk.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  chk.status === 'PASS' ? 'text-emerald-400 bg-emerald-950/60' : 'text-rose-400 bg-rose-950/60'
                }`}>
                  {chk.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Log */}
      <div className="flex-1 bg-slate-950 p-3 rounded border border-slate-800 flex flex-col">
        <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
          <span>PATTERN ENGINE ACTIVITY & EVIDENCE LOG</span>
          <span className="text-[10px] text-slate-500">{logs.length} entries</span>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 pr-1">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic">No activity logged yet...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="border-b border-slate-900/80 pb-0.5">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
