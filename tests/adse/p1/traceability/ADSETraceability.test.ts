import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP1Engine } from '../../../../src/engine/adse/p1/ADSEP1Engine';

describe('ADSE-P1 Traceability Suite', () => {
  let p1: ADSEP1Engine;

  beforeEach(() => {
    p1 = ADSEP1Engine.getInstance();
    p1.clear();
  });

  it('maintains bidirectional traceability between requirements and system entities', () => {
    p1.requirements.createRequirement({ id: 'R1', systemId: 'S1', title: 'T', statement: 'S', rationale: 'R', source: 'S', type: 'FUNCTIONAL', priority: 'LOW', configurationId: 'C', verificationIntentIds: [], constraintIds: [] }, 'A');
    p1.systemModel.createSystem('S1', 'N', 'D', 'C', 'A');
    p1.systemModel.createFunction('S1', { id: 'F1', name: 'F', description: 'D', inputs: [], outputs: [] });

    p1.traceability.addLink('F1', 'R1', 'IMPLEMENTS');

    const forward = p1.traceability.getForwardTrace('F1');
    expect(forward[0].targetId).toBe('R1');
    expect(forward[0].relationship).toBe('IMPLEMENTS');

    const backward = p1.traceability.getBackwardTrace('R1');
    expect(backward[0].sourceId).toBe('F1');
  });

  it('performs recursive impact tracing for requirement changes', () => {
    // R1 -> F1 -> SUB1 -> COMP1
    p1.traceability.addLink('R1', 'F1', 'PARENT_OF');
    p1.traceability.addLink('F1', 'SUB1', 'ALLOCATED_TO');
    p1.traceability.addLink('SUB1', 'COMP1', 'PARENT_OF');

    const impact = p1.traceability.getImpactTrace('R1');
    expect(impact).toContain('F1');
    expect(impact).toContain('SUB1');
    expect(impact).toContain('COMP1');
    expect(impact.length).toBe(3);
  });
});
