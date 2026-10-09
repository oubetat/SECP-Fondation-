import { describe, it, expect } from 'vitest';
import { BRepEulerOps } from '../BRepEulerOps';
import { IndependentBRepValidator } from '../IndependentBRepValidator';
import { CanonicalBRepFixtures } from '../CanonicalBRepFixtures';
import { BRepSolid, BRepShell, BRepFace, BRepLoop, BRepEdge, BRepVertex } from '../../topology/BRepTopology';
import { BRepPoint } from '../../geometry/BRepGeometry';
import { Orientation } from '../../topology/TopologyContracts';

describe('B-Rep Forensic Closure — Independent Validation & Adversarial Testing', () => {
  it('VALIDATION: Independent validator should prove canonical cube is a closed 2-manifold with Chi=2', () => {
    const cube = CanonicalBRepFixtures.createCube();
    const audit = IndependentBRepValidator.audit(cube);

    expect(audit.isValid).toBe(true, `Audit failed: ${audit.errors.join(', ')}`);
    expect(audit.topology.eulerCharacteristic).toBe(2);
    expect(audit.checks.isClosed).toBe(true);
    expect(audit.checks.isManifold).toBe(true);
    expect(audit.checks.hasConsistentHalfEdges).toBe(true);
  });

  it('ADVERSARIAL: Should fail gracefully with invalid fillet parameters', () => {
    const cube = CanonicalBRepFixtures.createCube();
    
    const resNeg = BRepEulerOps.executeTopologicalFillet(cube, 'e01', -1.0);
    expect(resNeg.success).toBe(false);
    expect(resNeg.diagnostics[0]).toContain('Radius must be positive');

    const resNonexistent = BRepEulerOps.executeTopologicalFillet(cube, 'e_ghost', 1.0);
    expect(resNonexistent.success).toBe(false);
    expect(resNonexistent.diagnostics[0]).toContain('shared by exactly 2 faces');
  });

  it('CLOSURE: Filleted solid should be independently validated as 2-manifold with Chi=2', () => {
    const cube = CanonicalBRepFixtures.createCube();
    const filletResult = BRepEulerOps.executeTopologicalFillet(cube, 'e01', 1.0);
    
    expect(filletResult.success).toBe(true, `Fillet execution failed: ${filletResult.diagnostics.join(', ')}`);
    const audit = IndependentBRepValidator.audit(filletResult.solid!);
    if (!audit.isValid) {
      console.log('AUDIT ERRORS:', audit.errors);
    }
    
    expect(audit.isValid).toBe(true, `Forensic Audit failed on filleted solid: ${audit.errors.join(' | ')}`);
    expect(audit.topology.eulerCharacteristic).toBe(2);
  });

  it('MUTATION: Should detect kinking/discontinuity in half-edge loops', () => {
    const cube = CanonicalBRepFixtures.createCube();
    const fBot = cube.outerShell.orientedFaces[0].face as BRepFace;
    const vGhost = new BRepVertex('vGhost', new BRepPoint(99, 99, 99));
    const badEdge = new BRepEdge('eBad', fBot.outerLoop.orientedEdges[0].edge.geometry, fBot.outerLoop.orientedEdges[0].edge.startVertex, vGhost);
    
    const badOes = [...fBot.outerLoop.orientedEdges];
    badOes[0] = { edge: badEdge, orientation: Orientation.FORWARD };
    const badLoop = new BRepLoop('badLoop', badOes);
    const badFace = new BRepFace('badFace', fBot.geometry, badLoop, []);
    
    const mutatedFaces = [...cube.outerShell.orientedFaces];
    mutatedFaces[0] = { face: badFace, orientation: Orientation.FORWARD };
    const mutatedSolid = new BRepSolid('mutated', new BRepShell('mutatedShell', mutatedFaces), []);

    const audit = IndependentBRepValidator.audit(mutatedSolid);
    expect(audit.isValid).toBe(false);
    expect(audit.checks.hasConsistentHalfEdges).toBe(false);
    expect(audit.errors.some(e => e.includes('Discontinuity'))).toBe(true);
  });
});
