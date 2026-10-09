import React, { useState } from 'react';
import { FileSpreadsheet, Scale, Layers, Download, CheckCircle2, Search, Filter } from 'lucide-react';

interface BomItem {
  partNumber: string;
  name: string;
  category: 'STRUCTURE' | 'PROPULSION' | 'AVIONICS' | 'POWER' | 'PAYLOAD' | 'HARDWARE';
  qty: number;
  unitMassG: number;
  totalMassG: number;
  material: string;
  provenance: string;
}

export const DroneBomPanel: React.FC = () => {
  const [filterCat, setFilterCat] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const bomItems: BomItem[] = [
    { partNumber: 'PART-CHASSIS-TOP', name: 'Top Carbon Fiber Deck Plate (2.5mm)', category: 'STRUCTURE', qty: 1, unitMassG: 78.5, totalMassG: 78.5, material: 'Carbon Fiber 3K Twill', provenance: 'CNC Milled' },
    { partNumber: 'PART-CHASSIS-BTM', name: 'Bottom Carbon Fiber Deck Plate (2.5mm)', category: 'STRUCTURE', qty: 1, unitMassG: 82.0, totalMassG: 82.0, material: 'Carbon Fiber 3K Twill', provenance: 'CNC Milled' },
    { partNumber: 'PART-ARM-TUBE', name: 'Carbon Fiber Boom Arm (Ø16x165mm)', category: 'STRUCTURE', qty: 4, unitMassG: 28.5, totalMassG: 114.0, material: 'Carbon Fiber Roll-Wrapped', provenance: 'Composite Extrusion' },
    { partNumber: 'PART-ARM-CLAMP', name: 'CNC Arm Clamp Dual Block', category: 'STRUCTURE', qty: 4, unitMassG: 18.0, totalMassG: 72.0, material: 'Aluminum 7075-T6', provenance: '5-Axis CNC' },
    { partNumber: 'PART-LAND-STRUT', name: 'Landing Gear Carbon Strut & Ski', category: 'STRUCTURE', qty: 2, unitMassG: 45.0, totalMassG: 90.0, material: 'Carbon & Aluminum 7075', provenance: 'Assembly' },
    
    { partNumber: 'PART-MOTOR-2212', name: 'Brushless Outrunner Motor (920KV)', category: 'PROPULSION', qty: 4, unitMassG: 55.0, totalMassG: 220.0, material: 'NdFeB Magnets / Copper / Al', provenance: 'Aerospace BLDC' },
    { partNumber: 'PART-PROP-1045', name: '10x4.5 Carbon-Composite Propeller Pair', category: 'PROPULSION', qty: 2, unitMassG: 22.0, totalMassG: 44.0, material: 'Glass-Filled Nylon / Carbon', provenance: 'Precision Molded' },
    { partNumber: 'PART-ESC-40A', name: 'BLHeli_32 40A DShot600 ESC Module', category: 'PROPULSION', qty: 4, unitMassG: 14.5, totalMassG: 58.0, material: 'FR4 / Aluminum Heatsink', provenance: 'SMT Assembly' },

    { partNumber: 'PART-FC-STM32', name: 'STM32H753 4-Layer Flight Controller', category: 'AVIONICS', qty: 1, unitMassG: 18.5, totalMassG: 18.5, material: 'FR4 / ENIG Gold', provenance: 'SMT Pick-and-Place' },
    { partNumber: 'PART-GPS-M8N', name: 'M8N GNSS Compass Ceramic Antenna', category: 'AVIONICS', qty: 1, unitMassG: 32.0, totalMassG: 32.0, material: 'Ceramic / Carbon Rod', provenance: 'Modular Avionics' },

    { partNumber: 'PART-BATT-6S', name: '6S 4500mAh 100C LiPo Battery Pack', category: 'POWER', qty: 1, unitMassG: 495.0, totalMassG: 495.0, material: 'Lithium Polymer Cells', provenance: 'Certified Pack' },
    { partNumber: 'PART-PDB-120A', name: 'Power Distribution Board & BEC 5V/12V', category: 'POWER', qty: 1, unitMassG: 24.0, totalMassG: 24.0, material: 'FR4 2oz Copper Bus', provenance: 'Power Subsystem' },

    { partNumber: 'PART-GIMBAL-3AXIS', name: '3-Axis Brushless Gimbal & 4K Camera', category: 'PAYLOAD', qty: 1, unitMassG: 185.0, totalMassG: 185.0, material: 'Aluminum / Glass Optics', provenance: 'Optical Payload' },

    { partNumber: 'FAST-M3-8MM', name: 'M3x8mm ISO 4762 Socket Head Screws', category: 'HARDWARE', qty: 12, unitMassG: 0.9, totalMassG: 10.8, material: 'Grade 12.9 Steel', provenance: 'Standard Hardware' },
    { partNumber: 'FAST-M3-22MM', name: 'M3x22mm Titanium Arm Clamp Bolts', category: 'HARDWARE', qty: 8, unitMassG: 1.1, totalMassG: 8.8, material: 'Titanium Grade 5', provenance: 'Standard Hardware' },
    { partNumber: 'FAST-M3-6MM', name: 'M3x6mm Motor Base Screws', category: 'HARDWARE', qty: 16, unitMassG: 0.7, totalMassG: 11.2, material: 'Grade 10.9 Steel', provenance: 'Standard Hardware' },
    { partNumber: 'FAST-STANDOFF', name: 'Knurled Frame Standoffs (21.5mm)', category: 'HARDWARE', qty: 6, unitMassG: 2.5, totalMassG: 15.0, material: 'Aluminum 7075-T6', provenance: 'Machined Spacers' },
    { partNumber: 'FAST-PROP-NUT', name: 'M6 Flanged Propeller Locknuts', category: 'HARDWARE', qty: 4, unitMassG: 1.4, totalMassG: 5.6, material: 'Aluminum 7075-T6', provenance: 'Hardware' }
  ];

  const filteredItems = bomItems.filter(item => {
    if (filterCat !== 'ALL' && item.category !== filterCat) return false;
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.partNumber.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalMassG = bomItems.reduce((acc, i) => acc + i.totalMassG, 0);
  const dryMassG = totalMassG - 495; // Without battery

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-purple-400" />
              Bill of Materials (BOM) & Mass Properties Budget
            </h1>
            <span className="px-2.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-xs font-mono font-bold">
              18 PART LINES · 1,675.4g AUW
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Hierarchical assembly component manifest, material lineage, unit weights, Center of Gravity (CG) budget & dry weight verification.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-right">
            <div className="text-[10px] text-slate-500 uppercase">Dry Mass (No Batt)</div>
            <div className="text-sm font-bold text-slate-300">{dryMassG.toFixed(1)} g</div>
          </div>
          <div className="bg-slate-950 border border-purple-900/40 px-3 py-1.5 rounded-lg text-right">
            <div className="text-[10px] text-purple-400 uppercase">All-Up-Weight (AUW)</div>
            <div className="text-sm font-bold text-purple-300">{totalMassG.toFixed(1)} g</div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search part name, number, or material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {['ALL', 'STRUCTURE', 'PROPULSION', 'AVIONICS', 'POWER', 'PAYLOAD', 'HARDWARE'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition font-bold ${
                filterCat === cat
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* BOM Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="p-3">Part Number</th>
                <th className="p-3">Component Description</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-center">Qty</th>
                <th className="p-3 text-right">Unit Mass</th>
                <th className="p-3 text-right">Total Mass</th>
                <th className="p-3">Material</th>
                <th className="p-3">Process / Lineage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredItems.map(item => (
                <tr key={item.partNumber} className="hover:bg-slate-800/30 transition">
                  <td className="p-3 font-mono text-purple-300 font-bold">{item.partNumber}</td>
                  <td className="p-3 text-white font-medium">{item.name}</td>
                  <td className="p-3 font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                      {item.category}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono text-slate-200">{item.qty}</td>
                  <td className="p-3 text-right font-mono text-slate-400">{item.unitMassG} g</td>
                  <td className="p-3 text-right font-mono text-purple-300 font-bold">{item.totalMassG} g</td>
                  <td className="p-3 text-slate-300 text-[11px]">{item.material}</td>
                  <td className="p-3 text-slate-400 font-mono text-[10px]">{item.provenance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
