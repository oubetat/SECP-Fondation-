import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../engine/plm/CanonicalPLMProjectionAdapter';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';

describe('P6-010 — CROSS-DOMAIN EVIDENCE', () => {
  beforeEach(() => {
    EngineeringPLMEngine.clear();
    EvidenceIntegrityEngine.clearRegistry();
  });

  it('P6-010-A — Full Cross-Domain Workflow (CAD -> PLM Downstream)', () => {
    // 1. CAD
    const docCAD: EngineeringDocument = {
      documentId: 'P6-CROSS-CAD',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{
        id: 'SK_1', name: 'SK_1', plane: 'XY', closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 50, y: 0 }, { x: 50, y: 50 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 50, y: 50 }, { x: 0, y: 50 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 50 }, { x: 0, y: 0 }] }
        ]
      }],
      constraints: [],
      features: [{ id: 'EXT_1', featureId: 'EXT_1', type: 'EXTRUDE', name: 'E1', parameters: { depth: 10, profileId: 'SK_1' }, dependencyIds: [] }],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalCAD = DocumentEvaluator.evaluate(docCAD);
    const artCAD = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalCAD);
    EngineeringPLMEngine.registerArtifact(artCAD);
    expect(artCAD.status).toBe('VALID');

    // 2. ASSEMBLY
    const artAsm = {
      artifactId: 'ART-ASM-1', documentId: 'ASM-1', revision: 'REV-A', version: 1, type: 'ASSEMBLY' as const, status: 'VALID' as const,
      geometryHash: 'GEO-ASM', topologyHash: 'TOP-ASM', dependencyHash: artCAD.geometryHash, provenanceReference: 'EVID-ASM', childDependencies: [artCAD.artifactId]
    };
    EngineeringPLMEngine.registerArtifact(artAsm);
    EngineeringPLMEngine.addDependency(artAsm.artifactId, 'REV-A', artCAD.artifactId, 'REV-A');

    // 3. FEM
    const artFEM = {
      artifactId: 'ART-FEM-1', documentId: 'FEM-1', revision: 'REV-A', version: 1, type: 'SIMULATION_FEM' as const, status: 'VALID' as const,
      geometryHash: 'GEO-FEM', topologyHash: 'TOP-FEM', dependencyHash: artAsm.geometryHash, provenanceReference: 'EVID-FEM', childDependencies: [artAsm.artifactId]
    };
    EngineeringPLMEngine.registerArtifact(artFEM);
    EngineeringPLMEngine.addDependency(artFEM.artifactId, 'REV-A', artAsm.artifactId, 'REV-A');

    // 4. CFD
    const artCFD = {
      artifactId: 'ART-CFD-1', documentId: 'CFD-1', revision: 'REV-A', version: 1, type: 'SIMULATION_CFD' as const, status: 'VALID' as const,
      geometryHash: 'GEO-CFD', topologyHash: 'TOP-CFD', dependencyHash: artAsm.geometryHash, provenanceReference: 'EVID-CFD', childDependencies: [artAsm.artifactId]
    };
    EngineeringPLMEngine.registerArtifact(artCFD);
    EngineeringPLMEngine.addDependency(artCFD.artifactId, 'REV-A', artAsm.artifactId, 'REV-A');

    // 5. CAM
    const artCAM = {
      artifactId: 'ART-CAM-1', documentId: 'CAM-1', revision: 'REV-A', version: 1, type: 'CAM_TOOLPATH' as const, status: 'VALID' as const,
      geometryHash: 'GEO-CAM', topologyHash: 'TOP-CAM', dependencyHash: artCAD.geometryHash, provenanceReference: 'EVID-CAM', childDependencies: [artCAD.artifactId]
    };
    EngineeringPLMEngine.registerArtifact(artCAM);
    EngineeringPLMEngine.addDependency(artCAM.artifactId, 'REV-A', artCAD.artifactId, 'REV-A');

    // Check upstream relations resolve
    const depsOfFEM = EngineeringPLMEngine.getDependencies(artFEM.artifactId, 'REV-A');
    expect(depsOfFEM).toContain(artAsm.artifactId + '@REV-A');

    // Mutate CAD Source -> triggers downstream invalidation to all
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 20;
    const evalCAD_2 = DocumentEvaluator.evaluate(docCAD);
    const artCAD_2 = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalCAD_2);
    EngineeringPLMEngine.registerArtifact(artCAD_2);

    expect(EngineeringPLMEngine.getArtifact(artAsm.artifactId, 'REV-A')?.status).toBe('OUTDATED');
    expect(EngineeringPLMEngine.getArtifact(artFEM.artifactId, 'REV-A')?.status).toBe('OUTDATED');
    expect(EngineeringPLMEngine.getArtifact(artCFD.artifactId, 'REV-A')?.status).toBe('OUTDATED');
    expect(EngineeringPLMEngine.getArtifact(artCAM.artifactId, 'REV-A')?.status).toBe('OUTDATED');
  });
});
