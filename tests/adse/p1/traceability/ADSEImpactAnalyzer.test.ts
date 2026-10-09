import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP1Engine } from '../../../../src/engine/adse/p1/ADSEP1Engine';

describe('ADSE-P1 Impact Analyzer Suite', () => {
  let p1: ADSEP1Engine;

  beforeEach(() => {
    p1 = ADSEP1Engine.getInstance();
    p1.clear();
  });

  it('analyzes the impact of a requirement change on the system model', () => {
    p1.systemModel.createSystem('S1', 'N', 'D', 'C', 'A');
    p1.requirements.createRequirement({ id: 'R1', systemId: 'S1', title: 'T', statement: 'S', rationale: 'R', source: 'S', type: 'FUNCTIONAL', priority: 'LOW', configurationId: 'C', verificationIntentIds: [], constraintIds: [] }, 'A');
    p1.systemModel.createFunction('S1', { id: 'F1', name: 'F', description: 'D', inputs: [], outputs: [] });
    p1.systemModel.createSubsystem('S1', { id: 'SUB1', name: 'S', description: 'D' });

    p1.traceability.addLink('R1', 'F1', 'PARENT_OF');
    p1.traceability.addLink('F1', 'SUB1', 'ALLOCATED_TO');

    const result = p1.impactAnalyzer.analyzeChangeImpact('R1');
    expect(result.rootCauseId).toBe('R1');
    expect(result.affectedEntities.find(e => e.id === 'F1')?.type).toBe('Function');
    expect(result.affectedEntities.find(e => e.id === 'SUB1')?.type).toBe('Subsystem');
  });
});
