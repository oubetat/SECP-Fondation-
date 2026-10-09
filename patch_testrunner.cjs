const fs = require('fs');
const file = 'src/components/TestRunnerPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

const stateInsert = `
  const [gate201Result, setGate201Result] = useState<any>(null);
  const [isGate201Running, setIsGate201Running] = useState(false);
  const [gate202Result, setGate202Result] = useState<any>(null);
  const [isGate202Running, setIsGate202Running] = useState(false);
`;
content = content.replace('const [gate162Result, setGate162Result] = useState<any>(null);', stateInsert + '\n  const [gate162Result, setGate162Result] = useState<any>(null);');

const funcInsert = `
  const handleRunGate201 = async () => {
    setIsGate201Running(true);
    try {
      const { HardAcceptanceGate201 } = await import('../engine/cad/multibody/HardAcceptanceGate201');
      const res = await HardAcceptanceGate201.evaluateAll();
      setGate201Result({
        success: res.verdict === 'PROVEN',
        summary: \`Multi-body modeling validation \${res.verdict}\`,
        passedChecks: res.checks.filter((c: any) => c.status === 'PASS').length,
        totalChecks: res.checks.length,
        checks: res.checks.map((c: any) => ({
          criterion: c.name,
          details: c.details,
          passed: c.passed
        }))
      });
    } catch (err: any) {
      console.error('Gate 201 run failed:', err);
    } finally {
      setIsGate201Running(false);
    }
  };

  const handleRunGate202 = async () => {
    setIsGate202Running(true);
    try {
      const { HardAcceptanceGate202 } = await import('../engine/cad/surface/HardAcceptanceGate202');
      const res = await HardAcceptanceGate202.evaluateAll();
      setGate202Result({
        success: res.verdict === 'PROVEN',
        summary: \`Surface modeling validation \${res.verdict}\`,
        passedChecks: res.checks.filter((c: any) => c.status === 'PASS').length,
        totalChecks: res.checks.length,
        checks: res.checks.map((c: any) => ({
          criterion: c.name,
          details: c.details,
          passed: c.passed
        }))
      });
    } catch (err: any) {
      console.error('Gate 202 run failed:', err);
    } finally {
      setIsGate202Running(false);
    }
  };
`;
content = content.replace('const handleRunGate162 = async () => {', funcInsert + '\n  const handleRunGate162 = async () => {');

const jsxInsert = `
        {/* GATE 201: MULTI-BODY MODELING */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                HAG-201: Multi-Body Modeling
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Validates independent body states, boolean interactions, and part hierarchy.
              </p>
            </div>
            <button
              onClick={handleRunGate201}
              disabled={isGate201Running}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded shadow-lg disabled:opacity-50 transition-colors"
            >
              {isGate201Running ? 'RUNNING...' : 'EXECUTE GATE 201'}
            </button>
          </div>
          {gate201Result && (
            <div className="mt-4 space-y-4">
              <div className={\`p-4 rounded-lg border \${gate201Result.success ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-rose-900/20 border-rose-500/30'} flex items-center justify-between\`}>
                <div className="flex items-center gap-3">
                  {gate201Result.success ? (
                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-8 h-8 text-rose-400" />
                  )}
                  <div>
                    <div className="text-sm font-bold tracking-wide">
                      {gate201Result.success ? 'SECP-201 PASSED: MULTI-BODY PROVEN' : 'SECP-201 FAILED: MULTI-BODY ERROR'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {gate201Result.summary}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-900 rounded border border-slate-700">
                  {gate201Result.passedChecks}/{gate201Result.totalChecks} Checks Passed
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gate201Result.checks.map((check: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-200">{check.criterion}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{check.details}</div>
                    </div>
                    {check.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* GATE 202: SURFACE MODELING */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-fuchsia-400" />
                HAG-202: Surface Modeling
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Validates NURBS/B-Spline surfaces, lofting, sweeping, trim boundaries, and continuity.
              </p>
            </div>
            <button
              onClick={handleRunGate202}
              disabled={isGate202Running}
              className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold rounded shadow-lg disabled:opacity-50 transition-colors"
            >
              {isGate202Running ? 'RUNNING...' : 'EXECUTE GATE 202'}
            </button>
          </div>
          {gate202Result && (
            <div className="mt-4 space-y-4">
              <div className={\`p-4 rounded-lg border \${gate202Result.success ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-rose-900/20 border-rose-500/30'} flex items-center justify-between\`}>
                <div className="flex items-center gap-3">
                  {gate202Result.success ? (
                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-8 h-8 text-rose-400" />
                  )}
                  <div>
                    <div className="text-sm font-bold tracking-wide">
                      {gate202Result.success ? 'SECP-202 PASSED: SURFACE MODELING PROVEN' : 'SECP-202 FAILED: SURFACE ERROR'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {gate202Result.summary}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-900 rounded border border-slate-700">
                  {gate202Result.passedChecks}/{gate202Result.totalChecks} Checks Passed
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gate202Result.checks.map((check: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-200">{check.criterion}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{check.details}</div>
                    </div>
                    {check.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
`;
content = content.replace('{/* GATE 162 */}', jsxInsert + '\n        {/* GATE 162 */}');

fs.writeFileSync(file, content);
