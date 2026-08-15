const fs = require('fs');
const content = fs.readFileSync('src/components/TestRunnerPanel.tsx', 'utf-8');

// Add import
const importStr = "import { HardAcceptanceGate075 } from '../engine/validation/HardAcceptanceGate075';\n";
let newContent = content.replace(
  "import { HardAcceptanceGate074 } from '../engine/validation/HardAcceptanceGate074';",
  "import { HardAcceptanceGate074 } from '../engine/validation/HardAcceptanceGate074';\n" + importStr
);

// Add state
const stateStr = "  const [gate075Result, setGate075Result] = useState<any>(null);\n  const [isGate075Running, setIsGate075Running] = useState(false);\n";
newContent = newContent.replace(
  "  const [gate074Result, setGate074Result] = useState<any>(null);\n  const [isGate074Running, setIsGate074Running] = useState(false);\n",
  "  const [gate074Result, setGate074Result] = useState<any>(null);\n  const [isGate074Running, setIsGate074Running] = useState(false);\n" + stateStr
);

// Add handler
const handlerStr = `
  const handleRunGate075 = async () => {
    setIsGate075Running(true);
    await new Promise(r => setTimeout(r, 600));
    try {
      const result = HardAcceptanceGate075.runGate();
      setGate075Result(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGate075Running(false);
    }
  };
`;
newContent = newContent.replace(
  "  const handleRunGate074 = async () => {",
  handlerStr + "\n  const handleRunGate074 = async () => {"
);

// Add UI Card (at the end just before </div></div>)
const cardStr = `
      {/* SECP-075 Integration Gate */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
              SECP-075 Integration Contract Gate
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Unified Engineering Simulation Integration Layer. Validates End-to-End Orchestration.
            </p>
          </div>
          <button
            id="btn-run-gate-075"
            onClick={handleRunGate075}
            disabled={isGate075Running}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-semibold transition shadow-md cursor-pointer"
          >
            {isGate075Running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isGate075Running ? 'Executing Gate 075...' : 'Execute Gate 075'}
          </button>
        </div>
        {!gate075Result && !isGate075Running && (
          <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
            Click <span className="text-emerald-400 font-semibold">Execute Gate 075</span> to run end-to-end integration benchmark.
          </div>
        )}
        {gate075Result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Column 1: JSON Report */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Orchestration Logs</h3>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all leading-relaxed whitespace-pre shadow-inner max-h-80">
                  {gate075Result.logs?.join('\\n')}
                </div>
              </div>
              
              {/* Column 2: Status */}
              <div className="space-y-4 flex flex-col justify-center">
                <div className={\`p-3 border rounded-lg text-xs font-mono flex items-start gap-2 \${
                  gate075Result.passed
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-400'
                }\`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">SECP-075 GATE {gate075Result.passed ? 'PASS' : 'FAIL'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {gate075Result.passed
                        ? 'Unified Integration Layer successfully linked CAD, Mesh, Assemblies, and Solvers.'
                        : 'Gate failed integration tests.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
`;
newContent = newContent.replace("    </div>\n  );\n};\n", cardStr + "\n    </div>\n  );\n};\n");
fs.writeFileSync('src/components/TestRunnerPanel.tsx', newContent);
