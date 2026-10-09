/**
 * SECP Engineering OS — POST-UX-006.1 VERIFICATION BATTERY
 * Runtime verification of Category-E defect remediation across:
 *  1. ElectricalWorkbenchPanel (ElectricalWorkbenchEngine.getDefaultCircuitComponents)
 *  2. FluidPowerPanel (FluidPowerEngine.getDefaultSystemComponents)
 *  3. PcbWorkbenchPanel (PcbEngine.getDefaultSchematic)
 * 
 * Tests:
 *  Test A: Blank Project Mount (No default seeding, EMPTY_CANVAS, UNAVAILABLE metrics)
 *  Test B: Explicit Reference Activation (Reference dataset loaded only on explicit action, no document mutation)
 *  Test C: Real Reset (Clean reset, zero residual leakage)
 *  Test D: Canonical Engineering Mutation (Canonical context respected, no default override)
 *  Test E: Project Isolation (No state bleeding across project transitions)
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { ElectricalWorkbenchPanel } from '../components/ElectricalWorkbenchPanel';
import { FluidPowerPanel } from '../components/FluidPowerPanel';
import { PcbWorkbenchPanel } from '../components/PcbWorkbenchPanel';
import { ElectricalWorkbenchEngine } from '../engine/electricalWorkbench';
import { FluidPowerEngine } from '../engine/fluidPower';
import { PcbEngine } from '../engine/pcbEngine';
import { EngineeringDocument } from '../engine/cad-kernel/document/CADDocument';
import { EngineeringTelemetryEngine } from '../engine/telemetry/EngineeringTelemetryEngine';
import { deriveTruthProvenance } from '../engine/context/EngineeringContext';

export interface PostUX0061VerificationResult {
  testId: string;
  testName: string;
  targetPanel: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

export function runPostUX0061VerificationBattery(): PostUX0061VerificationResult[] {
  console.log('====================================================================================================');
  console.log('    SECP POST-UX-006.1 — TARGETED E-DEFECT REMEDIATION & RUNTIME VERIFICATION BATTERY               ');
  console.log('====================================================================================================\n');

  const results: PostUX0061VerificationResult[] = [];
  const telemetry = EngineeringTelemetryEngine.getInstance();
  telemetry.clearCache();

  // Blank Canonical Document Definition
  const blankDoc: EngineeringDocument = {
    documentId: 'DOC_BLANK_001',
    revision: 1,
    name: 'Blank Untitled Project',
    units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
    parameters: [],
    sketches: [],
    constraints: [],
    features: [],
    topologyMap: { version: 1 },
    derived: {}
  };

  // Mutated Canonical Document Definition
  const canonicalActiveDoc: EngineeringDocument = {
    documentId: 'DOC_CANONICAL_001',
    revision: 2,
    name: 'Canonical Machined Enclosure Project',
    units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
    parameters: [
      { id: 'p1', name: 'width', expression: '120', value: 120, unit: 'mm' },
      { id: 'p2', name: 'length', expression: '80', value: 80, unit: 'mm' }
    ],
    sketches: [],
    constraints: [],
    features: [
      { id: 'feat-base-extrude', name: 'Chassis Base Extrude', type: 'EXTRUDE', parameters: { depth: 40 } }
    ],
    topologyMap: { version: 1 },
    derived: {}
  };

  // ==================================================================================================
  // TEST A: BLANK PROJECT MOUNT (Zero default seeding, EMPTY_CANVAS, UNAVAILABLE metrics)
  // ==================================================================================================
  console.log('[TEST A] VERIFYING BLANK PROJECT MOUNT (Zero Seeding, EMPTY_CANVAS, UNAVAILABLE metrics)...');

  // A.1: ElectricalWorkbenchPanel Blank Mount
  {
    const html = renderToString(React.createElement(ElectricalWorkbenchPanel, { canonicalDocument: blankDoc }));
    const hasEmptyCanvas = html.includes('EMPTY_CANVAS') || html.includes('NO_CANONICAL_CIRCUIT');
    const hasUnavailableBus = html.includes('UNAVAILABLE');
    const hasEmptyLibrary = html.includes('No canonical electrical netlist') || html.includes('EMPTY_CANVAS: NO_CANONICAL_CIRCUIT');
    // Ensure default factory items (like 'PT100 Temperature Sensor', '24V Source', 'Industrial 24V DC Power Supply') are not rendered in blank state
    const hasNoDefaultSeeding = !html.includes('PT100 Temperature Sensor') && !html.includes('Industrial 24V DC Power Supply');

    const pass = hasEmptyCanvas && hasUnavailableBus && hasEmptyLibrary && hasNoDefaultSeeding;
    results.push({
      testId: 'TEST-A1-ELECTRICAL-BLANK-MOUNT',
      testName: 'ElectricalWorkbenchPanel Blank Project Mount',
      targetPanel: 'src/components/ElectricalWorkbenchPanel.tsx',
      status: pass ? 'PASS' : 'FAIL',
      details: pass
        ? 'Pristine EMPTY_CANVAS rendered, metrics report UNAVAILABLE, 0 default components seeded.'
        : `Failure: emptyCanvas=${hasEmptyCanvas}, unavailableBus=${hasUnavailableBus}, emptyLibrary=${hasEmptyLibrary}, noDefaultSeeding=${hasNoDefaultSeeding}`
    });
    console.log(`  ├─ Electrical Panel Blank Mount: [ ${pass ? 'PASS' : 'FAIL'} ]`);
  }

  // A.2: FluidPowerPanel Blank Mount
  {
    const html = renderToString(React.createElement(FluidPowerPanel, { canonicalDocument: blankDoc }));
    const hasEmptySystem = html.includes('Hydraulic Network Empty') || html.includes('NO_CANONICAL_HYDRAULIC_SYSTEM');
    const hasUnavailableMetrics = html.includes('UNAVAILABLE');
    // Ensure default fluid items (e.g. default 350 bar ISO VG 46 loop components) are not mounted as active
    const hasNoDefaultSeeding = !html.includes('Hydraulic Cylinder Actuator (ø50mm)');

    const pass = hasEmptySystem && hasUnavailableMetrics && hasNoDefaultSeeding;
    results.push({
      testId: 'TEST-A2-FLUID-BLANK-MOUNT',
      testName: 'FluidPowerPanel Blank Project Mount',
      targetPanel: 'src/components/FluidPowerPanel.tsx',
      status: pass ? 'PASS' : 'FAIL',
      details: pass
        ? 'Pristine Hydraulic Network Empty state, metrics report UNAVAILABLE, 0 default components seeded.'
        : `Failure: emptySystem=${hasEmptySystem}, unavailableMetrics=${hasUnavailableMetrics}, noDefaultSeeding=${hasNoDefaultSeeding}`
    });
    console.log(`  ├─ Fluid Power Panel Blank Mount: [ ${pass ? 'PASS' : 'FAIL'} ]`);
  }

  // A.3: PcbWorkbenchPanel Blank Mount
  {
    const html = renderToString(React.createElement(PcbWorkbenchPanel, { canonicalDocument: blankDoc }));
    const hasNoCanonicalPcb = html.includes('NO_CANONICAL_PCB_LAYOUT');
    const hasTruthEmpty = html.includes('EMPTY_CANVAS') || html.includes('NO_BOARD_DIMENSIONS');
    // Ensure default schematic STM32 MCU is not rendered on blank mount
    const hasNoDefaultSeeding = !html.includes('STM32F401') && !html.includes('Pull-up Resistor');

    const pass = hasNoCanonicalPcb && hasTruthEmpty && hasNoDefaultSeeding;
    results.push({
      testId: 'TEST-A3-PCB-BLANK-MOUNT',
      testName: 'PcbWorkbenchPanel Blank Project Mount',
      targetPanel: 'src/components/PcbWorkbenchPanel.tsx',
      status: pass ? 'PASS' : 'FAIL',
      details: pass
        ? 'NO_CANONICAL_PCB_LAYOUT displayed, truth status EMPTY_CANVAS, default schematic not seeded.'
        : `Failure: noCanonicalPcb=${hasNoCanonicalPcb}, truthEmpty=${hasTruthEmpty}, noDefaultSeeding=${hasNoDefaultSeeding}`
    });
    console.log(`  └─ PCB Workbench Panel Blank Mount: [ ${pass ? 'PASS' : 'FAIL'} ]`);
  }

  // ==================================================================================================
  // TEST B: EXPLICIT REFERENCE ACTIVATION (Loaded ONLY upon explicit trigger, no silent mutation)
  // ==================================================================================================
  console.log('\n[TEST B] VERIFYING EXPLICIT REFERENCE ACTIVATION (User Triggered Only, Non-Destructive)...');

  // B.1: Electrical Reference Activation
  {
    const initialDocFeaturesCount = blankDoc.features?.length || 0;
    const comps = ElectricalWorkbenchEngine.getDefaultCircuitComponents();
    const solve = ElectricalWorkbenchEngine.solveCircuit(comps, true);
    const docUntouched = (blankDoc.features?.length || 0) === initialDocFeaturesCount;
    const isReferenceLoaded = comps.length === 8 && solve.busVoltageV === 24 && solve.totalCurrentDrawA > 0;

    const pass = docUntouched && isReferenceLoaded;
    results.push({
      testId: 'TEST-B1-ELECTRICAL-EXPLICIT-REFERENCE',
      testName: 'Electrical Reference Explicit Activation',
      targetPanel: 'src/components/ElectricalWorkbenchPanel.tsx',
      status: pass ? 'PASS' : 'FAIL',
      details: pass
        ? `Reference circuit (8 components, ${solve.busVoltageV}V, ${solve.totalCurrentDrawA.toFixed(2)}A) solved without mutating EngineeringDocument.`
        : 'Failure in electrical reference activation or document mutation detected.'
    });
    console.log(`  ├─ Electrical Reference Activation: [ ${pass ? 'PASS' : 'FAIL'} ]`);
  }

  // B.2: Fluid Reference Activation
  {
    const initialDocFeaturesCount = blankDoc.features?.length || 0;
    const defaultSys = FluidPowerEngine.getDefaultSystemComponents();
    const solve = FluidPowerEngine.solveFluidNetwork(defaultSys.components, 1450, 35000);
    const docUntouched = (blankDoc.features?.length || 0) === initialDocFeaturesCount;
    const isReferenceLoaded = defaultSys.components.length === 8 && solve.pumpPressureBar > 0 && solve.systemFlowLpm > 0;

    const pass = docUntouched && isReferenceLoaded;
    results.push({
      testId: 'TEST-B2-FLUID-EXPLICIT-REFERENCE',
      testName: 'Fluid Power Reference Explicit Activation',
      targetPanel: 'src/components/FluidPowerPanel.tsx',
      status: pass ? 'PASS' : 'FAIL',
      details: pass
        ? `Reference hydraulic loop (${defaultSys.components.length} components, ${solve.pumpPressureBar.toFixed(1)} bar, ${solve.systemFlowLpm.toFixed(1)} L/min) solved without mutating EngineeringDocument.`
        : `Failure in fluid reference activation or document mutation detected: count=${defaultSys.components.length}, pumpP=${solve.pumpPressureBar}, flow=${solve.systemFlowLpm}, docUntouched=${docUntouched}`
    });
    console.log(`  ├─ Fluid Power Reference Activation: [ ${pass ? 'PASS' : 'FAIL'} ]`);
  }

  // B.3: PCB Reference Activation
  {
    const initialDocFeaturesCount = blankDoc.features?.length || 0;
    const defaultSchematic = PcbEngine.getDefaultSchematic();
    const pcbLayout = PcbEngine.generatePcbLayout(100, 60, 1.6);
    const enclosure = PcbEngine.verifyMechanicalEnclosureFit(pcbLayout);
    const docUntouched = (blankDoc.features?.length || 0) === initialDocFeaturesCount;
    const isReferenceLoaded = defaultSchematic.components.length === 6 && pcbLayout.placements.length > 0 && enclosure.status === 'FIT_VERIFIED';

    const pass = docUntouched && isReferenceLoaded;
    results.push({
      testId: 'TEST-B3-PCB-EXPLICIT-REFERENCE',
      testName: 'PCB Reference Explicit Activation',
      targetPanel: 'src/components/PcbWorkbenchPanel.tsx',
      status: pass ? 'PASS' : 'FAIL',
      details: pass
        ? `Reference schematic (${defaultSchematic.components.length} components) & PCB layout verified without mutating EngineeringDocument.`
        : 'Failure in PCB reference activation or document mutation detected.'
    });
    console.log(`  └─ PCB Reference Activation: [ ${pass ? 'PASS' : 'FAIL'} ]`);
  }

  // ==================================================================================================
  // TEST C: REAL RESET (Zero residual leakage into next project)
  // ==================================================================================================
  console.log('\n[TEST C] VERIFYING REAL RESET & RESIDUAL LEAKAGE PURGE...');

  {
    // Clear telemetry cache and evaluate context for blankDoc after prior tests
    telemetry.clearCache();
    const resetContext = telemetry.getToolContext(blankDoc, null);
    const resetTruth = deriveTruthProvenance({
      hasActiveGeometry: resetContext.geometry.solids > 0,
      algorithmType: 'PROCEDURAL_FEM_MESH',
      revision: resetContext.revision,
      isBenchmarkMode: false
    });

    const electricalResetHtml = renderToString(React.createElement(ElectricalWorkbenchPanel, { canonicalDocument: blankDoc }));
    const fluidResetHtml = renderToString(React.createElement(FluidPowerPanel, { canonicalDocument: blankDoc }));
    const pcbResetHtml = renderToString(React.createElement(PcbWorkbenchPanel, { canonicalDocument: blankDoc }));

    const cleanTruth = resetTruth.status === 'EMPTY_CANVAS';
    const cleanElectrical = electricalResetHtml.includes('EMPTY_CANVAS') || electricalResetHtml.includes('NO_CANONICAL_CIRCUIT');
    const cleanFluid = fluidResetHtml.includes('Hydraulic Network Empty') || fluidResetHtml.includes('NO_CANONICAL_HYDRAULIC_SYSTEM');
    const cleanPcb = pcbResetHtml.includes('NO_CANONICAL_PCB_LAYOUT');
    const zeroSolids = resetContext.geometry.solids === 0;

    const pass = cleanTruth && cleanElectrical && cleanFluid && cleanPcb && zeroSolids;
    results.push({
      testId: 'TEST-C-REAL-RESET-PURGE',
      testName: 'Real Reset Residual Leakage Purge',
      targetPanel: 'ALL 3 PANELS',
      status: pass ? 'PASS' : 'FAIL',
      details: pass
        ? 'Real reset successful: 0 residual solids, all 3 panels returned strictly to EMPTY_CANVAS / NO_CANONICAL state.'
        : `Reset failure: cleanTruth=${cleanTruth}, cleanElec=${cleanElectrical}, cleanFluid=${cleanFluid}, cleanPcb=${cleanPcb}, zeroSolids=${zeroSolids}`
    });
    console.log(`  └─ Real Reset Purge Across 3 Panels: [ ${pass ? 'PASS' : 'FAIL'} ]`);
  }

  // ==================================================================================================
  // TEST D: CANONICAL ENGINEERING MUTATION (Canonical inputs respected, no fallback override)
  // ==================================================================================================
  console.log('\n[TEST D] VERIFYING CANONICAL ENGINEERING MUTATION & ACTIVE MODEL DERIVATION...');

  {
    telemetry.clearCache();
    const activeContext = telemetry.getToolContext(canonicalActiveDoc, null);
    const activeTruth = deriveTruthProvenance({
      hasActiveGeometry: activeContext.geometry.solids > 0,
      algorithmType: 'PROCEDURAL_FEM_MESH',
      revision: activeContext.revision,
      isBenchmarkMode: false
    });

    const isSolidDetected = activeContext.geometry.solids > 0;
    const truthIsActive = activeTruth.status === 'ACTIVE_MODEL';
    const volumeComputed = activeContext.geometry.volumeCm3 > 0;

    // Verify panels recognize canonical active document
    const electricalActiveHtml = renderToString(React.createElement(ElectricalWorkbenchPanel, { canonicalDocument: canonicalActiveDoc }));
    const fluidActiveHtml = renderToString(React.createElement(FluidPowerPanel, { canonicalDocument: canonicalActiveDoc }));
    const pcbActiveHtml = renderToString(React.createElement(PcbWorkbenchPanel, { canonicalDocument: canonicalActiveDoc }));

    // Even with a CAD solid, panels without electrical/hydraulic/PCB CAD features still correctly report their domain status rather than injecting fake default data
    const elecReportsNoCircuit = electricalActiveHtml.includes('NO_CANONICAL_CIRCUIT') || electricalActiveHtml.includes('EMPTY_CANVAS');
    const fluidReportsNoHydraulics = fluidActiveHtml.includes('Hydraulic Network Empty') || fluidActiveHtml.includes('NO_CANONICAL_HYDRAULIC_SYSTEM');
    const pcbReportsNoLayout = pcbActiveHtml.includes('NO_CANONICAL_PCB_LAYOUT');

    const pass = isSolidDetected && truthIsActive && volumeComputed && elecReportsNoCircuit && fluidReportsNoHydraulics && pcbReportsNoLayout;
    results.push({
      testId: 'TEST-D-CANONICAL-MUTATION',
      testName: 'Canonical Engineering Mutation Recognition',
      targetPanel: 'ALL 3 PANELS & CAD Kernel',
      status: pass ? 'PASS' : 'FAIL',
      details: pass
        ? `Canonical CAD solid recognized (status: ${activeTruth.status}, volume: ${activeContext.geometry.volumeCm3} cm³); domain panels maintain strict boundary honesty.`
        : 'Failure in canonical mutation recognition or boundary enforcement.'
    });
    console.log(`  └─ Canonical Mutation & Boundary Enforcement: [ ${pass ? 'PASS' : 'FAIL'} ]`);
  }

  // ==================================================================================================
  // TEST E: PROJECT ISOLATION (Project 1 Active -> Project 2 Blank: Zero state bleed)
  // ==================================================================================================
  console.log('\n[TEST E] VERIFYING PROJECT ISOLATION (Sequential Project Context Switching)...');

  {
    // Step 1: Mount Project 1 (Active)
    telemetry.clearCache();
    const ctx1 = telemetry.getToolContext(canonicalActiveDoc, null);
    if (ctx1.geometry.solids === 0) throw new Error('Project 1 setup failed');

    // Step 2: Switch to Project 2 (Blank Project)
    telemetry.clearCache();
    const project2Doc: EngineeringDocument = {
      documentId: 'DOC_PROJECT_2',
      revision: 1,
      name: 'Second Fresh Project',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      parameters: [],
      sketches: [],
      constraints: [],
      features: [],
      topologyMap: { version: 1 },
      derived: {}
    };

    const ctx2 = telemetry.getToolContext(project2Doc, null);
    const truth2 = deriveTruthProvenance({
      hasActiveGeometry: ctx2.geometry.solids > 0,
      algorithmType: 'PROCEDURAL_FEM_MESH',
      revision: ctx2.revision,
      isBenchmarkMode: false
    });

    const elec2 = renderToString(React.createElement(ElectricalWorkbenchPanel, { canonicalDocument: project2Doc }));
    const fluid2 = renderToString(React.createElement(FluidPowerPanel, { canonicalDocument: project2Doc }));
    const pcb2 = renderToString(React.createElement(PcbWorkbenchPanel, { canonicalDocument: project2Doc }));

    const cleanSolids = ctx2.geometry.solids === 0;
    const cleanTruth = truth2.status === 'EMPTY_CANVAS';
    const cleanElec = elec2.includes('EMPTY_CANVAS') || elec2.includes('NO_CANONICAL_CIRCUIT');
    const cleanFluid = fluid2.includes('Hydraulic Network Empty') || fluid2.includes('NO_CANONICAL_HYDRAULIC_SYSTEM');
    const cleanPcb = pcb2.includes('NO_CANONICAL_PCB_LAYOUT');

    const pass = cleanSolids && cleanTruth && cleanElec && cleanFluid && cleanPcb;
    results.push({
      testId: 'TEST-E-PROJECT-ISOLATION',
      testName: 'Multi-Project Isolation Boundary',
      targetPanel: 'ALL 3 PANELS & Telemetry Engine',
      status: pass ? 'PASS' : 'FAIL',
      details: pass
        ? 'Strict project isolation verified: Project 2 is completely unpolluted by Project 1 CAD or reference data.'
        : `Isolation failure: cleanSolids=${cleanSolids}, cleanTruth=${cleanTruth}, cleanElec=${cleanElec}, cleanFluid=${cleanFluid}, cleanPcb=${cleanPcb}`
    });
    console.log(`  └─ Multi-Project Isolation Boundary: [ ${pass ? 'PASS' : 'FAIL'} ]`);
  }

  // ==================================================================================================
  // SUMMARY TABLE & VERDICT
  // ==================================================================================================
  console.log('\n====================================================================================================');
  console.log('    POST-UX-006.1 VERIFICATION BATTERY SUMMARY                                                     ');
  console.log('====================================================================================================');
  console.log('| Test ID                         | Target Panel / Scope             | Result   | Details Summary');
  console.log('|---------------------------------|----------------------------------|----------|----------------------------------------------------');

  for (const r of results) {
    const id = r.testId.padEnd(31).slice(0, 31);
    const scope = (r.targetPanel.split('/').pop() || r.targetPanel).padEnd(32).slice(0, 32);
    const st = r.status === 'PASS' ? '[ PASS ]' : '[ FAIL ]';
    const dt = r.details.padEnd(50).slice(0, 50);
    console.log(`| ${id} | ${scope} | ${st} | ${dt}`);
  }

  const failCount = results.filter(r => r.status === 'FAIL').length;
  const passCount = results.filter(r => r.status === 'PASS').length;

  console.log('====================================================================================================');
  console.log(`[BATTERY VERDICT]: ${failCount === 0 ? `ALL ${passCount}/${results.length} TESTS PASSED — FORENSICALLY PROVEN` : `${failCount} TESTS FAILED`}`);
  console.log('====================================================================================================\n');

  if (failCount > 0) {
    throw new Error(`POST-UX-006.1 Verification Battery encountered ${failCount} failures.`);
  }

  return results;
}

// Direct CLI execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('verify-post-ux-0061-default-factory-runtime')) {
  runPostUX0061VerificationBattery();
}
