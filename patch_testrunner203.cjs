const fs = require('fs');
const file = 'src/components/TestRunnerPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

const stateInsert = `
  const [gate203Result, setGate203Result] = useState<any>(null);
  const [isGate203Running, setIsGate203Running] = useState(false);
`;
content = content.replace('const [gate202Result, setGate202Result] = useState<any>(null);', stateInsert + '\n  const [gate202Result, setGate202Result] = useState<any>(null);');

const funcInsert = `
  const handleRunGate203 = async () => {
    setIsGate203Running(true);
    try {
      const { HardAcceptanceGate203 } = await import('../engine/cad/nurbs/HardAcceptanceGate203');
      const res = await HardAcceptanceGate203.evaluateAll();
      setGate203Result({
        success: res.verdict === 'PROVEN',
        summary: \`NURBS surface editing validation \${res.verdict}\`,
        passedChecks: res.checks.filter((c: any) => c.status === 'PASS').length,
        totalChecks: res.checks.length,
        checks: res.checks.map((c: any) => ({
          criterion: c.name,
          details: c.details,
          passed: c.passed
        }))
      });
    } catch (err: any) {
      console.error('Gate 203 run failed:', err);
    } finally {
      setIsGate203Running(false);
    }
  };
`;
content = content.replace('const handleRunGate202 = async () => {', funcInsert + '\n  const handleRunGate202 = async () => {');

const jsxInsert = `
        {/* GATE 203: NURBS SURFACE EDITING */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-amber-400" />
                HAG-203: NURBS Surface Editing
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Validates true B-Spline evaluation, interactive control net transformation, and continuity analysis.
              </p>
            </div>
            <button
              onClick={handleRunGate203}
              disabled={isGate203Running}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded shadow-lg disabled:opacity-50 transition-colors"
            >
              {isGate203Running ? 'RUNNING...' : 'EXECUTE GATE 203'}
            </button>
          </div>
          {gate203Result && (
            <div className="mt-4 space-y-4">
              <div className={\`p-4 rounded-lg border \${gate203Result.success ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-rose-900/20 border-rose-500/30'} flex items-center justify-between\`}>
                <div className="flex items-center gap-3">
                  {gate203Result.success ? (
                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-8 h-8 text-rose-400" />
                  )}
                  <div>
                    <div className="text-sm font-bold tracking-wide">
                      {gate203Result.success ? 'SECP-203 PASSED: NURBS EDITING PROVEN' : 'SECP-203 FAILED: NURBS ERROR'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {gate203Result.summary}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-900 rounded border border-slate-700">
                  {gate203Result.passedChecks}/{gate203Result.totalChecks} Checks Passed
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gate203Result.checks.map((check: any, idx: number) => (
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
