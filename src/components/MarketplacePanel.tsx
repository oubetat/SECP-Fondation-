import React, { useState } from "react";
import { MarketplaceService } from "../engine/engineering_marketplace/MarketplaceService";
import { HardAcceptanceGate325, Gate325Report } from "../engine/engineering_marketplace/HardAcceptanceGate325";
import { ShieldCheck, ShoppingCart } from "lucide-react";

export const MarketplacePanel: React.FC = () => {
  const [service] = useState(() => new MarketplaceService());
  const [gateReport, setGateReport] = useState<Gate325Report | null>(null);

  const handleRunGate = () => {
    setGateReport(HardAcceptanceGate325.runGate());
  };

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 space-y-4">
      <h2 className="text-lg font-bold">Engineering Marketplace</h2>
      <button onClick={handleRunGate} className="px-4 py-2 bg-emerald-600 rounded text-xs flex items-center gap-2">
        <ShieldCheck className="w-4 h-4"/> Run Gate 325
      </button>
      {gateReport && (
        <div className={`p-4 rounded border ${gateReport.passed ? 'border-emerald-800' : 'border-rose-800'}`}>
          <p>Status: {gateReport.passed ? 'PASSED' : 'FAILED'}</p>
        </div>
      )}
    </div>
  );
};
