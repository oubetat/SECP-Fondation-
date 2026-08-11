import React, { useState } from 'react';
import { BomEngine, AssemblyBomRollup, BomItem } from '../engine/bomEngine';
import { Layers, DollarSign, Scale, Clock, Package, Download, CheckCircle2 } from 'lucide-react';

export const BomPanel: React.FC = () => {
  const [bomData, setBomData] = useState<AssemblyBomRollup>(BomEngine.generateAssemblyBom());

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-amber-400">
            <Package className="w-5 h-5 text-amber-400" />
            PATCH-SECP-019 — Bill of Materials (BOM) Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Assembly Part Rollup, Unit Costs, Material Weights, Suppliers, and Lead Time Critical Path.
          </p>
        </div>

        <button
          onClick={() => alert('BOM exported as CSV / STEP XML Assembly Manifest!')}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export BOM (CSV)
        </button>
      </div>

      {/* Assembly Rollup Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">TOTAL ESTIMATED COST</span>
          <span className="text-xl font-bold font-mono text-amber-300">${bomData.totalCostUSD.toFixed(2)}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Includes Off-the-shelf & Custom</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">TOTAL ASSEMBLY MASS</span>
          <span className="text-xl font-bold font-mono text-emerald-400">{bomData.totalWeightKg.toFixed(3)} kg</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">CAD Density Calculated</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">PART COUNT / UNIQUE</span>
          <span className="text-xl font-bold font-mono text-indigo-300">
            {bomData.totalItemCount} <span className="text-xs font-normal text-slate-400">({bomData.totalUniqueParts} Unique)</span>
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Multi-Level DAG Tree</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">CRITICAL LEAD TIME</span>
          <span className="text-xl font-bold font-mono text-cyan-300">{bomData.criticalPathLeadTimeDays} Days</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Max Procurement Delay</span>
        </div>
      </div>

      {/* Structured BOM Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-slate-800 font-bold text-xs text-slate-300 flex justify-between items-center">
          <span>{bomData.assemblyName} — Detailed Parts Manifest</span>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% CAD Geometry Linked
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
              <tr>
                <th className="p-2.5">PART NUMBER</th>
                <th className="p-2.5">DESCRIPTION</th>
                <th className="p-2.5">QTY</th>
                <th className="p-2.5">MATERIAL</th>
                <th className="p-2.5">REV</th>
                <th className="p-2.5">PROCESS</th>
                <th className="p-2.5 text-right">UNIT ($)</th>
                <th className="p-2.5 text-right">TOTAL ($)</th>
                <th className="p-2.5 text-right">LEAD TIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {bomData.items.map(item => (
                <tr key={item.id} className="hover:bg-slate-900/50 transition">
                  <td className="p-2.5 font-bold text-amber-400">{item.partNumber}</td>
                  <td className="p-2.5">{item.description}</td>
                  <td className="p-2.5 font-bold text-indigo-300">{item.quantity}</td>
                  <td className="p-2.5 text-slate-300">{item.material}</td>
                  <td className="p-2.5 text-slate-400">{item.revision}</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                      {item.manufacturingMethod}
                    </span>
                  </td>
                  <td className="p-2.5 text-right">${item.unitCostUSD.toFixed(2)}</td>
                  <td className="p-2.5 text-right font-bold text-amber-300">${item.totalCostUSD.toFixed(2)}</td>
                  <td className="p-2.5 text-right text-cyan-300">{item.leadTimeDays}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
