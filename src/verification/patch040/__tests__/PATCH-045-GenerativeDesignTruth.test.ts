/**
 * SECP — PATCH-045 Qualification Battery
 * GENERATIVE DESIGN TRUTH CLOSURE
 */

import { describe, it, expect } from 'vitest';
import { 
  GenerativeDesignEngine, 
  GenerativeInputConstraints 
} from '../../../engine/generativeDesignEngine';
import { 
  GenerativeDesignTruthGate, 
  GenerativeDesignVerifier, 
  GenerativeDesignDefinition, 
  GenerativeDesignCandidate,
  PreserveRegion
} from '../../../engine/cad/generative/GenerativeDesignTruthGate';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';

describe('PATCH-045 Generative Design Truth Battery', () => {

  const mockDoc: EngineeringDocument = {
    documentId: 'DOC-GD-045',
    revision: 1,
    type: 'PART',
    units: { system: 'SI_MM', length: 'mm', angle: 'deg', mass: 'kg', force: 'N', pressure: 'MPa' },
    sketches: [],
    constraints: [],
    features: [],
    parameters: [],
    topologyMap: { version: 1 },
    derived: {},
    evidence: []
  } as any;

  // TEST 01 — CANONICAL DEFINITION & DESIGN SPACE
  it('should verify canonical GenerativeDesignDefinition and active preserve regions', () => {
    const preserve: PreserveRegion = {
      id: 'PR-1',
      name: 'Bolt Flange',
      geometryReferenceId: 'FACE_BOSS_01',
      type: 'BOLT_HOLE',
      volumeM3: 1e-6
    };

    const definition: GenerativeDesignDefinition = {
      generativeDesignId: 'GD-STUDY-045',
      sourceDocumentId: mockDoc.documentId,
      sourceRevision: mockDoc.revision,
      preserveRegions: [preserve],
      exclusionRegions: [],
      objectives: [{ type: 'MINIMIZE_MASS', weight: 1.0 }],
      maxStressAllowedMPa: 250,
      minSafetyFactorRequired: 1.5,
      seed: 12345,
      algorithmVersion: 'SIMP-v2.1'
    };

    expect(definition.generativeDesignId).toBe('GD-STUDY-045');
    expect(definition.preserveRegions[0].geometryReferenceId).toBe('FACE_BOSS_01');
    expect(GenerativeDesignVerifier.verifyPreserveRegions(definition, mockDoc)).toBe(true);
  });

  // TEST 02 — SEED REPRODUCIBILITY (ANTI RANDOM-RESULT)
  it('should guarantee 100% deterministic, seed-reproducible generative sweeps', () => {
    const input: GenerativeInputConstraints = {
      loadKN: 15,
      materialId: 'mat-aluminium-6061-t6',
      maxVolumeReductionPct: 60,
      minSafetyFactor: 1.5,
      candidateCount: 20,
      envelopeLengthMm: 300,
      envelopeWidthMm: 100,
      envelopeHeightMm: 100,
      seed: 424242
    };

    const run1 = GenerativeDesignEngine.runGenerativeOptimization(input);
    const run2 = GenerativeDesignEngine.runGenerativeOptimization(input);

    expect(run1.candidates.length).toBe(run2.candidates.length);
    expect(run1.bestBalanced.massKg).toBe(run2.bestBalanced.massKg);
    expect(run1.bestBalanced.maxVonMisesStressMPa).toBe(run2.bestBalanced.maxVonMisesStressMPa);
    expect(run1.bestBalanced.safetyFactor).toBe(run2.bestBalanced.safetyFactor);
  });

  // TEST 03 — CAD CANDIDATE & B-REP MUTATION GATE
  it('should verify optimized candidate resolves to genuine CAD and passes mutation gate', () => {
    const candidate: GenerativeDesignCandidate = {
      candidateId: 'CAND-OPT-1',
      generation: 30,
      massKg: 1.25,
      maxStressMPa: 180,
      safetyFactor: 1.8,
      complianceNm: 150,
      isValid: true,
      isOptimal: true,
      cadGeometryReferenceId: 'B_REP_SOLID_OPT_1',
      seed: 12345
    };

    const baselineGeometryId = 'B_REP_SOLID_BASELINE';

    // Verify CAD Mutation Gate (Baseline vs Optimized Geometry ID)
    const mutated = GenerativeDesignVerifier.verifyBRepMutation(baselineGeometryId, candidate.cadGeometryReferenceId);
    expect(mutated).toBe(true);
  });

  // TEST 04 — AUDIT VERDICT AND EVIDENCE GATE
  it('should pass Truth Acceptance Gate with full PASS verdicts and evidence', () => {
    const preserve: PreserveRegion = {
      id: 'PR-1',
      name: 'Flange',
      geometryReferenceId: 'FACE_01',
      type: 'BOLT_HOLE',
      volumeM3: 1e-6
    };

    const definition: GenerativeDesignDefinition = {
      generativeDesignId: 'GD-STUDY-045',
      sourceDocumentId: mockDoc.documentId,
      sourceRevision: mockDoc.revision,
      preserveRegions: [preserve],
      exclusionRegions: [],
      objectives: [{ type: 'MINIMIZE_MASS', weight: 1.0 }],
      maxStressAllowedMPa: 250,
      minSafetyFactorRequired: 1.5,
      seed: 12345,
      algorithmVersion: 'SIMP-v2.1'
    };

    const candidate: GenerativeDesignCandidate = {
      candidateId: 'CAND-OPT-1',
      generation: 30,
      massKg: 1.25,
      maxStressMPa: 180,
      safetyFactor: 1.8,
      complianceNm: 150,
      isValid: true,
      isOptimal: true,
      cadGeometryReferenceId: 'B_REP_SOLID_OPT_1',
      seed: 12345
    };

    const baselineGeometryId = 'B_REP_SOLID_BASELINE';

    const verdicts = GenerativeDesignTruthGate.runAudit(mockDoc, definition, candidate, baselineGeometryId);
    verdicts.forEach(v => {
      expect(v.verdict).toBe('PASS');
    });

    const evidence = GenerativeDesignTruthGate.generateEvidence(mockDoc, definition, candidate, baselineGeometryId);
    expect(evidence.verdict).toBe('PASS');
    expect(evidence.payload.candidateSafetyFactor).toBe(1.8);
  });

  // NEGATIVE PROOFS
  it('should FAIL preserve-region verification if preserve array is empty', () => {
    const emptyDef: GenerativeDesignDefinition = {
      generativeDesignId: 'GD-STUDY-EMPTY',
      sourceDocumentId: mockDoc.documentId,
      sourceRevision: mockDoc.revision,
      preserveRegions: [],
      exclusionRegions: [],
      objectives: [],
      maxStressAllowedMPa: 250,
      minSafetyFactorRequired: 1.5,
      seed: 12345,
      algorithmVersion: 'SIMP-v2.1'
    };

    expect(GenerativeDesignVerifier.verifyPreserveRegions(emptyDef, mockDoc)).toBe(false);
  });

  it('should FAIL B-Rep Mutation Gate if optimized ID matches baseline ID', () => {
    const unmutated = GenerativeDesignVerifier.verifyBRepMutation('SOLID_A', 'SOLID_A');
    expect(unmutated).toBe(false);
  });

  it('should FAIL constraint evaluation if candidate exceeds maximum stress allowed', () => {
    const definition: GenerativeDesignDefinition = {
      generativeDesignId: 'GD-STUDY-045',
      sourceDocumentId: mockDoc.documentId,
      sourceRevision: mockDoc.revision,
      preserveRegions: [],
      exclusionRegions: [],
      objectives: [],
      maxStressAllowedMPa: 150, // Strict stress limit
      minSafetyFactorRequired: 1.5,
      seed: 12345,
      algorithmVersion: 'SIMP-v2.1'
    };

    const candidate: GenerativeDesignCandidate = {
      candidateId: 'CAND-OPT-1',
      generation: 30,
      massKg: 1.25,
      maxStressMPa: 180, // Exceeds 150 limit
      safetyFactor: 1.8,
      complianceNm: 150,
      isValid: true,
      isOptimal: true,
      cadGeometryReferenceId: 'B_REP_SOLID_OPT_1',
      seed: 12345
    };

    expect(GenerativeDesignVerifier.verifyConstraints(candidate, definition)).toBe(false);
  });

});
