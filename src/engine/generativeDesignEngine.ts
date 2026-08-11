import { MaterialsEngine, Material } from './materials';
import { StructuralFemEngine } from './structuralFem';
import { SimulationFrameworkEngine } from './simulationFramework';

export interface GenerativeInputConstraints {
  loadKN: number;
  materialId: string;
  maxVolumeReductionPct: number; // e.g. 50% target reduction
  minSafetyFactor: number;       // e.g. 1.5
  candidateCount: number;        // 10, 100, or 1000
  envelopeLengthMm: number;
  envelopeWidthMm: number;
  envelopeHeightMm: number;
}

export interface GenerativeCandidate {
  id: string;
  candidateNumber: number;
  latticeDensityPct: number;
  wallThicknessMm: number;
  lighteningHoleRadiusMm: number;
  ribCount: number;
  massKg: number;
  maxVonMisesStressMPa: number;
  maxDeflectionMm: number;
  safetyFactor: number;
  passedConstraints: boolean;
  isParetoOptimal: boolean;
  score: number; // 0-100 overall design score
  topologyCategory: 'LIGHTWEIGHT' | 'BALANCED' | 'HIGH_STRENGTH' | 'NON_COMPLIANT';
}

export interface GenerativeDesignSummary {
  constraints: GenerativeInputConstraints;
  totalGenerated: number;
  compliantCount: number;
  paretoFrontierCount: number;
  candidates: GenerativeCandidate[];
  paretoCandidates: GenerativeCandidate[];
  bestLightweight: GenerativeCandidate;
  bestHighSafety: GenerativeCandidate;
  bestBalanced: GenerativeCandidate;
  executionTimeMs: number;
}

export class GenerativeDesignEngine {
  /**
   * Multi-candidate Generative Topology Optimization Engine
   * Generates N candidates, runs FEM physics validation, calculates Pareto Frontier
   */
  public static runGenerativeOptimization(
    constraints: GenerativeInputConstraints
  ): GenerativeDesignSummary {
    const startTime = performance.now();
    const mat = MaterialsEngine.getMaterialById(constraints.materialId || 'mat-titanium-ti6al4v');
    const count = Math.min(1000, Math.max(10, constraints.candidateCount || 100));

    const baselineVolumeM3 = (constraints.envelopeLengthMm * constraints.envelopeWidthMm * constraints.envelopeHeightMm) / 1e9;
    const baselineMassKg = baselineVolumeM3 * mat.densityKgM3;

    const candidates: GenerativeCandidate[] = [];

    // Monte Carlo parameter sampling across topology space
    for (let i = 1; i <= count; i++) {
      // Sample topology parameters
      const latticeDensityPct = 25 + Math.random() * 65; // 25% - 90%
      const wallThicknessMm = 1.5 + Math.random() * 6.5; // 1.5 - 8.0 mm
      const holeRadiusMm = 4.0 + Math.random() * 18.0;   // 4 - 22 mm
      const ribCount = Math.floor(2 + Math.random() * 7); // 2 - 8 stiffening ribs

      // Volume reduction ratio estimated from topology params
      const volumeFactor = (latticeDensityPct / 100) * (1 - (holeRadiusMm / 30) * 0.3) + (ribCount * 0.03);
      const effectiveMassKg = baselineMassKg * Math.min(0.95, Math.max(0.15, volumeFactor));

      // Simulate structural stress using SECP physics solver approximation
      const mesh = SimulationFrameworkEngine.generateStandardMesh(constraints.envelopeLengthMm, constraints.envelopeHeightMm, 8, 3);
      const fem = StructuralFemEngine.solveStructuralFea(
        mesh,
        mat.youngModulusGPa || 200,
        mat.poissonsRatio || 0.29,
        mat.yieldStrengthMPa || 250,
        constraints.loadKN * 1000
      );

      // Stress scales inversely with mass and wall thickness
      const stressMultiplier = (baselineMassKg / effectiveMassKg) * (3.5 / wallThicknessMm);
      const vonMisesStress = fem.maxVonMisesStressMPa * Math.min(3.0, Math.max(0.6, stressMultiplier));
      const sf = mat.yieldStrengthMPa / Math.max(1, vonMisesStress);
      const deflection = fem.maxDisplacementMm * (stressMultiplier * 0.7);

      const passed = sf >= constraints.minSafetyFactor && vonMisesStress <= mat.yieldStrengthMPa;

      let category: GenerativeCandidate['topologyCategory'] = 'NON_COMPLIANT';
      if (passed) {
        if (effectiveMassKg < baselineMassKg * 0.4) category = 'LIGHTWEIGHT';
        else if (sf > 2.5) category = 'HIGH_STRENGTH';
        else category = 'BALANCED';
      }

      // Design score weighting: 50% Mass saving, 50% Safety Factor
      const massSavingPct = ((baselineMassKg - effectiveMassKg) / baselineMassKg) * 100;
      const score = passed ? Math.min(100, massSavingPct * 0.5 + Math.min(50, sf * 15)) : Math.max(0, 30 - sf * 5);

      candidates.push({
        id: `GEN-CAND-${i}`,
        candidateNumber: i,
        latticeDensityPct: parseFloat(latticeDensityPct.toFixed(1)),
        wallThicknessMm: parseFloat(wallThicknessMm.toFixed(2)),
        lighteningHoleRadiusMm: parseFloat(holeRadiusMm.toFixed(1)),
        ribCount,
        massKg: parseFloat(effectiveMassKg.toFixed(2)),
        maxVonMisesStressMPa: parseFloat(vonMisesStress.toFixed(1)),
        maxDeflectionMm: parseFloat(deflection.toFixed(2)),
        safetyFactor: parseFloat(sf.toFixed(2)),
        passedConstraints: passed,
        isParetoOptimal: false,
        score: parseFloat(score.toFixed(1)),
        topologyCategory: category,
      });
    }

    // Filter compliant candidates
    const compliant = candidates.filter(c => c.passedConstraints);

    // Compute Pareto Frontier (Min Mass vs. Max Safety Factor)
    compliant.forEach(c1 => {
      const isDominated = compliant.some(c2 =>
        c2.id !== c1.id &&
        c2.massKg <= c1.massKg &&
        c2.safetyFactor >= c1.safetyFactor &&
        (c2.massKg < c1.massKg || c2.safetyFactor > c1.safetyFactor)
      );
      c1.isParetoOptimal = !isDominated;
    });

    const paretoCandidates = compliant.filter(c => c.isParetoOptimal);

    // Select key benchmark recommendations
    const pool = paretoCandidates.length > 0 ? paretoCandidates : (compliant.length > 0 ? compliant : candidates);
    
    const bestLightweight = pool.reduce((min, c) => (c.massKg < min.massKg ? c : min), pool[0]);
    const bestHighSafety = pool.reduce((max, c) => (c.safetyFactor > max.safetyFactor ? c : max), pool[0]);
    const bestBalanced = pool.reduce((max, c) => (c.score > max.score ? c : max), pool[0]);

    const endTime = performance.now();

    return {
      constraints,
      totalGenerated: count,
      compliantCount: compliant.length,
      paretoFrontierCount: paretoCandidates.length,
      candidates,
      paretoCandidates,
      bestLightweight,
      bestHighSafety,
      bestBalanced,
      executionTimeMs: Math.round(endTime - startTime),
    };
  }
}
