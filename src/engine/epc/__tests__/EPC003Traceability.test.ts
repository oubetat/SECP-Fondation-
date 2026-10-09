/**
 * SECP Industrial OS — EPC-003: Requirement Traceability Test Suite
 * Comprehensive Validation, Verification, and Critical Gate Tests for EPC-003.
 */

import { describe, it, expect } from 'vitest';
import { RequirementTraceabilityEngine } from '../RequirementTraceabilityEngine';
import { TraceabilitySerializer } from '../TraceabilitySerializer';
import { EPC003Verifier } from '../EPC003Verifier';
import { TraceabilityValidationError } from '../TraceabilityTypes';
import { EngineeringRequirement } from '../EngineeringRequirementTypes';
import { EngineeringRequirementValidator } from '../EngineeringRequirementValidator';
import { ProofCaseProject } from '../ProofCaseTypes';
import { ProofCaseValidator } from '../ProofCaseValidator';

describe('EPC-003: Requirement Traceability', () => {
  // 1. Create empty traceability graph
  it('1. creates an empty traceability graph', () => {
    const engine = new RequirementTraceabilityEngine('G-001', 'v1.0.0');
    expect(engine.graphId).toBe('G-001');
    expect(engine.getAllArtifacts().length).toBe(0);
    expect(engine.getAllEdges().length).toBe(0);
  });

  // 2. Add valid Requirement artifact
  it('2. adds valid Requirement artifact', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'REQ-101', type: 'REQUIREMENT', name: 'Max Stress Limit' });
    const art = engine.getArtifact('REQ-101');
    expect(art).toBeDefined();
    expect(art?.type).toBe('REQUIREMENT');
  });

  // 3. Add valid Design Feature artifact
  it('3. adds valid Design Feature artifact', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'DF-201', type: 'DESIGN_FEATURE', name: 'Main Spar Web Thickness' });
    const art = engine.getArtifact('DF-201');
    expect(art?.type).toBe('DESIGN_FEATURE');
  });

  // 4. Add valid Analysis artifact
  it('4. adds valid Analysis artifact', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'AN-301', type: 'ANALYSIS', name: 'FEA Static Stress Run 04' });
    const art = engine.getArtifact('AN-301');
    expect(art?.type).toBe('ANALYSIS');
  });

  // 5. Add valid Test artifact
  it('5. adds valid Test artifact', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'TST-401', type: 'TEST', name: 'Static Load Bench Test' });
    const art = engine.getArtifact('TST-401');
    expect(art?.type).toBe('TEST');
  });

  // 6. Add valid Evidence artifact
  it('6. adds valid Evidence artifact', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'EV-501', type: 'EVIDENCE', name: 'Calibrated Strain Gauge Telemetry' });
    const art = engine.getArtifact('EV-501');
    expect(art?.type).toBe('EVIDENCE');
  });

  // 7. Create Requirement -> Design Feature edge
  it('7. creates Requirement -> Design Feature edge', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });
    engine.addEdge({
      edgeId: 'E1',
      sourceId: 'R1',
      sourceType: 'REQUIREMENT',
      targetId: 'DF1',
      targetType: 'DESIGN_FEATURE',
      relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE'
    });
    expect(engine.getAllEdges().length).toBe(1);
  });

  // 8. Create Design Feature -> Analysis edge
  it('8. creates Design Feature -> Analysis edge', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });
    engine.addArtifact({ artifactId: 'AN1', type: 'ANALYSIS', name: 'AN1' });
    engine.addEdge({
      edgeId: 'E2',
      sourceId: 'DF1',
      sourceType: 'DESIGN_FEATURE',
      targetId: 'AN1',
      targetType: 'ANALYSIS',
      relationshipType: 'DESIGN_FEATURE_TO_ANALYSIS'
    });
    expect(engine.getAllEdges().length).toBe(1);
  });

  // 9. Create Analysis -> Test edge
  it('9. creates Analysis -> Test edge', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'AN1', type: 'ANALYSIS', name: 'AN1' });
    engine.addArtifact({ artifactId: 'TST1', type: 'TEST', name: 'TST1' });
    engine.addEdge({
      edgeId: 'E3',
      sourceId: 'AN1',
      sourceType: 'ANALYSIS',
      targetId: 'TST1',
      targetType: 'TEST',
      relationshipType: 'ANALYSIS_TO_TEST'
    });
    expect(engine.getAllEdges().length).toBe(1);
  });

  // 10. Create Test -> Evidence edge
  it('10. creates Test -> Evidence edge', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'TST1', type: 'TEST', name: 'TST1' });
    engine.addArtifact({ artifactId: 'EV1', type: 'EVIDENCE', name: 'EV1' });
    engine.addEdge({
      edgeId: 'E4',
      sourceId: 'TST1',
      sourceType: 'TEST',
      targetId: 'EV1',
      targetType: 'EVIDENCE',
      relationshipType: 'TEST_TO_EVIDENCE'
    });
    expect(engine.getAllEdges().length).toBe(1);
  });

  // Helper for full chain
  function buildFullChainEngine() {
    const engine = new RequirementTraceabilityEngine('FULL-CHAIN');
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });
    engine.addArtifact({ artifactId: 'AN1', type: 'ANALYSIS', name: 'AN1' });
    engine.addArtifact({ artifactId: 'TST1', type: 'TEST', name: 'TST1' });
    engine.addArtifact({ artifactId: 'EV1', type: 'EVIDENCE', name: 'EV1' });

    engine.addEdge({ edgeId: 'E1', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
    engine.addEdge({ edgeId: 'E2', sourceId: 'DF1', sourceType: 'DESIGN_FEATURE', targetId: 'AN1', targetType: 'ANALYSIS', relationshipType: 'DESIGN_FEATURE_TO_ANALYSIS' });
    engine.addEdge({ edgeId: 'E3', sourceId: 'AN1', sourceType: 'ANALYSIS', targetId: 'TST1', targetType: 'TEST', relationshipType: 'ANALYSIS_TO_TEST' });
    engine.addEdge({ edgeId: 'E4', sourceId: 'TST1', sourceType: 'TEST', targetId: 'EV1', targetType: 'EVIDENCE', relationshipType: 'TEST_TO_EVIDENCE' });

    return engine;
  }

  // 11. Evaluate a complete trace
  it('11. evaluates a complete trace', () => {
    const engine = buildFullChainEngine();
    const trace = engine.getRequirementTrace('R1');
    expect(trace).toBeDefined();
    expect(trace.designFeatures.length).toBe(1);
    expect(trace.analyses.length).toBe(1);
    expect(trace.tests.length).toBe(1);
    expect(trace.evidence.length).toBe(1);
  });

  // 12. Complete trace returns FULLY_TRACEABLE
  it('12. complete trace returns FULLY_TRACEABLE', () => {
    const engine = buildFullChainEngine();
    const trace = engine.getRequirementTrace('R1');
    expect(trace.status).toBe('FULLY_TRACEABLE');
    expect(trace.isValidChain).toBe(true);
    expect(trace.missingStages.length).toBe(0);
  });

  // 13. Missing Design Feature returns PARTIALLY_TRACEABLE / UNTRACEABLE
  it('13. missing Design Feature is detected and reported', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    const trace = engine.getRequirementTrace('R1');
    expect(trace.status).toBe('UNTRACEABLE');
    expect(trace.missingStages).toContain('DESIGN_FEATURE');
  });

  // 14. Missing Analysis detected
  it('14. missing Analysis detected', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });
    engine.addEdge({ edgeId: 'E1', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });

    const trace = engine.getRequirementTrace('R1');
    expect(trace.status).toBe('PARTIALLY_TRACEABLE');
    expect(trace.missingStages).toContain('ANALYSIS');
  });

  // 15. Missing Test detected
  it('15. missing Test detected', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });
    engine.addArtifact({ artifactId: 'AN1', type: 'ANALYSIS', name: 'AN1' });
    engine.addEdge({ edgeId: 'E1', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
    engine.addEdge({ edgeId: 'E2', sourceId: 'DF1', sourceType: 'DESIGN_FEATURE', targetId: 'AN1', targetType: 'ANALYSIS', relationshipType: 'DESIGN_FEATURE_TO_ANALYSIS' });

    const trace = engine.getRequirementTrace('R1');
    expect(trace.missingStages).toContain('TEST');
  });

  // 16. Missing Evidence detected
  it('16. missing Evidence detected', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });
    engine.addArtifact({ artifactId: 'AN1', type: 'ANALYSIS', name: 'AN1' });
    engine.addArtifact({ artifactId: 'TST1', type: 'TEST', name: 'TST1' });
    engine.addEdge({ edgeId: 'E1', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
    engine.addEdge({ edgeId: 'E2', sourceId: 'DF1', sourceType: 'DESIGN_FEATURE', targetId: 'AN1', targetType: 'ANALYSIS', relationshipType: 'DESIGN_FEATURE_TO_ANALYSIS' });
    engine.addEdge({ edgeId: 'E3', sourceId: 'AN1', sourceType: 'ANALYSIS', targetId: 'TST1', targetType: 'TEST', relationshipType: 'ANALYSIS_TO_TEST' });

    const trace = engine.getRequirementTrace('R1');
    expect(trace.missingStages).toEqual(['EVIDENCE']);
  });

  // 17. Critical requirement with complete chain passes traceability
  it('17. critical requirement with complete chain passes traceability', () => {
    const engine = buildFullChainEngine();
    const critSpec: EngineeringRequirement = {
      requirementId: 'R1',
      description: 'Critical flight parameter',
      parameter: 'stress',
      unit: 'MPa',
      tolerance: { upperBound: 100 },
      priority: 'CRITICAL',
      verificationMethod: 'SIMULATION',
      validationMethod: 'PHYSICAL_TEST'
    };

    const trace = engine.getRequirementTrace('R1', critSpec);
    expect(trace.criticalGatePassed).toBe(true);
    expect(trace.status).toBe('FULLY_TRACEABLE');
  });

  // 18. Critical requirement missing any required link fails traceability
  it('18. critical requirement missing any required link fails traceability gate', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });
    engine.addEdge({ edgeId: 'E1', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });

    const critSpec: EngineeringRequirement = {
      requirementId: 'R1',
      description: 'Critical structural limit',
      parameter: 'stress',
      unit: 'MPa',
      tolerance: { upperBound: 100 },
      priority: 'CRITICAL',
      verificationMethod: 'SIMULATION',
      validationMethod: 'PHYSICAL_TEST'
    };

    const trace = engine.getRequirementTrace('R1', critSpec);
    expect(trace.criticalGatePassed).toBe(false);
    expect(trace.status).toBe('PARTIALLY_TRACEABLE');
  });

  // 19. Non-critical partial trace reports exact missing stages
  it('19. non-critical partial trace reports exact missing stages without forcing gate failure', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R-LOW', type: 'REQUIREMENT', name: 'Low Priority Req' });
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });
    engine.addEdge({ edgeId: 'E1', sourceId: 'R-LOW', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });

    const lowSpec: EngineeringRequirement = {
      requirementId: 'R-LOW',
      description: 'Paint color preference',
      parameter: 'color',
      unit: 'dimensionless',
      tolerance: {},
      priority: 'LOW',
      verificationMethod: 'INSPECTION',
      validationMethod: 'EXPERIMENT'
    };

    const trace = engine.getRequirementTrace('R-LOW', lowSpec);
    expect(trace.status).toBe('PARTIALLY_TRACEABLE');
    expect(trace.missingStages).toEqual(['ANALYSIS', 'TEST', 'EVIDENCE']);
    expect(trace.criticalGatePassed).toBe(true);
  });

  // 20. Duplicate edge protection
  it('20. duplicate edge protection prevents identical trace links', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });

    engine.addEdge({ edgeId: 'E1', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });

    expect(() => {
      engine.addEdge({ edgeId: 'E2', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
    }).toThrowError(TraceabilityValidationError);
  });

  // 21. Invalid source rejected
  it('21. rejects edge referencing nonexistent source artifact', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });

    expect(() => {
      engine.addEdge({ edgeId: 'E1', sourceId: 'NONEXISTENT', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
    }).toThrowError(TraceabilityValidationError);
  });

  // 22. Invalid target rejected
  it('22. rejects edge referencing nonexistent target artifact', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });

    expect(() => {
      engine.addEdge({ edgeId: 'E1', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'NONEXISTENT', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
    }).toThrowError(TraceabilityValidationError);
  });

  // 23. Invalid relationship type rejected
  it('23. rejects edge with invalid relationship type', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });

    expect(() => {
      engine.addEdge({ edgeId: 'E1', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'INVALID_REL_TYPE' as any });
    }).toThrowError(TraceabilityValidationError);
  });

  // 24. Invalid identifier rejected
  it('24. rejects empty or whitespace artifact/edge identifiers', () => {
    const engine = new RequirementTraceabilityEngine();
    expect(() => {
      engine.addArtifact({ artifactId: '  ', type: 'REQUIREMENT', name: 'R1' });
    }).toThrowError(TraceabilityValidationError);
  });

  // 25. Invalid directional relationship rejected
  it('25. rejects edge with invalid directional type mapping (e.g., Requirement -> Test directly)', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    engine.addArtifact({ artifactId: 'TST1', type: 'TEST', name: 'TST1' });

    expect(() => {
      engine.addEdge({
        edgeId: 'E1',
        sourceId: 'R1',
        sourceType: 'REQUIREMENT',
        targetId: 'TST1',
        targetType: 'TEST',
        relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' as any
      });
    }).toThrowError(TraceabilityValidationError);
  });

  // 26. Cycle protection
  it('26. prevents backward or cyclic relationships from corrupting canonical chain', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });

    expect(() => {
      engine.addEdge({
        edgeId: 'E-CYCLE',
        sourceId: 'DF1',
        sourceType: 'DESIGN_FEATURE',
        targetId: 'R1',
        targetType: 'REQUIREMENT',
        relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' as any
      });
    }).toThrowError(TraceabilityValidationError);
  });

  // 27. Orphan requirement detection
  it('27. detects orphan requirement with no downstream links', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R-ORPHAN', type: 'REQUIREMENT', name: 'Unlinked Req' });
    const orphans = engine.detectOrphans();
    expect(orphans.orphanRequirements.length).toBe(1);
    expect(orphans.orphanRequirements[0].artifactId).toBe('R-ORPHAN');
  });

  // 28. Orphan Design Feature detection
  it('28. detects orphan Design Feature with no requirement relationship', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'DF-ORPHAN', type: 'DESIGN_FEATURE', name: 'Unlinked DF' });
    const orphans = engine.detectOrphans();
    expect(orphans.orphanDesignFeatures.length).toBe(1);
  });

  // 29. Orphan Analysis detection
  it('29. detects orphan Analysis with no Design Feature relationship', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'AN-ORPHAN', type: 'ANALYSIS', name: 'Unlinked FEA' });
    const orphans = engine.detectOrphans();
    expect(orphans.orphanAnalyses.length).toBe(1);
  });

  // 30. Orphan Test detection
  it('30. detects orphan Test with no Analysis relationship', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'TST-ORPHAN', type: 'TEST', name: 'Unlinked Test' });
    const orphans = engine.detectOrphans();
    expect(orphans.orphanTests.length).toBe(1);
  });

  // 31. Orphan Evidence detection
  it('31. detects orphan Evidence with no Test relationship', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'EV-ORPHAN', type: 'EVIDENCE', name: 'Unlinked Log' });
    const orphans = engine.detectOrphans();
    expect(orphans.orphanEvidence.length).toBe(1);
  });

  // 32. Reverse lookup from Evidence to Requirement
  it('32. supports reverse lookup from Evidence to Requirement', () => {
    const engine = buildFullChainEngine();
    const rev = engine.getReverseTrace('EV1');
    expect(rev.evidenceId).toBe('EV1');
    expect(rev.tests.length).toBe(1);
    expect(rev.analyses.length).toBe(1);
    expect(rev.designFeatures.length).toBe(1);
    expect(rev.requirements.length).toBe(1);
    expect(rev.requirements[0].artifactId).toBe('R1');
    expect(rev.isCompleteReverseChain).toBe(true);
  });

  // 33. Requirement trace query returns complete chain
  it('33. requirement trace query returns complete chain detailing every stage', () => {
    const engine = buildFullChainEngine();
    const trace = engine.getRequirementTrace('R1');
    expect(trace.requirementId).toBe('R1');
    expect(trace.designFeatures[0].artifactId).toBe('DF1');
    expect(trace.analyses[0].artifactId).toBe('AN1');
    expect(trace.tests[0].artifactId).toBe('TST1');
    expect(trace.evidence[0].artifactId).toBe('EV1');
  });

  // 34. Serialization round trip
  it('34. verifies serialization and deserialization round trip', () => {
    const engine = buildFullChainEngine();
    const isRoundTrip = TraceabilitySerializer.verifyRoundTrip(engine);
    expect(isRoundTrip).toBe(true);
  });

  // 35. Deterministic serialization where applicable
  it('35. deterministic canonical serialization generates identical output and hash for identical graph structures', () => {
    const e1 = buildFullChainEngine();
    const e2 = buildFullChainEngine();

    const s1 = TraceabilitySerializer.serialize(e1);
    const s2 = TraceabilitySerializer.serialize(e2);

    expect(s1.canonicalString).toBe(s2.canonicalString);
    expect(s1.graphHash).toBe(s2.graphHash);
  });

  // 36. EPC-001 integration
  it('36. integrates with EPC-001 ProofCaseProject schema', () => {
    const reqSpec: EngineeringRequirement = {
      requirementId: 'REQ-AERO-001',
      description: 'Maximum aerodynamic drag coefficient',
      parameter: 'drag_coefficient',
      unit: 'dimensionless',
      tolerance: { upperBound: 0.32 },
      priority: 'HIGH',
      verificationMethod: 'SIMULATION',
      validationMethod: 'FIELD_TEST'
    };
    const reqRef = EngineeringRequirementValidator.toProofCaseRequirementReference(reqSpec);

    const project: ProofCaseProject = {
      caseId: 'CASE-AERO-001',
      caseType: 'SYSTEM',
      domain: 'AEROSPACE',
      revision: 'v1.0.0',
      status: 'DEFINED',
      owner: 'AERO-LEAD',
      requirements: [reqRef],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    const validatedProject = ProofCaseValidator.validate(project);
    expect(validatedProject.requirements[0].requirementId).toBe('REQ-AERO-001');
  });

  // 37. EPC-002 integration
  it('37. integrates with EPC-002 EngineeringRequirement schema', () => {
    const reqSpec: EngineeringRequirement = {
      requirementId: 'REQ-STRESS-001',
      description: 'Yield stress threshold',
      parameter: 'stress',
      unit: 'MPa',
      tolerance: { upperBound: 350 },
      priority: 'CRITICAL',
      verificationMethod: 'SIMULATION',
      validationMethod: 'PHYSICAL_TEST'
    };
    const validated = EngineeringRequirementValidator.validate(reqSpec);

    const engine = new RequirementTraceabilityEngine('EPC002-INT');
    engine.addArtifact({ artifactId: validated.requirementId, type: 'REQUIREMENT', name: validated.description });
    engine.addArtifact({ artifactId: 'DF-SPAR', type: 'DESIGN_FEATURE', name: 'Spar' });
    engine.addArtifact({ artifactId: 'AN-FEA', type: 'ANALYSIS', name: 'FEA' });
    engine.addArtifact({ artifactId: 'TST-BENCH', type: 'TEST', name: 'Bench' });
    engine.addArtifact({ artifactId: 'EV-LOG', type: 'EVIDENCE', name: 'Log' });

    engine.addEdge({ edgeId: 'E1', sourceId: validated.requirementId, sourceType: 'REQUIREMENT', targetId: 'DF-SPAR', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
    engine.addEdge({ edgeId: 'E2', sourceId: 'DF-SPAR', sourceType: 'DESIGN_FEATURE', targetId: 'AN-FEA', targetType: 'ANALYSIS', relationshipType: 'DESIGN_FEATURE_TO_ANALYSIS' });
    engine.addEdge({ edgeId: 'E3', sourceId: 'AN-FEA', sourceType: 'ANALYSIS', targetId: 'TST-BENCH', targetType: 'TEST', relationshipType: 'ANALYSIS_TO_TEST' });
    engine.addEdge({ edgeId: 'E4', sourceId: 'TST-BENCH', sourceType: 'TEST', targetId: 'EV-LOG', targetType: 'EVIDENCE', relationshipType: 'TEST_TO_EVIDENCE' });

    const trace = engine.getRequirementTrace(validated.requirementId, validated);
    expect(trace.criticalGatePassed).toBe(true);
    expect(trace.status).toBe('FULLY_TRACEABLE');
  });

  // 38. No UI dependency
  it('38. operates cleanly without UI framework or DOM dependencies', () => {
    expect(typeof window).toBe('undefined');
  });

  // 39. No product-specific logic
  it('39. operates in a completely domain-agnostic fashion', () => {
    const engine = new RequirementTraceabilityEngine('GENERIC');
    engine.addArtifact({ artifactId: 'REQ-GENERIC', type: 'REQUIREMENT', name: 'Generic Constraint' });
    expect(engine.getArtifact('REQ-GENERIC')).toBeDefined();
  });

  // 40. No fake evidence generation
  it('40. does not manufacture fake evidence or silently convert missing link into PASS', () => {
    const engine = new RequirementTraceabilityEngine();
    engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
    const trace = engine.getRequirementTrace('R1');
    expect(trace.evidence.length).toBe(0);
    expect(trace.status).toBe('UNTRACEABLE');
  });

  // STEP 19 — DEDICATED CRITICAL GATE TEST
  describe('Step 19: Dedicated Critical Gate Scenario', () => {
    it('executes two-stage critical requirement gate transition (FAIL when missing evidence -> PASS when complete)', () => {
      const engine = new RequirementTraceabilityEngine('CRIT-GATE-SCENARIO');

      const critReqSpec: EngineeringRequirement = {
        requirementId: 'R-CRITICAL-001',
        description: 'Critical aerospace structural load limit',
        parameter: 'stress',
        unit: 'MPa',
        tolerance: { upperBound: 300 },
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST'
      };

      // Register nodes up to Test
      engine.addArtifact({ artifactId: 'R-CRITICAL-001', type: 'REQUIREMENT', name: 'Critical Req 001' });
      engine.addArtifact({ artifactId: 'DF-WING-SPAR', type: 'DESIGN_FEATURE', name: 'Wing Spar Web' });
      engine.addArtifact({ artifactId: 'AN-FEA-RUN-12', type: 'ANALYSIS', name: 'FEA Stress Run 12' });
      engine.addArtifact({ artifactId: 'TST-BENCH-LOAD', type: 'TEST', name: 'Physical Bench Load Test' });

      // Link up to Test (MISSING EVIDENCE)
      engine.addEdge({ edgeId: 'E-R-DF', sourceId: 'R-CRITICAL-001', sourceType: 'REQUIREMENT', targetId: 'DF-WING-SPAR', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
      engine.addEdge({ edgeId: 'E-DF-AN', sourceId: 'DF-WING-SPAR', sourceType: 'DESIGN_FEATURE', targetId: 'AN-FEA-RUN-12', targetType: 'ANALYSIS', relationshipType: 'DESIGN_FEATURE_TO_ANALYSIS' });
      engine.addEdge({ edgeId: 'E-AN-TST', sourceId: 'AN-FEA-RUN-12', sourceType: 'ANALYSIS', targetId: 'TST-BENCH-LOAD', targetType: 'TEST', relationshipType: 'ANALYSIS_TO_TEST' });

      // Stage 1 Evaluation
      const stage1Trace = engine.getRequirementTrace('R-CRITICAL-001', critReqSpec);
      expect(stage1Trace.status).toBe('PARTIALLY_TRACEABLE');
      expect(stage1Trace.missingStages).toEqual(['EVIDENCE']);
      expect(stage1Trace.criticalGatePassed).toBe(false);

      // Add valid Evidence
      engine.addArtifact({ artifactId: 'EV-STRAIN-GAUGE-DATA', type: 'EVIDENCE', name: 'Calibrated Strain Gauge Log' });
      engine.addEdge({ edgeId: 'E-TST-EV', sourceId: 'TST-BENCH-LOAD', sourceType: 'TEST', targetId: 'EV-STRAIN-GAUGE-DATA', targetType: 'EVIDENCE', relationshipType: 'TEST_TO_EVIDENCE' });

      // Stage 2 Evaluation
      const stage2Trace = engine.getRequirementTrace('R-CRITICAL-001', critReqSpec);
      expect(stage2Trace.status).toBe('FULLY_TRACEABLE');
      expect(stage2Trace.missingStages).toEqual([]);
      expect(stage2Trace.criticalGatePassed).toBe(true);
    });
  });

  // EPC-003 Verifier Report
  it('passes automated EPC003Verifier with PASS verdict and evidence hash', () => {
    const report = EPC003Verifier.runVerification();
    expect(report.verdict).toBe('PASS');
    expect(report.evidenceHash).toBeDefined();
    expect(report.evidenceHash.length).toBe(64);
  });
});
