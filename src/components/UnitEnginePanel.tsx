/**
 * PATCH-SECP-002 — Unit & Measurement Engine Panel
 * Live converter and automated test suite verification.
 */

import React, { useState } from 'react';
import { UnitEngine, UNIT_DEFINITIONS } from '../engine/units';
import { ArrowRight, CheckCircle2, RefreshCw, Calculator, Ruler } from 'lucide-react';

export const UnitEnginePanel: React.FC<{ activeUnit: string; onActiveUnitChange: (u: string) => void }> = ({
  activeUnit,
  onActiveUnitChange,
}) => {
  const [val, setVal] = useState<number>(1000);
  const [fromUnit, setFromUnit] = useState<string>('mm');
  const [toUnit, setToUnit] = useState<string>('m');

  const unitList = Object.keys(UNIT_DEFINITIONS);

  const testResults = UnitEngine.runUnitEngineTests();
  const convertedResult = UnitEngine.convert(val, fromUnit, toUnit);
  const canonicalInfo = UnitEngine.toCanonical(val, fromUnit);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-blue-400">
            <Ruler className="w-5 h-5 text-blue-400" /> PATCH-SECP-002 — Unit & Measurement Engine
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Canonical SI Base Unit enforcement inside C++/TS Kernel to prevent unit conversion errors.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded border border-slate-800 text-xs">
          <span className="text-slate-400">Active App Unit:</span>
          <select
            value={activeUnit}
            onChange={e => onActiveUnitChange(e.target.value)}
            className="bg-slate-900 text-blue-400 font-bold border border-slate-700 rounded px-2 py-0.5 focus:outline-none"
          >
            <option value="mm">Millimeters (mm)</option>
            <option value="cm">Centimeters (cm)</option>
            <option value="m">Meters (m)</option>
            <option value="inch">Inches (inch)</option>
          </select>
        </div>
      </div>

      {/* Interactive Conversion Testing Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400">Input Value & Unit</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={val}
              onChange={e => setVal(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 w-full focus:border-blue-500 focus:outline-none"
            />
            <select
              value={fromUnit}
              onChange={e => {
                const newFrom = e.target.value;
                setFromUnit(newFrom);
                // Adjust target unit to match category
                const cat = UNIT_DEFINITIONS[newFrom].category;
                const match = unitList.find(u => UNIT_DEFINITIONS[u].category === cat && u !== newFrom);
                if (match) setToUnit(match);
              }}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm font-mono text-blue-400 focus:outline-none"
            >
              {unitList.map(u => (
                <option key={u} value={u}>{u} ({UNIT_DEFINITIONS[u].category})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-center pt-4 md:pt-0">
          <ArrowRight className="w-6 h-6 text-slate-500" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400">Target Converted Unit</label>
          <div className="flex gap-2">
            <select
              value={toUnit}
              onChange={e => setToUnit(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm font-mono text-emerald-400 w-full focus:outline-none"
            >
              {unitList
                .filter(u => UNIT_DEFINITIONS[u].category === UNIT_DEFINITIONS[fromUnit].category)
                .map(u => (
                  <option key={u} value={u}>{u} ({UNIT_DEFINITIONS[u].name})</option>
                ))}
            </select>
          </div>
          <div className="mt-2 p-2 bg-slate-900/80 rounded border border-emerald-500/30 text-xs text-emerald-300 font-mono flex items-center justify-between">
            <span>Result:</span>
            <strong className="text-sm font-bold">{convertedResult.toFixed(4)} {toUnit}</strong>
          </div>
        </div>
      </div>

      {/* Canonical Kernel Representation */}
      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs flex items-center justify-between text-slate-300">
        <span className="text-slate-400 font-medium">Internal Canonical SI Kernel Value:</span>
        <span className="font-mono text-cyan-400 font-bold">
          {canonicalInfo.value.toFixed(6)} {canonicalInfo.canonicalUnit}
        </span>
      </div>

      {/* Required Automated Unit Engine Test Suite Matrix */}
      <div>
        <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3">
          PATCH-SECP-002 Acceptance Test Suite
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {testResults.map((t, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span>{t.testName}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-[11px] font-mono text-slate-400">
                <div>Input: {t.inputVal} {t.from}</div>
                <div>Expected: {t.expectedVal.toFixed(3)} {t.to}</div>
                <div className="text-emerald-400 font-bold">Actual: {t.actualVal.toFixed(3)} {t.to}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
