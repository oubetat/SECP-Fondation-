import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { InMemoryDocumentResolver } from '../../engine/cad-kernel/document/DocumentResolver';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';

describe('PATCH-040 — Revision Authority Proof', () => {
  beforeEach(() => {
    EngineeringPLMEngine.clear();
  });

  it('CASE A: Assembly explicitly requests REV-A / rev 1, consumes REV-A (depth 10)', async () => {
    const partA_REV1: EngineeringDocument = {
      documentId: 'PART-A', revision: 1, type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{
        id: 'SK_A', name: 'S', plane: 'XY', closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 10, y: 10 }, { x: 0, y: 10 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 10 }, { x: 0, y: 0 }] }
        ]
      }],
      constraints: [],
      features: [{
        id: 'EXT_A', type: 'EXTRUDE', name: 'E',
        parameters: { depth: 10, profileId: 'SK_A' }, dependencyIds: []
      }],
      parameters: [], topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const resolver = new InMemoryDocumentResolver();
    resolver.register(partA_REV1);
    DocumentEvaluator.evaluate(partA_REV1, { context: { resolver } });

    // Register REV 2
    const partA_REV2: EngineeringDocument = JSON.parse(JSON.stringify(partA_REV1));
    partA_REV2.revision = 2;
    if (!partA_REV2.features || !partA_REV2.features[0] || !partA_REV2.features[0].parameters) {
      throw new Error("Features missing in partA_REV2");
    }
    partA_REV2.features[0].parameters.depth = 20;
    resolver.register(partA_REV2);
    DocumentEvaluator.evaluate(partA_REV2, { context: { resolver } });

    // Assembly explicitly asking for REV 1
    const assembly: EngineeringDocument = {
      documentId: 'ASM-CASE-A', revision: 1, type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [], constraints: [], features: [], parameters: [],
      assembly: {
        instances: [
          { instanceId: 'INST_A', documentId: 'PART-A', revision: 1, position: {x:0, y:0, z:0}, rotation: {x:0, y:0, z:0} }
        ],
        mates: []
      },
      topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const result = DocumentEvaluator.evaluate(assembly, { context: { resolver } });
    expect(result.success).toBe(true);
    if (!result.evaluatedAssembly?.components[0]) throw new Error("Component missing");
    const comp = result.evaluatedAssembly.components[0];
    expect(comp.revision).toBe('REV-A');
    expect(comp.solid.dimensions.dz).toBe(10);
  });

  it('CASE B: Assembly explicitly requests REV-B / rev 2, consumes REV-B (depth 20)', async () => {
    const partA_REV1: EngineeringDocument = {
      documentId: 'PART-B-TEST', revision: 1, type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{
        id: 'SK_B1', name: 'S', plane: 'XY', closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 10, y: 10 }, { x: 0, y: 10 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 10 }, { x: 0, y: 0 }] }
        ]
      }],
      constraints: [],
      features: [{
        id: 'EXT_B1', type: 'EXTRUDE', name: 'E',
        parameters: { depth: 10, profileId: 'SK_B1' }, dependencyIds: []
      }],
      parameters: [], topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const resolver = new InMemoryDocumentResolver();
    resolver.register(partA_REV1);
    DocumentEvaluator.evaluate(partA_REV1, { context: { resolver } });

    const partA_REV2: EngineeringDocument = JSON.parse(JSON.stringify(partA_REV1));
    partA_REV2.revision = 2;
    if (!partA_REV2.features || !partA_REV2.features[0] || !partA_REV2.features[0].parameters) {
      throw new Error("Features missing in Case B partA_REV2");
    }
    partA_REV2.features[0].parameters.depth = 20;
    resolver.register(partA_REV2);
    DocumentEvaluator.evaluate(partA_REV2, { context: { resolver } });

    // Assembly explicitly asking for REV 2
    const assembly: EngineeringDocument = {
      documentId: 'ASM-CASE-B', revision: 1, type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [], constraints: [], features: [], parameters: [],
      assembly: {
        instances: [
          { instanceId: 'INST_B', documentId: 'PART-B-TEST', revision: 2, position: {x:0, y:0, z:0}, rotation: {x:0, y:0, z:0} }
        ],
        mates: []
      },
      topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const result = DocumentEvaluator.evaluate(assembly, { context: { resolver } });
    expect(result.success).toBe(true);
    const comp = result.evaluatedAssembly!.components[0];
    expect(comp.revision).toBe('REV-B');
    expect(comp.solid.dimensions.dz).toBe(20);
  });

  it('CASE C: Assembly requests nonexistent revision, MUST fail deterministically and NOT silently consume latest', async () => {
    const partA_REV1: EngineeringDocument = {
      documentId: 'PART-C-TEST', revision: 1, type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{
        id: 'SK_C1', name: 'S', plane: 'XY', closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 10, y: 10 }, { x: 0, y: 10 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 10 }, { x: 0, y: 0 }] }
        ]
      }],
      constraints: [],
      features: [{
        id: 'EXT_C1', type: 'EXTRUDE', name: 'E',
        parameters: { depth: 10, profileId: 'SK_C1' }, dependencyIds: []
      }],
      parameters: [], topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const resolver = new InMemoryDocumentResolver();
    resolver.register(partA_REV1);
    DocumentEvaluator.evaluate(partA_REV1, { context: { resolver } });

    const partA_REV2: EngineeringDocument = JSON.parse(JSON.stringify(partA_REV1));
    partA_REV2.revision = 2;
    if (!partA_REV2.features || !partA_REV2.features[0] || !partA_REV2.features[0].parameters) {
      throw new Error("Features missing in Case C partA_REV2");
    }
    partA_REV2.features[0].parameters.depth = 20;
    resolver.register(partA_REV2);
    DocumentEvaluator.evaluate(partA_REV2, { context: { resolver } });

    // Assembly asking for nonexistent REV 99
    const assembly: EngineeringDocument = {
      documentId: 'ASM-CASE-C', revision: 1, type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [], constraints: [], features: [], parameters: [],
      assembly: {
        instances: [
          { instanceId: 'INST_MISSING_REV', documentId: 'PART-C-TEST', revision: 99, position: {x:0, y:0, z:0}, rotation: {x:0, y:0, z:0} }
        ],
        mates: []
      },
      topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const result = DocumentEvaluator.evaluate(assembly, { context: { resolver } });
    // Must NOT succeed
    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.includes('[SECP_DOC_MISSING]') && d.includes('requested revision: 99'))).toBe(true);
    if (!result.evaluatedAssembly?.components[0]) throw new Error("Component missing");
    const comp = result.evaluatedAssembly.components[0];
    expect(comp.resolutionStatus).toBe('MISSING');
    expect(comp.solid).toBeUndefined();
  });

  it('CASE D: Assembly omits revision, canonical policy resolves to latest registered revision', async () => {
    const partA_REV1: EngineeringDocument = {
      documentId: 'PART-D-TEST', revision: 1, type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{
        id: 'SK_D1', name: 'S', plane: 'XY', closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 10, y: 10 }, { x: 0, y: 10 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 10 }, { x: 0, y: 0 }] }
        ]
      }],
      constraints: [],
      features: [{
        id: 'EXT_D1', type: 'EXTRUDE', name: 'E',
        parameters: { depth: 10, profileId: 'SK_D1' }, dependencyIds: []
      }],
      parameters: [], topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const resolver = new InMemoryDocumentResolver();
    resolver.register(partA_REV1);
    DocumentEvaluator.evaluate(partA_REV1, { context: { resolver } });

    const partA_REV2: EngineeringDocument = JSON.parse(JSON.stringify(partA_REV1));
    partA_REV2.revision = 2;
    if (!partA_REV2.features || !partA_REV2.features[0] || !partA_REV2.features[0].parameters) {
      throw new Error("Features missing in Case D partA_REV2");
    }
    partA_REV2.features[0].parameters.depth = 20;
    resolver.register(partA_REV2);
    DocumentEvaluator.evaluate(partA_REV2, { context: { resolver } });

    // Assembly omitting revision (floating reference)
    const assembly: EngineeringDocument = {
      documentId: 'ASM-CASE-D', revision: 1, type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [], constraints: [], features: [], parameters: [],
      assembly: {
        instances: [
          { instanceId: 'INST_FLOATING', documentId: 'PART-D-TEST', position: {x:0, y:0, z:0}, rotation: {x:0, y:0, z:0} }
        ],
        mates: []
      },
      topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const result = DocumentEvaluator.evaluate(assembly, { context: { resolver } });
    expect(result.success).toBe(true);
    if (!result.evaluatedAssembly?.components[0]) throw new Error("Component missing");
    const comp = result.evaluatedAssembly.components[0];
    expect(comp.revision).toBe('REV-B');
    expect(comp.solid.dimensions.dz).toBe(20);
  });
});
