import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { InMemoryDocumentResolver } from '../../engine/cad-kernel/document/DocumentResolver';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { TopologyLineageProofEngine } from '../../engine/topology/TopologyLineageProofEngine';
import { Solid } from '../../engine/cad-kernel/topology/TopologyContracts';

describe('PATCH-040 — Hierarchical Assembly, PLM Projection & Invalidation', () => {
  beforeEach(() => {
    EngineeringPLMEngine.clear();
  });

  it('Phase 2-6: Hierarchical evaluation and invalidation', async () => {
    // 1. Create Parts
    const partA: EngineeringDocument = {
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

    const partB: EngineeringDocument = {
      documentId: 'PART-B', revision: 1, type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{
        id: 'SK_B', name: 'S', plane: 'XY', closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 10, y: 10 }, { x: 0, y: 10 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 10 }, { x: 0, y: 0 }] }
        ]
      }],
      constraints: [],
      features: [{
        id: 'EXT_B', type: 'EXTRUDE', name: 'E',
        parameters: { depth: 20, profileId: 'SK_B' }, dependencyIds: []
      }],
      parameters: [], topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const partC: EngineeringDocument = {
      documentId: 'PART-C', revision: 1, type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{
        id: 'SK_C', name: 'S', plane: 'XY', closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 10, y: 10 }, { x: 0, y: 10 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 10 }, { x: 0, y: 0 }] }
        ]
      }],
      constraints: [],
      features: [{
        id: 'EXT_C', type: 'EXTRUDE', name: 'E',
        parameters: { depth: 30, profileId: 'SK_C' }, dependencyIds: []
      }],
      parameters: [], topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const subAssembly: EngineeringDocument = {
      documentId: 'SUB-ASM', revision: 1, type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [], constraints: [], features: [], parameters: [],
      assembly: {
        instances: [
          { instanceId: 'INST_A', documentId: 'PART-A', position: {x:0, y:0, z:0}, rotation: {x:0, y:0, z:0} },
          { instanceId: 'INST_B', documentId: 'PART-B', position: {x:20, y:0, z:0}, rotation: {x:0, y:0, z:0} }
        ],
        mates: []
      },
      topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const rootAssembly: EngineeringDocument = {
      documentId: 'ROOT-ASM', revision: 1, type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [], constraints: [], features: [], parameters: [],
      assembly: {
        instances: [
          { instanceId: 'INST_SUB', documentId: 'SUB-ASM', position: {x:0, y:0, z:0}, rotation: {x:0, y:0, z:0} },
          { instanceId: 'INST_C', documentId: 'PART-C', position: {x:0, y:20, z:0}, rotation: {x:0, y:0, z:0} }
        ],
        mates: []
      },
      topologyMap: { version: 1 }, derived: {}, evidence: []
    };

    const resolver = new InMemoryDocumentResolver([partA, partB, partC, subAssembly, rootAssembly]);

    // Evaluate child parts
    DocumentEvaluator.evaluate(partA, { context: { resolver } });
    DocumentEvaluator.evaluate(partB, { context: { resolver } });
    DocumentEvaluator.evaluate(partC, { context: { resolver } });

    // Evaluate root (which evaluates subassembly)
    const resultRoot = DocumentEvaluator.evaluate(rootAssembly, { context: { resolver } });
    expect(resultRoot.success).toBe(true);

    // Verify PLM registration
    const artRoot = EngineeringPLMEngine.getArtifact('ART-ROOT-ASM', 'REV-A');
    expect(artRoot?.status).toBe('VALID');

    const artSub = EngineeringPLMEngine.getArtifact('ART-SUB-ASM', 'REV-A');
    expect(artSub?.status).toBe('VALID');

    // Dependencies
    const dependentsA = EngineeringPLMEngine.getDependents('ART-PART-A', 'REV-A');
    expect(dependentsA).toContain('ART-SUB-ASM@REV-A');

    const dependentsSub = EngineeringPLMEngine.getDependents('ART-SUB-ASM', 'REV-A');
    expect(dependentsSub).toContain('ART-ROOT-ASM@REV-A');

    // Mutate Part A
    partA.revision = 2;
    if (!partA.features || !partA.features[0] || !partA.features[0].parameters) {
      throw new Error("Part A features missing");
    }
    partA.features[0].parameters.depth = 15;
    DocumentEvaluator.evaluate(partA, { context: { resolver } });

    // Verify cascade
    const artSubAfter = EngineeringPLMEngine.getArtifact('ART-SUB-ASM', 'REV-A');
    expect(artSubAfter?.status).toBe('OUTDATED');
    
    const artRootAfter = EngineeringPLMEngine.getArtifact('ART-ROOT-ASM', 'REV-A');
    expect(artRootAfter?.status).toBe('OUTDATED');
  });
});
