import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP2Engine } from '../../../../src/engine/adse/p2/ADSEP2Engine';

describe('ADSE-P2 MBSE Consistency Audit Engine', () => {
  let p2: ADSEP2Engine;

  beforeEach(() => {
    p2 = ADSEP2Engine.getInstance();
    p2.clear();
  });

  it('detects unallocated functions, unconnected flow ports, unbound parameters, unsatisfied requirements', () => {
    // 1. Unallocated function
    p2.registry.registerElement({
      mbseId: 'mbse:fn:UNALLOCATED_FN_01',
      elementType: 'Function',
      displayName: 'Orphaned Function without Allocation',
      category: 'BEHAVIORAL',
      configurationId: 'CFG-001'
    });

    // 2. Unconnected flow port
    const comp = p2.registry.registerElement({
      mbseId: 'mbse:comp:ISOLATED_COMP',
      elementType: 'Component',
      displayName: 'Isolated Component',
      category: 'STRUCTURAL',
      configurationId: 'CFG-001'
    });

    p2.flow.registerFlowPort({
      mbseId: 'mbse:port:ISOLATED_PORT',
      name: 'FloatingPort',
      direction: 'IN',
      ownerMbseId: comp.mbseId,
      configurationId: 'CFG-001'
    });

    // 3. Unbound constraint parameter
    p2.parametric.registerConstraintBlock({
      mbseId: 'mbse:cb:UNBOUND_CB',
      name: 'UnboundConstraintBlock',
      expression: 'power > 100',
      parameters: [{ name: 'power', unit: 'W' }], // no valuePropertyMbseId
      configurationId: 'CFG-001'
    });

    // 4. Unsatisfied requirement
    p2.registry.registerElement({
      mbseId: 'mbse:req:ORPHAN_REQ',
      elementType: 'Requirement',
      displayName: 'Unsatisfied Safety Goal',
      category: 'REQUIREMENT',
      configurationId: 'CFG-001'
    });

    const audit = p2.auditor.auditSystemConsistency('CFG-001', 'REV-001');

    expect(audit.isConsistent).toBe(false);
    expect(audit.totalFindings).toBeGreaterThanOrEqual(4);

    const ruleCodes = audit.findings.map(f => f.ruleCode);
    expect(ruleCodes).toContain('UNALLOCATED_FUNCTION');
    expect(ruleCodes).toContain('UNCONNECTED_FLOW_PORT');
    expect(ruleCodes).toContain('UNBOUND_CONSTRAINT_PARAMETER');
    expect(ruleCodes).toContain('UNSATISFIED_REQUIREMENT');
  });
});
