import React, { useState } from 'react';
import { MaterialsEngine, DerivedMaterialProperties } from '../engine/materials';
import { Material } from '../types/domainModel';
import { Layers, Flame, Scale, Zap, Shield, ChevronRight, PlusCircle, Activity } from 'lucide-react';

export const MaterialsPanel: React.FC = () => {
  const [materialsList, setMaterialsList] = useState<Material[]>(() => MaterialsEngine.getMaterials());
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('mat-steel-a36');
  const [partVolumeCm3, setPartVolumeCm3] = useState<number>(3750); // e.g. 250 x 150 x 100 mm box with volume
  const [deltaT, setDeltaT] = useState<number>(50); // Delta Temp °C

  const currentMaterial = materialsList.find(m => m.id === selectedMaterialId) || materialsList[0];
  const derivedProps: DerivedMaterialProperties = MaterialsEngine.calculateDerivedProperties(
    currentMaterial,
    partVolumeCm3 / 1e6, // convert cm³ to m³
    deltaT
  );

  // New Custom Material state
  const [isAdding, setIsAdding] = useState(false);
  const [newMatName, setNewMatName] = useState('Inconel 718 Superalloy');
  const [newDensity, setNewDensity] = useState(8190);
  const [newE, setNewE] = useState(205);
  const [newPoisson, setNewPoisson] = useState(0.29);
  const [newYield, setNewYield] = useState(1100);
  const [newThermalK, setNewThermalK] = useState(11.4);
  const [newSpecificHeat, setNewSpecificHeat] = useState(435);
  const [newExpansion, setNewExpansion] = useState(13e-6);

  const handleAddMaterial = () => {
    const customMat: Material = {
      id: `mat-custom-${Date.now()}`,
      name: newMatName,
      category: 'TITANIUM',
      densityKgM3: newDensity,
      youngModulusGPa: newE,
      poissonsRatio: newPoisson,
      yieldStrengthMPa: newYield,
      thermalConductivityWMK: newThermalK,
      specificHeatJKgK: newSpecificHeat,
      expansionCoefficient1K: newExpansion,
      colorHex: '#38bdf8',
      description: 'User-defined high performance engineering material.'
    };
    setMaterialsList(prev => [...prev, customMat]);
    setSelectedMaterialId(customMat.id);
    setIsAdding(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
            <Layers className="w-5 h-5" />
            PATCH-SECP-009 — Engineering Materials Database
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Physical material properties database & derived engineering mass, thermal, elastic properties calculation engine.
          </p>
        </div>
        <button
          id="btn-add-material-toggle"
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          {isAdding ? 'Cancel' : 'Add Custom Material'}
        </button>
      </div>

      {/* Add Custom Material Modal / Form */}
      {isAdding && (
        <div className="bg-slate-850 border border-indigo-500/30 rounded-lg p-4 space-y-3 bg-slate-950/80">
          <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Create Custom Engineering Material</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Name</label>
              <input
                type="text"
                value={newMatName}
                onChange={e => setNewMatName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Density (kg/m³)</label>
              <input
                type="number"
                value={newDensity}
                onChange={e => setNewDensity(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Young Modulus (GPa)</label>
              <input
                type="number"
                value={newE}
                onChange={e => setNewE(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Poisson Ratio</label>
              <input
                type="number"
                step="0.01"
                value={newPoisson}
                onChange={e => setNewPoisson(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Yield Strength (MPa)</label>
              <input
                type="number"
                value={newYield}
                onChange={e => setNewYield(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Thermal Cond. (W/m·K)</label>
              <input
                type="number"
                value={newThermalK}
                onChange={e => setNewThermalK(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Specific Heat (J/kg·K)</label>
              <input
                type="number"
                value={newSpecificHeat}
                onChange={e => setNewSpecificHeat(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Expansion Coeff (1/K)</label>
              <input
                type="number"
                step="0.000001"
                value={newExpansion}
                onChange={e => setNewExpansion(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>
          </div>
          <button
            onClick={handleAddMaterial}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded transition"
          >
            Save to Material Vault
          </button>
        </div>
      )}

      {/* Main Material Selection & Property Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Material Selection List */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Select Material</label>
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {materialsList.map(mat => (
              <button
                key={mat.id}
                onClick={() => setSelectedMaterialId(mat.id)}
                className={`w-full text-left p-3 rounded-lg border transition flex items-center justify-between cursor-pointer ${
                  mat.id === selectedMaterialId
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                    : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: mat.colorHex }}
                    />
                    {mat.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{mat.category}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            ))}
          </div>
        </div>

        {/* Selected Material 7 Fundamental Engineering Properties */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: currentMaterial.colorHex }}
                />
                {currentMaterial.name}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{currentMaterial.description}</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">1. Density (ρ)</span>
              <span className="font-bold text-slate-100">{currentMaterial.densityKgM3.toLocaleString()} kg/m³</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">2. Young Modulus (E)</span>
              <span className="font-bold text-cyan-400">{currentMaterial.youngModulusGPa} GPa</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">3. Poisson Ratio (ν)</span>
              <span className="font-bold text-slate-100">{currentMaterial.poissonsRatio}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">4. Yield Strength (σ_y)</span>
              <span className="font-bold text-emerald-400">{currentMaterial.yieldStrengthMPa} MPa</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">5. Thermal Cond. (k)</span>
              <span className="font-bold text-amber-400">{currentMaterial.thermalConductivityWMK} W/m·K</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">6. Specific Heat (c_p)</span>
              <span className="font-bold text-slate-100">{currentMaterial.specificHeatJKgK} J/kg·K</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">7. Thermal Expansion (α)</span>
              <span className="font-bold text-rose-400">{(currentMaterial.expansionCoefficient1K * 1e6).toFixed(1)} × 10⁻⁶ /K</span>
            </div>
          </div>
        </div>

        {/* Derived Part Properties Flow: Part -> Material -> Mass -> Physical Engineering Props */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-emerald-400" />
              Part → Material → Mass Property Flow
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Part Volume (cm³)</label>
              <input
                type="number"
                value={partVolumeCm3}
                onChange={e => setPartVolumeCm3(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Delta Temperature ΔT (°C)</label>
              <input
                type="number"
                value={deltaT}
                onChange={e => setDeltaT(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono"
              />
            </div>

            <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-lg space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-slate-300">
                <span>Total Mass (m):</span>
                <span className="font-bold text-emerald-400">{derivedProps.massKg.toFixed(3)} kg ({derivedProps.massGrams.toFixed(0)} g)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Gravitational Weight (W):</span>
                <span className="font-bold text-indigo-300">{derivedProps.weightN.toFixed(2)} N</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Shear Modulus (G):</span>
                <span className="font-bold text-cyan-300">{derivedProps.shearModulusGPa.toFixed(1)} GPa</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Bulk Modulus (K):</span>
                <span className="font-bold text-cyan-300">{derivedProps.bulkModulusGPa.toFixed(1)} GPa</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Acoustic Speed (c):</span>
                <span className="font-bold text-amber-300">{derivedProps.speedOfSoundMS.toFixed(0)} m/s</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Max Yield Load (100mm²):</span>
                <span className="font-bold text-emerald-300">{derivedProps.maxTensileYieldLoadKN.toFixed(1)} kN</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Thermal Elongation (1m):</span>
                <span className="font-bold text-rose-300">+{derivedProps.thermalExpansionDeltaMm.toFixed(2)} mm</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Total Heat Capacity:</span>
                <span className="font-bold text-orange-300">{derivedProps.heatCapacityJK.toFixed(0)} J/K</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
