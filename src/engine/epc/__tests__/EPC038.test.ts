import { describe, it, expect } from 'vitest';
import { RobotParametricLinkEngine } from '../robot/RobotParametricLinkEngine';
import { RobotParameterValidator } from '../robot/RobotParameterValidator';
import { EPC038Verifier } from '../robot/EPC038Verifier';

describe('EPC-038: Industrial Robotic Arm Parametric Links Program', () => {
  it('1. Parameter creation & strong typing', () => {
    const engine = new RobotParametricLinkEngine('TEST-ROBOT');
    const config = engine.getConfig();

    expect(typeof config.geometry.link1Length).toBe('number');
    expect(typeof config.geometry.link2Length).toBe('number');
    expect(typeof config.mechanical.payloadCapacity).toBe('number');
    expect(typeof config.materials.link1Material).toBe('string');
    expect(config.geometry.link1Length).toBeGreaterThan(0);
  });

  it('2. Unit & Range validation', () => {
    const validConfig = RobotParametricLinkEngine.DEFAULT_CONFIG;
    const reportVal = RobotParameterValidator.validateConfig(validConfig);
    expect(reportVal.valid).toBe(true);

    const invalidConfig = JSON.parse(JSON.stringify(validConfig));
    invalidConfig.geometry.link1Length = -50; // invalid negative length
    const reportInvalid = RobotParameterValidator.validateConfig(invalidConfig);
    expect(reportInvalid.valid).toBe(false);
    expect(reportInvalid.issues.some(i => i.parameterId === 'Link1Length')).toBe(true);
  });

  it('3. Cross-parameter constraint validation', () => {
    const invalidConfig = JSON.parse(JSON.stringify(RobotParametricLinkEngine.DEFAULT_CONFIG));
    invalidConfig.mechanical.payloadCapacity = 50; // Exceeds MaximumPayload limit of 20kg
    const report = RobotParameterValidator.validateConfig(invalidConfig);
    expect(report.valid).toBe(false);
    expect(report.issues.some(i => i.parameterId === 'PayloadCapacity')).toBe(true);
  });

  it('4. Parameter-to-feature & CAD Part linking in dependency DAG', () => {
    const engine = new RobotParametricLinkEngine('TEST-ROBOT');
    const snapshot = engine.getDependencyGraphSnapshot();

    expect(snapshot.nodes.some(n => n.id === 'Link1Length' && n.type === 'PARAMETER')).toBe(true);
    expect(snapshot.nodes.some(n => n.id === 'FEAT-LINK1-REVOLVE' && n.type === 'FEATURE')).toBe(true);
    expect(snapshot.nodes.some(n => n.id === 'PART-ROB-LINK1-01' && n.type === 'GEOMETRY')).toBe(true);

    // Verify DRIVES and PRODUCES edges
    expect(snapshot.edges.some(e => e.from === 'Link1Length' && e.to === 'FEAT-LINK1-REVOLVE' && e.type === 'DRIVES')).toBe(true);
    expect(snapshot.edges.some(e => e.from === 'FEAT-LINK1-REVOLVE' && e.to === 'PART-ROB-LINK1-01' && e.type === 'PRODUCES')).toBe(true);
  });

  it('5. Single parameter change & dependency propagation', () => {
    const engine = new RobotParametricLinkEngine('TEST-ROBOT');
    const initialReach = engine.applyConfigChanges(engine.getConfig()).derived.reachMm;

    const res = engine.updateParameter('Link2Length', 750);
    expect(res.derived.reachMm).toBeGreaterThan(initialReach);
    expect(res.derived.reachMm).toBe(350 + 750 + 500 + 120); // 1720 mm
  });

  it('6. Dynamic geometry B-Rep regeneration without hardcoding', () => {
    const engine = new RobotParametricLinkEngine('TEST-ROBOT');
    const res1 = engine.applyConfigChanges(engine.getConfig());
    const vol1 = res1.parts.find(p => p.id === 'PART-ROB-LINK2-01')?.solids[0].volume;

    const res2 = engine.updateParameter('Link2Length', 800);
    const vol2 = res2.parts.find(p => p.id === 'PART-ROB-LINK2-01')?.solids[0].volume;

    expect(vol2!).toBeGreaterThan(vol1!);
  });

  it('7. Assembly mates & kinematic hierarchy preserved', () => {
    const engine = new RobotParametricLinkEngine('TEST-ROBOT');
    const res = engine.updateParameter('Link2Length', 650);

    expect(res.assembly.id).toBe('ASSY-ROB-6DOF-ARM');
    expect(res.assembly.mates.length).toBe(4);
    expect(res.assembly.degreesOfFreedom).toBe(6);
  });

  it('8. Derived parameters update dynamically', () => {
    const engine = new RobotParametricLinkEngine('TEST-ROBOT');
    const res = engine.updateParameter('Link1Length', 450);

    expect(res.derived.reachMm).toBe(450 + 600 + 500 + 120);
    expect(res.derived.centerOfMassMm.z).toBeGreaterThan(0);
    expect(res.derived.maxInertiaKgM2).toBeGreaterThan(0);
  });

  it('9. Stale result protection on parameter change', () => {
    const engine = new RobotParametricLinkEngine('TEST-ROBOT');

    const res = engine.updateParameter('Link2Length', 700);
    expect(res.staleAnalysisIds).toContain('ANALYSIS-FEA-STRUCTURAL');

    const fea = res.analyses.find(a => a.id === 'ANALYSIS-FEA-STRUCTURAL');
    expect(fea?.status).toBe('STALE');

    // Recompute
    const updated = engine.recomputeAnalyses();
    expect(updated.find(a => a.id === 'ANALYSIS-FEA-STRUCTURAL')?.status).toBe('VALID');
  });

  it('10. Invalid dependency detection & broken reference handling', () => {
    const engine = new RobotParametricLinkEngine('TEST-ROBOT');
    const sim = engine.simulateBrokenDependency('Link2Length');

    expect(sim.brokenDependencyId).toBe('Link2Length');
    expect(sim.affectedAnalyses).toContain('ANALYSIS-FEA-STRUCTURAL');

    const analyses = engine.getAnalyses();
    const fea = analyses.find(a => a.id === 'ANALYSIS-FEA-STRUCTURAL');
    expect(fea?.status).toBe('INVALIDATED');
  });

  it('11. Multi-parameter simultaneous update', () => {
    const engine = new RobotParametricLinkEngine('TEST-ROBOT');
    const config = engine.getConfig();

    config.geometry.link1Length = 400;
    config.geometry.link2Length = 700;
    config.mechanical.payloadCapacity = 16;

    const res = engine.applyConfigChanges(config, 'MULTI-UPDATE');
    expect(res.derived.reachMm).toBe(400 + 700 + 500 + 120);
    expect(res.derived.payloadMarginKg).toBe(20 - 16);
  });

  it('12. Parameter revision tracking & history preservation', () => {
    const engine = new RobotParametricLinkEngine('TEST-ROBOT');
    engine.updateParameter('Link1Length', 380);
    engine.updateParameter('Link2Length', 680);

    const history = engine.getRevisionHistory();
    expect(history.length).toBe(2);
    expect(history[0].parameterId).toBe('Link1Length');
    expect(history[1].parameterId).toBe('Link2Length');
  });

  it('13. Workflow determinism & reproducibility', () => {
    const engineA = new RobotParametricLinkEngine('ROBOT-REPRO');
    const resA = engineA.updateParameter('Link2Length', 720);

    const engineB = new RobotParametricLinkEngine('ROBOT-REPRO');
    const resB = engineB.updateParameter('Link2Length', 720);

    expect(resA.evidenceHash).toBe(resB.evidenceHash);
    expect(resA.derived.reachMm).toBe(resB.derived.reachMm);
    expect(resA.derived.totalMassKg).toBe(resB.derived.totalMassKg);
  });

  it('14. EPC-038 Acceptance Gate Verifier Execution', () => {
    const gateReport = EPC038Verifier.runVerification();

    expect(gateReport.epc).toBe('EPC-038');
    expect(gateReport.verdict).toBe('PASS');
    expect(gateReport.summary.failedChecks).toBe(0);
    expect(gateReport.summary.passedChecks).toBe(15);
    expect(gateReport.evidenceHash).toBeDefined();
  });
});
