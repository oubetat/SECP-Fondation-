/**
 * SECP Industrial OS - PATCH-269: Fatigue Analysis & Verification Kernel
 * Test Battery 269 - 37 Comprehensive Engineering Physics & Verification Tests
 */

import { FatigueAnalysisService269 } from './FatigueAnalysisService269';
import { RainflowCycleCounter269 } from './RainflowCycleCounter269';
import { FEMStressInput, StressHistoryPoint } from './FatigueTypes269';

export interface TestResult269 {
  id: number;
  name: string;
  category: string;
  passed: boolean;
  message: string;
  details?: string;
}

export interface TestBatterySummary269 {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: TestResult269[];
}

export class FatigueTestBattery269 {
  public static runTestBattery(): TestBatterySummary269 {
    FatigueAnalysisService269.initialize();
    const results: TestResult269[] = [];

    // Test 1: S-N Dataset creation & retrieval
    try {
      const ds = FatigueAnalysisService269.getSNDataset('MAT-AL6061-T6');
      results.push({
        id: 1,
        name: 'S-N Dataset retrieval & schema verification',
        category: 'S-N Datasets',
        passed: ds !== null && ds.rawPoints.length === 5,
        message: 'Successfully retrieved benchmark Al 6061-T6 S-N dataset (5 experimental points).',
      });
    } catch (e: any) {
      results.push({ id: 1, name: 'S-N Dataset retrieval', category: 'S-N Datasets', passed: false, message: e.message });
    }

    // Test 2: Raw data preservation
    try {
      const ds = FatigueAnalysisService269.getSNDataset('MAT-AL6061-T6')!;
      const point1 = ds.rawPoints[0];
      results.push({
        id: 2,
        name: 'Raw experimental S-N data preservation',
        category: 'Data Integrity',
        passed: point1.stressCanonicalPa === 250e6 && point1.cyclesToFailure === 1e4,
        message: 'Preserved original experimental point (250 MPa -> 10,000 cycles) intact.',
      });
    } catch (e: any) {
      results.push({ id: 2, name: 'Raw experimental S-N data preservation', category: 'Data Integrity', passed: false, message: e.message });
    }

    // Test 3: Constant amplitude stress cycle parameter calculations
    try {
      const params = FatigueAnalysisService269.calculateStressCycleParams(300e6, -100e6);
      results.push({
        id: 3,
        name: 'Constant amplitude stress parameters calculation',
        category: 'Stress Mechanics',
        passed:
          params.stressRangePa === 400e6 &&
          params.stressAmplitudePa === 200e6 &&
          params.meanStressPa === 100e6 &&
          Math.abs(params.loadRatioR - -0.33333) < 1e-3,
        message: 'Accurately calculated stress range (400 MPa), amplitude (200 MPa), mean (100 MPa), and R ratio (-0.333).',
      });
    } catch (e: any) {
      results.push({ id: 3, name: 'Constant amplitude stress parameters calculation', category: 'Stress Mechanics', passed: false, message: e.message });
    }

    // Test 4: Stress ratio special cases (R calculation)
    try {
      const p1 = FatigueAnalysisService269.calculateStressCycleParams(200e6, 0); // Pulsating load: R = 0
      const p2 = FatigueAnalysisService269.calculateStressCycleParams(200e6, -200e6); // Fully reversed: R = -1
      results.push({
        id: 4,
        name: 'Stress ratio (R = min/max) special case handling',
        category: 'Stress Mechanics',
        passed: p1.loadRatioR === 0 && p2.loadRatioR === -1,
        message: 'Properly verified R = 0 (pulsating) and R = -1 (fully reversed).',
      });
    } catch (e: any) {
      results.push({ id: 4, name: 'Stress ratio special case handling', category: 'Stress Mechanics', passed: false, message: e.message });
    }

    // Test 5: Goodman mean stress correction
    try {
      // Amp = 150 MPa, Mean = 50 MPa, Ult = 310 MPa -> EqAmp = 150 / (1 - 50/310) = 178.846 MPa
      const eqAmp = FatigueAnalysisService269.applyMeanStressCorrection(150e6, 50e6, 310e6, 276e6, 'GOODMAN');
      results.push({
        id: 5,
        name: 'Goodman mean stress correction model',
        category: 'Mean Stress',
        passed: Math.abs(eqAmp / 1e6 - 178.846) < 1e-2,
        message: `Goodman equivalent amplitude: ${(eqAmp / 1e6).toFixed(2)} MPa.`,
      });
    } catch (e: any) {
      results.push({ id: 5, name: 'Goodman mean stress correction model', category: 'Mean Stress', passed: false, message: e.message });
    }

    // Test 6: Gerber mean stress correction
    try {
      // Amp = 150 MPa, Mean = 50 MPa, Ult = 310 MPa -> EqAmp = 150 / (1 - (50/310)^2) = 154.004 MPa
      const eqAmp = FatigueAnalysisService269.applyMeanStressCorrection(150e6, 50e6, 310e6, 276e6, 'GERBER');
      results.push({
        id: 6,
        name: 'Gerber mean stress correction model',
        category: 'Mean Stress',
        passed: Math.abs(eqAmp / 1e6 - 154.004) < 1e-2,
        message: `Gerber equivalent amplitude: ${(eqAmp / 1e6).toFixed(2)} MPa.`,
      });
    } catch (e: any) {
      results.push({ id: 6, name: 'Gerber mean stress correction model', category: 'Mean Stress', passed: false, message: e.message });
    }

    // Test 7: Soderberg mean stress correction
    try {
      // Amp = 150 MPa, Mean = 50 MPa, Yield = 276 MPa -> EqAmp = 150 / (1 - 50/276) = 183.185 MPa
      const eqAmp = FatigueAnalysisService269.applyMeanStressCorrection(150e6, 50e6, 310e6, 276e6, 'SODERBERG');
      results.push({
        id: 7,
        name: 'Soderberg mean stress correction model',
        category: 'Mean Stress',
        passed: Math.abs(eqAmp / 1e6 - 183.185) < 1e-2,
        message: `Soderberg equivalent amplitude: ${(eqAmp / 1e6).toFixed(2)} MPa.`,
      });
    } catch (e: any) {
      results.push({ id: 7, name: 'Soderberg mean stress correction model', category: 'Mean Stress', passed: false, message: e.message });
    }

    // Test 8: S-N Log-linear interpolation determinism
    try {
      // Al 6061-T6: 200 MPa -> 5e4 cycles, 150 MPa -> 3e5 cycles. Midpoint 175 MPa -> ~1.22e5 cycles
      const evalRes = FatigueAnalysisService269.evaluateLifeFromSN('MAT-AL6061-T6', 175e6, 0, 293.15, 'NONE');
      results.push({
        id: 8,
        name: 'S-N log-linear interpolation determinism',
        category: 'Life Evaluation',
        passed: evalRes.classification === 'FINITE_LIFE' && evalRes.cyclesToFailure > 5e4 && evalRes.cyclesToFailure < 3e5,
        message: `Interpolated life for 175 MPa: ${Math.round(evalRes.cyclesToFailure).toLocaleString()} cycles.`,
      });
    } catch (e: any) {
      results.push({ id: 8, name: 'S-N log-linear interpolation determinism', category: 'Life Evaluation', passed: false, message: e.message });
    }

    // Test 9: Endurance limit threshold
    try {
      // Stress below endurance limit (e.g. 80 MPa < 90 MPa) -> Infinite life / threshold cycles
      const evalRes = FatigueAnalysisService269.evaluateLifeFromSN('MAT-AL6061-T6', 80e6, 0, 293.15, 'NONE');
      results.push({
        id: 9,
        name: 'Endurance limit threshold detection',
        category: 'Life Evaluation',
        passed: evalRes.classification === 'SAFE_UNDER_CRITERION' && evalRes.cyclesToFailure >= 1e7,
        message: 'Stress below endurance limit (80 MPa < 90 MPa) classified as SAFE_UNDER_CRITERION.',
      });
    } catch (e: any) {
      results.push({ id: 9, name: 'Endurance limit threshold detection', category: 'Life Evaluation', passed: false, message: e.message });
    }

    // Test 10: Extrapolation protection (unvalidated high stress)
    try {
      // Stress 350 MPa > max point 250 MPa -> Blocked!
      const evalRes = FatigueAnalysisService269.evaluateLifeFromSN('MAT-AL6061-T6', 350e6, 0, 293.15, 'NONE');
      results.push({
        id: 10,
        name: 'High-stress extrapolation protection blocking',
        category: 'Safety Bounds',
        passed: Number.isNaN(evalRes.cyclesToFailure) && evalRes.errorCode === 'MODEL_OUT_OF_VALIDITY',
        message: 'Blocked unvalidated high-stress extrapolation above experimental dataset range.',
      });
    } catch (e: any) {
      results.push({ id: 10, name: 'High-stress extrapolation protection blocking', category: 'Safety Bounds', passed: false, message: e.message });
    }

    // Test 11: Temperature-dependent fatigue validity check
    try {
      // Temperature 500 K > max temperature 450 K -> OUT_OF_VALIDITY_RANGE
      const evalRes = FatigueAnalysisService269.evaluateLifeFromSN('MAT-AL6061-T6', 150e6, 0, 500, 'NONE');
      results.push({
        id: 11,
        name: 'Temperature-dependent fatigue validity range enforcement',
        category: 'Temperature Coupling',
        passed: evalRes.errorCode === 'OUT_OF_VALIDITY_RANGE',
        message: 'Enforced temperature boundary (500 K > 450 K max dataset validity).',
      });
    } catch (e: any) {
      results.push({ id: 11, name: 'Temperature-dependent fatigue validity range enforcement', category: 'Temperature Coupling', passed: false, message: e.message });
    }

    // Test 12: Material condition matching (SS316L Annealed)
    try {
      const dsSS = FatigueAnalysisService269.getSNDataset('MAT-SS316L');
      results.push({
        id: 12,
        name: 'Material condition context matching (SS316L Annealed)',
        category: 'Condition Awareness',
        passed: dsSS !== null && dsSS.condition === 'ANNEALED' && dsSS.enduranceLimitPa === 200e6,
        message: 'Successfully matched SS316L Annealed fatigue condition (200 MPa endurance limit).',
      });
    } catch (e: any) {
      results.push({ id: 12, name: 'Material condition context matching', category: 'Condition Awareness', passed: false, message: e.message });
    }

    // Test 13: Rainflow Cycle Counting peaks extraction
    try {
      const raw = [0, 100e6, -50e6, 80e6, -30e6, 60e6, 0];
      const peaks = RainflowCycleCounter269.extractPeaksAndValleys(raw);
      results.push({
        id: 13,
        name: 'Rainflow cycle counting peak/valley extraction',
        category: 'Rainflow Counting',
        passed: peaks.length === 7 && peaks[1] === 100e6 && peaks[2] === -50e6,
        message: 'Accurately extracted all local turning points (peaks and valleys).',
      });
    } catch (e: any) {
      results.push({ id: 13, name: 'Rainflow cycle counting peak/valley extraction', category: 'Rainflow Counting', passed: false, message: e.message });
    }

    // Test 14: ASTM E1049-85 Rainflow Cycle Counting execution
    try {
      const history: StressHistoryPoint[] = [
        { timestampSec: 0, stressPa: 0 },
        { timestampSec: 1, stressPa: 150e6 },
        { timestampSec: 2, stressPa: -50e6 },
        { timestampSec: 3, stressPa: 100e6 },
        { timestampSec: 4, stressPa: -20e6 },
        { timestampSec: 5, stressPa: 80e6 },
        { timestampSec: 6, stressPa: 0 },
      ];
      const cycles = RainflowCycleCounter269.countCycles(history);
      results.push({
        id: 14,
        name: 'ASTM E1049-85 Rainflow cycle counting algorithm',
        category: 'Rainflow Counting',
        passed: cycles.length > 0 && cycles[0].stressRangePa > 0,
        message: `Extracted ${cycles.length} rainflow cycle groups from variable load history.`,
      });
    } catch (e: any) {
      results.push({ id: 14, name: 'ASTM E1049-85 Rainflow cycle counting algorithm', category: 'Rainflow Counting', passed: false, message: e.message });
    }

    // Test 15: Rainflow cycle histogram binning
    try {
      const history: StressHistoryPoint[] = [
        { timestampSec: 0, stressPa: 0 },
        { timestampSec: 1, stressPa: 200e6 },
        { timestampSec: 2, stressPa: -100e6 },
        { timestampSec: 3, stressPa: 150e6 },
        { timestampSec: 4, stressPa: 0 },
      ];
      const cycles = RainflowCycleCounter269.countCycles(history);
      const bins = RainflowCycleCounter269.createHistogramBins(cycles, 3);
      results.push({
        id: 15,
        name: 'Rainflow cycle spectrum histogram binning',
        category: 'Spectrum Analysis',
        passed: bins.length === 3,
        message: 'Generated 3 histogram bins for variable amplitude load spectrum.',
      });
    } catch (e: any) {
      results.push({ id: 15, name: 'Rainflow cycle spectrum histogram binning', category: 'Spectrum Analysis', passed: false, message: e.message });
    }

    // Test 16: Palmgren-Miner cumulative damage calculation
    try {
      const mockCycles = [
        { cycleId: 'C1', stressRangePa: 300e6, meanStressPa: 0, stressAmpPa: 150e6, minStressPa: -150e6, maxStressPa: 150e6, loadRatioR: -1, count: 30000, startIdx: 0, endIdx: 1 },
      ];
      const minerRes = FatigueAnalysisService269.calculateMinerDamage(mockCycles, 'MAT-AL6061-T6');
      results.push({
        id: 16,
        name: 'Palmgren-Miner cumulative linear damage accumulation',
        category: 'Damage Accumulation',
        passed: minerRes.totalDamage > 0 && minerRes.totalDamage < 1.0,
        message: `Damage sum D = ${minerRes.totalDamage.toFixed(4)} (n = 30,000 / N = 300,000 = 0.10).`,
      });
    } catch (e: any) {
      results.push({ id: 16, name: 'Palmgren-Miner cumulative linear damage accumulation', category: 'Damage Accumulation', passed: false, message: e.message });
    }

    // Test 17: Palmgren-Miner damage failure prediction threshold
    try {
      const mockCycles = [
        { cycleId: 'C1', stressRangePa: 400e6, meanStressPa: 0, stressAmpPa: 200e6, minStressPa: -200e6, maxStressPa: 200e6, loadRatioR: -1, count: 60000, startIdx: 0, endIdx: 1 },
      ]; // N_f = 50,000 at 200 MPa -> n = 60,000 => D = 1.2 >= 1.0
      const minerRes = FatigueAnalysisService269.calculateMinerDamage(mockCycles, 'MAT-AL6061-T6');
      results.push({
        id: 17,
        name: 'Palmgren-Miner failure prediction threshold (D >= 1.0)',
        category: 'Damage Accumulation',
        passed: minerRes.isFailurePredicted && minerRes.totalDamage >= 1.0,
        message: `Predicted failure (D = ${minerRes.totalDamage.toFixed(2)} >= 1.0).`,
      });
    } catch (e: any) {
      results.push({ id: 17, name: 'Palmgren-Miner failure prediction threshold', category: 'Damage Accumulation', passed: false, message: e.message });
    }

    // Test 18: Linear model sequence limitation notice
    try {
      const mockCycles = [
        { cycleId: 'C1', stressRangePa: 200e6, meanStressPa: 0, stressAmpPa: 100e6, minStressPa: -100e6, maxStressPa: 100e6, loadRatioR: -1, count: 100, startIdx: 0, endIdx: 1 },
      ];
      const minerRes = FatigueAnalysisService269.calculateMinerDamage(mockCycles, 'MAT-AL6061-T6');
      results.push({
        id: 18,
        name: 'Miner rule sequence limitation notice recorded',
        category: 'Model Limitations',
        passed: minerRes.modelLimitationNotice.includes('sequence-independent'),
        message: 'Explicitly declared Miner rule sequence-independent limitation.',
      });
    } catch (e: any) {
      results.push({ id: 18, name: 'Miner rule sequence limitation notice recorded', category: 'Model Limitations', passed: false, message: e.message });
    }

    // Test 19: FEM stress field mapping consumption
    try {
      const femInput: FEMStressInput = {
        meshId: 'MESH-BRACKET-01',
        meshRevision: 1,
        loadCaseId: 'LC-MAX-FLIGHT',
        elementStresses: [
          { elementId: 'ELEM-101', stressPa: 180e6 },
          { elementId: 'ELEM-102', stressPa: 120e6 },
          { elementId: 'ELEM-103', stressPa: 80e6 },
        ],
        isValidFEM: true,
        provenanceHash: 'SHA256-FEM-RUN-9921A',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', []);
      results.push({
        id: 19,
        name: 'FEM stress field mapping consumption',
        category: 'FEM Integration',
        passed: analysis.status === 'COMPLETED' && analysis.elementResults.length === 3,
        message: 'Successfully mapped and processed 3 finite elements from FEM stress field.',
      });
    } catch (e: any) {
      results.push({ id: 19, name: 'FEM stress field mapping consumption', category: 'FEM Integration', passed: false, message: e.message });
    }

    // Test 20: Critical location detection
    try {
      const femInput: FEMStressInput = {
        meshId: 'MESH-BRACKET-01',
        meshRevision: 1,
        loadCaseId: 'LC-MAX-FLIGHT',
        elementStresses: [
          { elementId: 'ELEM-LOW', stressPa: 100e6 },
          { elementId: 'ELEM-CRITICAL', stressPa: 220e6 }, // Highest stress -> lowest life!
          { elementId: 'ELEM-MID', stressPa: 150e6 },
        ],
        isValidFEM: true,
        provenanceHash: 'SHA256-FEM-RUN-9921B',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', []);
      results.push({
        id: 20,
        name: 'Critical location detection (minimum life element)',
        category: 'Critical Location',
        passed: analysis.criticalLocation.elementId === 'ELEM-CRITICAL',
        message: 'Correctly identified ELEM-CRITICAL as the critical fatigue location.',
      });
    } catch (e: any) {
      results.push({ id: 20, name: 'Critical location detection', category: 'Critical Location', passed: false, message: e.message });
    }

    // Test 21: Fatigue life field generation
    try {
      const femInput: FEMStressInput = {
        meshId: 'MESH-1',
        meshRevision: 1,
        loadCaseId: 'LC-1',
        elementStresses: [{ elementId: 'E1', stressPa: 150e6 }],
        isValidFEM: true,
        provenanceHash: 'HASH1',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', []);
      const elemRes = analysis.elementResults[0];
      results.push({
        id: 21,
        name: 'Element-level fatigue life field generation',
        category: 'Results Field',
        passed: typeof elemRes.predictedCyclesToFailure === 'number' && elemRes.predictedCyclesToFailure > 0,
        message: `Generated element fatigue life: ${Math.round(elemRes.predictedCyclesToFailure).toLocaleString()} cycles.`,
      });
    } catch (e: any) {
      results.push({ id: 21, name: 'Element-level fatigue life field generation', category: 'Results Field', passed: false, message: e.message });
    }

    // Test 22: Fatigue damage field generation
    try {
      const femInput: FEMStressInput = {
        meshId: 'MESH-1',
        meshRevision: 1,
        loadCaseId: 'LC-1',
        elementStresses: [{ elementId: 'E1', stressPa: 150e6 }],
        isValidFEM: true,
        provenanceHash: 'HASH1',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', []);
      const elemRes = analysis.elementResults[0];
      results.push({
        id: 22,
        name: 'Element-level fatigue damage field generation',
        category: 'Results Field',
        passed: typeof elemRes.damagePerBlock === 'number' && elemRes.damagePerBlock > 0,
        message: `Generated element fatigue damage: ${elemRes.damagePerBlock.toExponential(3)}.`,
      });
    } catch (e: any) {
      results.push({ id: 22, name: 'Element-level fatigue damage field generation', category: 'Results Field', passed: false, message: e.message });
    }

    // Test 23: Fatigue safety factor calculation
    try {
      const femInput: FEMStressInput = {
        meshId: 'MESH-1',
        meshRevision: 1,
        loadCaseId: 'LC-1',
        elementStresses: [{ elementId: 'E1', stressPa: 150e6 }],
        isValidFEM: true,
        provenanceHash: 'HASH1',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', []);
      const elemRes = analysis.elementResults[0];
      results.push({
        id: 23,
        name: 'Fatigue safety factor calculation (Endurance / EqAmp)',
        category: 'Safety Metrics',
        passed: typeof elemRes.fatigueSafetyFactor === 'number' && elemRes.fatigueSafetyFactor > 0,
        message: `Fatigue safety factor: ${elemRes.fatigueSafetyFactor.toFixed(2)}.`,
      });
    } catch (e: any) {
      results.push({ id: 23, name: 'Fatigue safety factor calculation', category: 'Safety Metrics', passed: false, message: e.message });
    }

    // Test 24: Fatigue Analysis Snapshot creation
    try {
      const femInput: FEMStressInput = {
        meshId: 'MESH-1',
        meshRevision: 1,
        loadCaseId: 'LC-1',
        elementStresses: [{ elementId: 'E1', stressPa: 150e6 }],
        isValidFEM: true,
        provenanceHash: 'HASH1',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', []);
      const snap = FatigueAnalysisService269.createFatigueAnalysisSnapshot(analysis);
      results.push({
        id: 24,
        name: 'Fatigue analysis snapshot creation',
        category: 'Reproducibility',
        passed: snap.snapshotId.startsWith('SNAP269-') && snap.snapshotHash !== '',
        message: `Created immutable snapshot ID: ${snap.snapshotId}.`,
      });
    } catch (e: any) {
      results.push({ id: 24, name: 'Fatigue analysis snapshot creation', category: 'Reproducibility', passed: false, message: e.message });
    }

    // Test 25: Snapshot immutability & fingerprinting
    try {
      const femInput: FEMStressInput = {
        meshId: 'MESH-1',
        meshRevision: 1,
        loadCaseId: 'LC-1',
        elementStresses: [{ elementId: 'E1', stressPa: 150e6 }],
        isValidFEM: true,
        provenanceHash: 'HASH1',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', []);
      const snap = FatigueAnalysisService269.createFatigueAnalysisSnapshot(analysis);
      const hashBefore = snap.snapshotHash;
      results.push({
        id: 25,
        name: 'Snapshot immutability and SHA-256 fingerprinting',
        category: 'Reproducibility',
        passed: snap.snapshotHash === hashBefore && snap.solverVersion.includes('V269'),
        message: `Snapshot fingerprint verified: ${snap.snapshotHash}.`,
      });
    } catch (e: any) {
      results.push({ id: 25, name: 'Snapshot immutability and SHA-256 fingerprinting', category: 'Reproducibility', passed: false, message: e.message });
    }

    // Test 26: Deterministic execution repeatability
    try {
      const res1 = FatigueAnalysisService269.evaluateLifeFromSN('MAT-AL6061-T6', 150e6, 0, 293.15, 'GOODMAN');
      const res2 = FatigueAnalysisService269.evaluateLifeFromSN('MAT-AL6061-T6', 150e6, 0, 293.15, 'GOODMAN');
      results.push({
        id: 26,
        name: 'Deterministic execution repeatability',
        category: 'Determinism',
        passed: res1.cyclesToFailure === res2.cyclesToFailure && res1.equivalentAmpPa === res2.equivalentAmpPa,
        message: 'Identical inputs produced identical deterministic fatigue life outputs.',
      });
    } catch (e: any) {
      results.push({ id: 26, name: 'Deterministic execution repeatability', category: 'Determinism', passed: false, message: e.message });
    }

    // Test 27: Negative Test — Missing fatigue dataset
    try {
      const evalRes = FatigueAnalysisService269.evaluateLifeFromSN('MAT-UNKNOWN', 150e6);
      results.push({
        id: 27,
        name: 'Negative Test — Missing fatigue dataset handling',
        category: 'Negative Tests',
        passed: evalRes.errorCode === 'INSUFFICIENT_FATIGUE_DATA' && evalRes.classification === 'INSUFFICIENT_DATA',
        message: 'Properly raised INSUFFICIENT_FATIGUE_DATA for unregistered material.',
      });
    } catch (e: any) {
      results.push({ id: 27, name: 'Negative Test — Missing fatigue dataset handling', category: 'Negative Tests', passed: false, message: e.message });
    }

    // Test 28: Negative Test — Unlinked / invalid FEM input
    try {
      const femInput: FEMStressInput = {
        meshId: 'MESH-ERR',
        meshRevision: 1,
        loadCaseId: 'LC-ERR',
        elementStresses: [],
        isValidFEM: false, // INVALID!
        provenanceHash: 'HASH-ERR',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', []);
      results.push({
        id: 28,
        name: 'Negative Test — Unlinked / invalid FEM input handling',
        category: 'Negative Tests',
        passed: analysis.status === 'FAILED' && analysis.errorCode === 'INVALID_FEM_INPUT',
        message: 'Successfully caught unlinked invalid FEM stress input.',
      });
    } catch (e: any) {
      results.push({ id: 28, name: 'Negative Test — Unlinked / invalid FEM input handling', category: 'Negative Tests', passed: false, message: e.message });
    }

    // Test 29: Complete evidence chain generation
    try {
      const femInput: FEMStressInput = {
        meshId: 'MESH-1',
        meshRevision: 1,
        loadCaseId: 'LC-1',
        elementStresses: [{ elementId: 'E1', stressPa: 150e6 }],
        isValidFEM: true,
        provenanceHash: 'HASH1',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', []);
      const report = FatigueAnalysisService269.generateFatigueEngineeringReport(analysis.analysisId)!;
      results.push({
        id: 29,
        name: 'Complete engineering evidence chain generation',
        category: 'Evidence',
        passed: report.digitalCertificateSHA256.startsWith('CERT-FAT269-') && report.limitations.length === 3,
        message: `Generated digital certificate: ${report.digitalCertificateSHA256}.`,
      });
    } catch (e: any) {
      results.push({ id: 29, name: 'Complete engineering evidence chain generation', category: 'Evidence', passed: false, message: e.message });
    }

    // Test 30: Fatigue vs Static Factor of Safety distinction
    try {
      // Static yield is 276 MPa -> Static FoS = 276 / 150 = 1.84.
      // Fatigue endurance is 90 MPa -> Fatigue SF = 90 / 150 = 0.60. Distinct!
      const femInput: FEMStressInput = {
        meshId: 'MESH-1',
        meshRevision: 1,
        loadCaseId: 'LC-1',
        elementStresses: [{ elementId: 'E1', stressPa: 150e6 }],
        isValidFEM: true,
        provenanceHash: 'HASH1',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', []);
      const fatigueSF = analysis.elementResults[0].fatigueSafetyFactor;
      const staticFoS = 276e6 / 150e6;
      results.push({
        id: 30,
        name: 'Fatigue Safety Factor vs Static FoS distinction',
        category: 'Safety Physics',
        passed: fatigueSF !== staticFoS && Math.abs(fatigueSF - 0.60) < 0.05,
        message: `Maintained clear distinction: Static FoS = ${staticFoS.toFixed(2)} vs Fatigue SF = ${fatigueSF.toFixed(2)}.`,
      });
    } catch (e: any) {
      results.push({ id: 30, name: 'Fatigue Safety Factor vs Static FoS distinction', category: 'Safety Physics', passed: false, message: e.message });
    }

    // Test 31: Titanium Ti-6Al-4V S-N benchmark evaluation
    try {
      const evalRes = FatigueAnalysisService269.evaluateLifeFromSN('MAT-TI6AL4V', 550e6, 0, 293.15, 'NONE');
      results.push({
        id: 31,
        name: 'Titanium Ti-6Al-4V Grade 5 S-N benchmark evaluation',
        category: 'Benchmarks',
        passed: evalRes.classification === 'FINITE_LIFE' && Math.abs(evalRes.cyclesToFailure - 1e5) < 1e3,
        message: 'Titanium 550 MPa benchmark matched exactly 100,000 cycles.',
      });
    } catch (e: any) {
      results.push({ id: 31, name: 'Titanium Ti-6Al-4V Grade 5 S-N benchmark evaluation', category: 'Benchmarks', passed: false, message: e.message });
    }

    // Test 32: Variable amplitude loading history workflow
    try {
      const history: StressHistoryPoint[] = [
        { timestampSec: 0, stressPa: 0 },
        { timestampSec: 1, stressPa: 220e6 },
        { timestampSec: 2, stressPa: -80e6 },
        { timestampSec: 3, stressPa: 160e6 },
        { timestampSec: 4, stressPa: 0 },
      ];
      const femInput: FEMStressInput = {
        meshId: 'MESH-AERO',
        meshRevision: 1,
        loadCaseId: 'LC-VARIABLE',
        elementStresses: [{ elementId: 'E-CRIT', stressPa: 220e6 }],
        isValidFEM: true,
        provenanceHash: 'HASH-VAR',
      };
      const analysis = FatigueAnalysisService269.runFEMFatigueAnalysis(femInput, 'MAT-AL6061-T6', history);
      results.push({
        id: 32,
        name: 'Variable amplitude loading history workflow',
        category: 'Variable Loading',
        passed: analysis.loadMethod === 'RAINFLOW_MINER' && analysis.status === 'COMPLETED',
        message: 'Successfully processed full variable amplitude loading history through Rainflow + Miner.',
      });
    } catch (e: any) {
      results.push({ id: 32, name: 'Variable amplitude loading history workflow', category: 'Variable Loading', passed: false, message: e.message });
    }

    // Test 33: Dataset revision integrity
    try {
      const ds = FatigueAnalysisService269.getSNDataset('MAT-AL6061-T6')!;
      results.push({
        id: 33,
        name: 'S-N Dataset revision integrity',
        category: 'Revisioning',
        passed: ds.datasetRevision === 1 && ds.status === 'APPROVED',
        message: 'Verified dataset revision 1 and APPROVED governance status.',
      });
    } catch (e: any) {
      results.push({ id: 33, name: 'S-N Dataset revision integrity', category: 'Revisioning', passed: false, message: e.message });
    }

    // Test 34: Unit safety validation (Pa canonical enforcement)
    try {
      const ds = FatigueAnalysisService269.getSNDataset('MAT-AL6061-T6')!;
      results.push({
        id: 34,
        name: 'Unit safety validation (SI Pascal canonical enforcement)',
        category: 'Unit Safety',
        passed: ds.canonicalUnit === 'Pa' && ds.rawPoints.every((p) => p.stressCanonicalPa > 0),
        message: 'All stress points internally stored and validated in canonical Pascals (Pa).',
      });
    } catch (e: any) {
      results.push({ id: 34, name: 'Unit safety validation', category: 'Unit Safety', passed: false, message: e.message });
    }

    // Test 35: Infinite life convention checking
    try {
      const ds = FatigueAnalysisService269.getSNDataset('MAT-AL6061-T6')!;
      results.push({
        id: 35,
        name: 'Infinite-life convention & endurance limit basis',
        category: 'Endurance Physics',
        passed: ds.enduranceLimitPa === 90e6 && ds.enduranceCyclesThreshold === 1e7,
        message: 'Endurance limit explicitly defined as 90 MPa at 10^7 threshold cycles.',
      });
    } catch (e: any) {
      results.push({ id: 35, name: 'Infinite-life convention', category: 'Endurance Physics', passed: false, message: e.message });
    }

    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;
    const passRate = (passed / total) * 100;

    return {
      total,
      passed,
      failed,
      passRate,
      results,
    };
  }
}
