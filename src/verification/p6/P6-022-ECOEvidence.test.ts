import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { EngineeringChangeOrder } from '../../engine/plm/PLMTypes';

describe('P6-022 — ECO (ENGINEERING CHANGE ORDER) EVIDENCE', () => {
  beforeEach(() => {
    EngineeringPLMEngine.clear();
  });

  it('P6-022-A — ECO impact analysis correctly cascades', () => {
    // Register artifacts
    EngineeringPLMEngine.registerArtifact({
      artifactId: 'ART-CAD', documentId: 'CAD-1', revision: 'REV-A', version: 1, type: 'CAD_GEOMETRY', status: 'VALID',
      geometryHash: 'G1', dependencyHash: 'D1', childDependencies: [], createdBy: 'SYS', createdAt: '', metadata: {}
    });
    EngineeringPLMEngine.registerArtifact({
      artifactId: 'ART-ASM', documentId: 'ASM-1', revision: 'REV-A', version: 1, type: 'ASSEMBLY', status: 'VALID',
      geometryHash: 'G2', dependencyHash: 'G1', childDependencies: ['ART-CAD'], createdBy: 'SYS', createdAt: '', metadata: {}
    });
    EngineeringPLMEngine.addDependency('ART-ASM', 'REV-A', 'ART-CAD', 'REV-A');

    const eco: EngineeringChangeOrder = {
      ecoId: 'ECO-22', title: 'Test', description: '', reason: '', author: 'Eng', createdAt: '', status: 'OPEN',
      affectedArtifacts: ['ART-CAD'], changeRequests: [{ requestId: 'REQ-1', ecoId: 'ECO-22', artifactId: 'ART-CAD', changeType: 'MODIFY', description: '', reason: '' }],
      validationGates: [], approvalStatus: 'PENDING'
    };
    EngineeringPLMEngine.createECO(eco);

    const impact = EngineeringPLMEngine.analyzeImpact('ECO-22');
    expect(impact.length).toBe(1);
    expect(impact[0].isInvalidationRequired).toBe(true);
    expect(impact[0].affectedDownstreamArtifacts.some(a => a.artifactId === 'ART-ASM')).toBe(true);
  });
});
