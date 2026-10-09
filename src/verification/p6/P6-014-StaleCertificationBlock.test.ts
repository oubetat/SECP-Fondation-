import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../engine/plm/CanonicalPLMProjectionAdapter';
import { EngineeringChangeOrder } from '../../engine/plm/PLMTypes';

describe('P6-014 — STALE CERTIFICATION BLOCK', () => {
  beforeEach(() => {
    EngineeringPLMEngine.clear();
  });

  it('P6-014-A — Stale artifact blocks release in PLM production gate', () => {
    // 1. Setup CAD
    const docCAD: EngineeringDocument = {
      documentId: 'P6-014-CAD', revision: 1, type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{
        id: 'SK_1', name: 'S', plane: 'XY', closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 10, y: 10 }, { x: 0, y: 10 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 10 }, { x: 0, y: 0 }] }
        ]
      }],
      constraints: [],
      features: [{
        id: 'EXT_1', type: 'EXTRUDE', name: 'E',
        parameters: { depth: 10, profileId: 'SK_1' }, dependencyIds: []
      }],
      parameters: [], topologyMap: { version: 1 }, derived: {}, evidence: []
    };
    const evalCAD = DocumentEvaluator.evaluate(docCAD);
    const artCAD = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalCAD);
    EngineeringPLMEngine.registerArtifact(artCAD);

    // 2. Setup Assembly
    const artAsm = {
      artifactId: 'ART-ASM-1', documentId: 'ASM-1', revision: 'REV-A', version: 1, type: 'ASSEMBLY' as const, status: 'VALID' as const,
      geometryHash: 'GEO-ASM', topologyHash: 'TOP-ASM', dependencyHash: artCAD.geometryHash, childDependencies: [artCAD.artifactId], createdBy: 'SYS', createdAt: '', metadata: {}
    };
    EngineeringPLMEngine.registerArtifact(artAsm);
    EngineeringPLMEngine.addDependency(artAsm.artifactId, 'REV-A', artCAD.artifactId, 'REV-A');

    // 3. Setup BOM
    const artBom = {
      artifactId: 'ART-BOM-1', documentId: 'BOM-1', revision: 'REV-A', version: 1, type: 'BOM' as const, status: 'VALID' as const,
      geometryHash: 'GEO-BOM', topologyHash: 'TOP-BOM', dependencyHash: artAsm.geometryHash, childDependencies: [artAsm.artifactId], createdBy: 'SYS', createdAt: '', metadata: {}
    };
    EngineeringPLMEngine.registerArtifact(artBom);
    EngineeringPLMEngine.addDependency(artBom.artifactId, 'REV-A', artAsm.artifactId, 'REV-A');

    // 4. Create and Approve ECO
    const eco: EngineeringChangeOrder = {
      ecoId: 'ECO-100', title: 'Release V1', description: 'Initial Release', reason: 'N/A', author: 'Eng', createdAt: '',
      status: 'OPEN', affectedArtifacts: [artCAD.artifactId, artAsm.artifactId, artBom.artifactId], changeRequests: [],
      validationGates: [], approvalStatus: 'PENDING'
    };
    EngineeringPLMEngine.createECO(eco);
    EngineeringPLMEngine.approveECO('ECO-100', 'Manager');

    // Validate we can release initially
    expect(() => EngineeringPLMEngine.generateReleaseManifest('PRD-1', 'Product', 'ECO-100')).not.toThrow();

    // 5. Mutate CAD -> Invalidates downstream Assembly & BOM
    docCAD.revision = 2;
    const evalCAD_2 = DocumentEvaluator.evaluate(docCAD);
    const artCAD_2 = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalCAD_2);
    EngineeringPLMEngine.registerArtifact(artCAD_2);

    expect(EngineeringPLMEngine.getArtifact(artAsm.artifactId, 'REV-A')?.status).toBe('OUTDATED');

    // 6. Attempt Release -> Must throw due to missing valid downstream artifacts
    expect(() => EngineeringPLMEngine.generateReleaseManifest('PRD-1', 'Product', 'ECO-100'))
      .toThrow('Release Blocked: Missing valid ASSEMBLY artifact.');
  });
});
