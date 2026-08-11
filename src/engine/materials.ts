/**
 * PATCH-SECP-009 — Materials Engineering Database & Derived Property Engine
 * Part -> Material -> Mass -> Derived Engineering Physical Properties
 */

import { Material } from '../types/domainModel';
export type { Material };

export interface DerivedMaterialProperties {
  materialName: string;
  volumeM3: number;
  volumeCm3: number;
  massKg: number;
  massGrams: number;
  weightN: number;
  shearModulusGPa: number;
  bulkModulusGPa: number;
  speedOfSoundMS: number;
  maxTensileYieldLoadKN: number; // for 100mm² cross-section
  thermalExpansionDeltaMm: number; // per meter at 50°C delta T
  heatCapacityJK: number;
  thermalResistanceKPerW: number; // 10mm wall, 0.01m² area
}

export class MaterialsEngine {
  private static defaultMaterials: Material[] = [
    {
      id: 'mat-steel-a36',
      name: 'Structural Steel A36',
      category: 'STEEL',
      densityKgM3: 7850,
      youngModulusGPa: 200,
      poissonsRatio: 0.26,
      yieldStrengthMPa: 250,
      thermalConductivityWMK: 50,
      specificHeatJKgK: 480,
      expansionCoefficient1K: 12e-6,
      colorHex: '#64748b',
      description: 'Standard structural mild steel with good weldability and ductility.'
    },
    {
      id: 'mat-stainless-304',
      name: 'AISI 304 Stainless Steel',
      category: 'STEEL',
      densityKgM3: 8000,
      youngModulusGPa: 193,
      poissonsRatio: 0.29,
      yieldStrengthMPa: 215,
      thermalConductivityWMK: 16.2,
      specificHeatJKgK: 500,
      expansionCoefficient1K: 17.3e-6,
      colorHex: '#94a3b8',
      description: 'Austenitic stainless steel with high corrosion resistance.'
    },
    {
      id: 'mat-alu-6061',
      name: 'Aluminum 6061-T6',
      category: 'ALUMINUM',
      densityKgM3: 2700,
      youngModulusGPa: 68.9,
      poissonsRatio: 0.33,
      yieldStrengthMPa: 276,
      thermalConductivityWMK: 167,
      specificHeatJKgK: 896,
      expansionCoefficient1K: 23.6e-6,
      colorHex: '#cbd5e1',
      description: 'Precipitation-hardened aluminum alloy for structural components.'
    },
    {
      id: 'mat-titanium-gr5',
      name: 'Titanium Grade 5 (Ti-6Al-4V)',
      category: 'TITANIUM',
      densityKgM3: 4430,
      youngModulusGPa: 113.8,
      poissonsRatio: 0.34,
      yieldStrengthMPa: 880,
      thermalConductivityWMK: 6.7,
      specificHeatJKgK: 526,
      expansionCoefficient1K: 8.6e-6,
      colorHex: '#71717a',
      description: 'High-strength aerospace grade titanium alloy with excellent strength-to-weight ratio.'
    },
    {
      id: 'mat-copper-c11000',
      name: 'Copper C11000 (ETP)',
      category: 'COPPER_BRASS',
      densityKgM3: 8940,
      youngModulusGPa: 117,
      poissonsRatio: 0.34,
      yieldStrengthMPa: 220,
      thermalConductivityWMK: 391,
      specificHeatJKgK: 385,
      expansionCoefficient1K: 16.5e-6,
      colorHex: '#f97316',
      description: 'Electrolytic Tough Pitch copper with superior electrical & thermal conductivity.'
    },
    {
      id: 'mat-brass-c36000',
      name: 'Brass C36000 (Free-Cutting)',
      category: 'COPPER_BRASS',
      densityKgM3: 8500,
      youngModulusGPa: 100,
      poissonsRatio: 0.31,
      yieldStrengthMPa: 310,
      thermalConductivityWMK: 115,
      specificHeatJKgK: 380,
      expansionCoefficient1K: 20.5e-6,
      colorHex: '#eab308',
      description: 'Free-machining brass alloy ideal for precision threaded parts and fittings.'
    },
    {
      id: 'mat-abs-plastic',
      name: 'ABS Plastic (Engineering Polymeric)',
      category: 'PLASTIC',
      densityKgM3: 1050,
      youngModulusGPa: 2.3,
      poissonsRatio: 0.35,
      yieldStrengthMPa: 40,
      thermalConductivityWMK: 0.17,
      specificHeatJKgK: 1400,
      expansionCoefficient1K: 90e-6,
      colorHex: '#f43f5e',
      description: 'Rigid thermoplastic polymer used widely in injection molding & 3D printing.'
    },
    {
      id: 'mat-carbon-fiber',
      name: 'Carbon Fiber Composite (CFRP)',
      category: 'COMPOSITE',
      densityKgM3: 1550,
      youngModulusGPa: 150,
      poissonsRatio: 0.28,
      yieldStrengthMPa: 600,
      thermalConductivityWMK: 5.0,
      specificHeatJKgK: 1100,
      expansionCoefficient1K: 2.1e-6,
      colorHex: '#1e293b',
      description: 'High performance lightweight fiber-reinforced composite material.'
    }
  ];

  public static getMaterials(): Material[] {
    return [...this.defaultMaterials];
  }

  public static getPreloadedMaterials(): Material[] {
    return [...this.defaultMaterials];
  }

  public static getMaterialById(id: string): Material {
    return this.defaultMaterials.find(m => m.id === id) || this.defaultMaterials[0];
  }

  /**
   * Evaluates Mass and Derived Engineering Physical Properties
   * Part -> Material -> Mass -> Derived Properties
   */
  public static calculateDerivedProperties(
    material: Material,
    volumeM3: number,
    deltaTCelsius: number = 50
  ): DerivedMaterialProperties {
    const massKg = volumeM3 * material.densityKgM3;
    const massGrams = massKg * 1000;
    const weightN = massKg * 9.80665;

    // Elastic Shear Modulus G = E / (2 * (1 + v))
    const shearModulusGPa = material.youngModulusGPa / (2 * (1 + material.poissonsRatio));

    // Bulk Modulus K = E / (3 * (1 - 2*v))
    const bulkModulusGPa = material.youngModulusGPa / (3 * (1 - 2 * material.poissonsRatio));

    // Longitudinal Acoustic Speed c = sqrt(E / rho)
    const speedOfSoundMS = Math.sqrt((material.youngModulusGPa * 1e9) / material.densityKgM3);

    // Yield Tensile Load for 100 mm² cross section (0.0001 m²)
    const crossSectionAreaM2 = 0.0001;
    const maxTensileYieldLoadKN = (material.yieldStrengthMPa * 1e6 * crossSectionAreaM2) / 1000;

    // Thermal expansion for 1m specimen over deltaTCelsius
    const thermalExpansionDeltaMm = 1000 * material.expansionCoefficient1K * deltaTCelsius;

    // Heat capacity = m * Cp
    const heatCapacityJK = massKg * material.specificHeatJKgK;

    // Thermal resistance R_th = L / (k * A) for 10mm thickness, 0.01m² area
    const thermalResistanceKPerW = 0.01 / (material.thermalConductivityWMK * 0.01);

    return {
      materialName: material.name,
      volumeM3,
      volumeCm3: volumeM3 * 1e6,
      massKg,
      massGrams,
      weightN,
      shearModulusGPa,
      bulkModulusGPa,
      speedOfSoundMS,
      maxTensileYieldLoadKN,
      thermalExpansionDeltaMm,
      heatCapacityJK,
      thermalResistanceKPerW
    };
  }
}
