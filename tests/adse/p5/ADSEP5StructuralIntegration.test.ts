/**
 * SECP — ADSE-P5 Structural Integration Core Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP5StructuralEngine } from '../../../src/engine/adse/p5/ADSEP5StructuralEngine';

describe('ADSE-P5 Structural Integration Suite', () => {
  let p5: ADSEP5StructuralEngine;

  beforeEach(() => {
    p5 = ADSEP5StructuralEngine.getInstance();
    p5.clear();
  });

  it('P5.1: should register definitions, instances, and establish upstream P1-P4 lineage', () => {
    // 1. Definition
    const partDef = p5.registry.registerElement({
      elementId: 'part:def:TITANIUM_BOLT_M8',
      elementType: 'PartDefinition',
      displayName: 'Titanium M8 Bolt Definition',
      layer: 'PART',
      configurationId: 'CONF-BASE',
      p1ReqId: 'REQ-FASTENER-01',
      p2MbseId: 'mbse:block:FASTENER',
      p3ArchId: 'arch:comp:FASTENER_ARRAY',
      p4NodeId: 'node:arch:FASTENER'
    });

    expect(partDef.elementType).toBe('PartDefinition');
    expect(partDef.p1ReqId).toBe('REQ-FASTENER-01');

    // 2. Instance referencing Definition
    const partInst1 = p5.registry.registerElement({
      elementId: 'part:inst:TITANIUM_BOLT_M8_001',
      elementType: 'PartInstance',
      displayName: 'Titanium M8 Bolt Instance #1',
      layer: 'PART',
      definitionId: partDef.elementId,
      configurationId: 'CONF-BASE'
    });

    expect(partInst1.definitionId).toBe('part:def:TITANIUM_BOLT_M8');
    expect(partInst1.provenanceId).toContain('PROV-STRUCT-');
  });

  it('P5.2: should manage spatial placement and canonical transforms', () => {
    const compDef = p5.registry.registerElement({
      elementId: 'comp:def:SERVO_ACTUATOR',
      elementType: 'ComponentDefinition',
      displayName: 'Servo Actuator Def',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const compInst = p5.registry.registerElement({
      elementId: 'comp:inst:SERVO_ACTUATOR_LEFT',
      elementType: 'ComponentInstance',
      displayName: 'Left Elevon Servo Actuator Instance',
      layer: 'COMPONENT',
      definitionId: compDef.elementId,
      configurationId: 'CONF-BASE'
    });

    const placement = p5.placements.setPlacement({
      instanceId: compInst.elementId,
      translation: { x: 12.5, y: -3.2, z: 0.8 },
      rotation: { rx: 0, ry: 15, rz: 0 },
      coordinateFrame: 'WING_LOCAL_FRAME',
      referenceFrameId: 'WING_ROOT_ORIGIN',
      configurationId: 'CONF-BASE',
      isCanonical: true
    });

    expect(placement.transform.translation.x).toBe(12.5);
    expect(placement.transform.isCanonical).toBe(true);
    expect(placement.provenanceId).toContain('PROV-TRANSFORM-');
  });
});
