import React, { useState } from "react";
import { TechnicalDrawingService } from "../engine/engineering_drawing/TechnicalDrawingService";
import { HardAcceptanceGate324, Gate324Report } from "../engine/engineering_drawing/HardAcceptanceGate324";
import { ShieldCheck, FileCode, CheckCircle2 } from "lucide-react";

export const TechnicalDrawingPanel: React.FC = () => {
  const [service] = useState(() => new TechnicalDrawingService());
  const [gateReport, setGateReport] = useState<Gate324Report | null>(null);

  const handleGenerate = () => {
    service.createDrawingDocument("Industrial Drawing");
  };

  const handleRunGate = () => {
    setGateReport(HardAcceptanceGate324.runGate());
  };

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 space-y-4">
      <h2 className="text-lg font-bold">Technical Drawing Workbench</h2>
      <div className="flex gap-2">
        <button onClick={handleGenerate} className="px-4 py-2 bg-blue-600 rounded text-xs">Generate Drawing</button>
        <button onClick={handleRunGate} className="px-4 py-2 bg-emerald-600 rounded text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4"/> Run Gate 324
        </button>
      </div>
      {gateReport && (
        <div className={`p-4 rounded border ${gateReport.passed ? 'border-emerald-800' : 'border-rose-800'}`}>
          <p>Status: {gateReport.passed ? 'PASSED' : 'FAILED'}</p>
        </div>
      )}
    </div>
  );
};
