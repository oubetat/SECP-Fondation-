const fs = require('fs');

let content = fs.readFileSync('src/components/TestRunnerPanel.tsx', 'utf-8');

// Find the SECP-075 Integration Gate card and replace it with the new detailed one
const oldCardRegex = /\{\/\* SECP-075 Integration Gate \*\/\}[\s\S]*?(?=\n      \{\/\* END GATES \*\/\}|\n    <\/div>)/;

const newCard = `
      {/* SECP-075 Integration Gate */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
              SECP-075 Forensic Verification Gate
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict numerical verification of the FEA Kernel mathematics and orchestrator.
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
            
            {/* Forensic Tests List */}
            {gate075Result.forensic?.tests && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Forensic Mathematics Suite</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {gate075Result.forensic.tests.map((t: any, i: number) => (
                    <div key={i} className={\`p-2 border rounded text-[11px] font-mono flex flex-col gap-1 \${t.passed ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400' : 'bg-rose-950/20 border-rose-800/40 text-rose-400'}\`}>
                       <div className="flex justify-between font-bold">
                         <span>{t.name}</span>
                         <span>{t.passed ? 'PASS' : 'FAIL'}</span>
                       </div>
                       <div className="text-slate-400 text-[10px]">
                         {t.tolerance !== undefined && <span>Tol: {t.tolerance?.toExponential(2)} | </span>}
                         {t.relativeError !== undefined && <span>Err: {t.relativeError?.toExponential(2)} | </span>}
                         <span>{t.details}</span>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-3 col-span-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Orchestration Logs</h3>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all leading-relaxed whitespace-pre shadow-inner max-h-80">
                  {gate075Result.logs?.join('\\n')}
                </div>
              </div>
              
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
                        ? 'Unified Integration Layer successfully validated math & physics.'
                        : 'Gate failed integration/math tests.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
`;

content = content.replace(oldCardRegex, newCard);
fs.writeFileSync('src/components/TestRunnerPanel.tsx', content);

