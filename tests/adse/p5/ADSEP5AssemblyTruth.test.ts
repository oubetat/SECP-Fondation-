/**
 * SECP — ADSE-P5 Assembly Truth Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP5StructuralEngine } from '../../../src/engine/adse/p5/ADSEP5StructuralEngine';

describe('ADSE-P5 Assembly Truth Suite', () => {
  let p5: ADSEP5StructuralEngine;

  beforeEach(() => {
    p5 = ADSEP5StructuralEngine.getInstance();
    p5.clear();
  });

  it('P5.ASSEMBLY: should construct full System -> Subsystem -> Assembly -> Component -> Part hierarchy', () => {
    const sys = p5.registry.registerElement({
      elementId: 'sys:STRUCTURAL_AIRFRAME',
      elementType: 'System',
      displayName: 'Aircraft Structural Airframe',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    const sub = p5.registry.registerElement({
      elementId: 'sub:WING_STRUCTURE',
      elementType: 'Subsystem',
      displayName: 'Main Wing Structural Subsystem',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-BASE'
    });

    const assy = p5.registry.registerElement({
      elementId: 'assy:def:WING_SPAR_ASSY',
      elementType: 'AssemblyDefinition',
      displayName: 'Main Wing Spar Assembly',
      layer: 'ASSEMBLY',
      configurationId: 'CONF-BASE'
    });

    const compDef = p5.registry.registerElement({
      elementId: 'comp:def:SPAR_CAP',
      elementType: 'ComponentDefinition',
      displayName: 'Upper Spar Cap Component Def',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const partDef = p5.registry.registerElement({
      elementId: 'part:def:WEB_STIFFENER',
      elementType: 'PartDefinition',
      displayName: 'Web Stiffener Part Def',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    // Decompose System -> Subsystem
    p5.decomposition.decompose({
      parentElementId: sys.elementId,
      childElementId: sub.elementId,
      configurationId: 'CONF-BASE'
    });

    // Subsystem -> Assembly
    p5.decomposition.decompose({
      parentElementId: sub.elementId,
      childElementId: assy.elementId,
      configurationId: 'CONF-BASE'
    });

    // Assembly -> Component
    p5.decomposition.decompose({
      parentElementId: assy.elementId,
      childElementId: compDef.elementId,
      configurationId: 'CONF-BASE'
    });

    // Component -> Part
    p5.decomposition.decompose({
      parentElementId: compDef.elementId,
      childElementId: partDef.elementId,
      configurationId: 'CONF-BASE'
    });

    // Get tree
    const tree = p5.decomposition.getDecompositionTree(sys.elementId);
    expect(tree.children.length).toBe(1);
    expect(tree.children[0].element.elementId).toBe(sub.elementId);
    expect(tree.children[0].children[0].element.elementId).toBe(assy.elementId);
  });

  it('P5.ASSEMBLY: should reject direct layer bypass (System directly containing Part)', () => {
    const sys = p5.registry.registerElement({
      elementId: 'sys:AIRCRAFT',
      elementType: 'System',
      displayName: 'Aircraft',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    const part = p5.registry.registerElement({
      elementId: 'part:def:RIVET',
      elementType: 'PartDefinition',
      displayName: 'Rivet Part',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    expect(() => {
      p5.decomposition.decompose({
        parentElementId: sys.elementId,
        childElementId: part.elementId,
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/DECOMPOSITION_RULE_VIOLATION/);
  });
});
