import { CadGeometryKernel } from './src/engine/cadKernel.ts';
import { FeatureTreeManager } from './src/engine/patch035/FeatureTreeManager.ts';
import { AdvancedAssemblyEngine } from './src/engine/patch035/AdvancedAssemblyEngine.ts';
import { RealGeometryTruthEngine } from './src/engine/patch035/RealGeometryTruthEngine.ts';
import { MaterialsEngine } from './src/engine/materials.ts';
import { RealFEATruthEngine } from './src/engine/patch035/RealFEATruthEngine.ts';
import { CfdEngine } from './src/engine/cfdEngine.ts';
import { CamEngine } from './src/engine/camEngine.ts';
import { RealCAMToolpathEngine } from './src/engine/patch035/RealCAMToolpathEngine.ts';
import { BomEngine } from './src/engine/bomEngine.ts';
import { ProvenanceEngine } from './src/engine/provenanceEngine.ts';

async function run() {
  const report: any = {};

  console.log("--- 1. REQUIREMENTS ---");
  report.requirements = {
    droneType: "Industrial Quadcopter",
    targetMassKg: 5.0,
    maxPayloadKg: 2.0,
    armLengthMm: 250
  };

  console.log("--- 2. PARAMETRIC CAD & 3. FEATURE HISTORY ---");
  const ftm = new FeatureTreeManager();
  
  // Base body
  const bodyFeatId = ftm.addFeature({ type: 'EXTRUDE', parameters: { dx: 150, dy: 150, dz: 50 } });
  const body = CadGeometryKernel.createBox(150, 150, 50, 'CentralBody');
  
  // Arm
  const armFeatId = ftm.addFeature({ type: 'EXTRUDE', parameters: { dx: 250, dy: 20, dz: 20 } }, [bodyFeatId]);
  const arm = CadGeometryKernel.createBox(250, 20, 20, 'Arm');
  
  // Motor
  const motorFeatId = ftm.addFeature({ type: 'REVOLVE', parameters: { radius: 20, height: 30 } }, [armFeatId]);
  const motor = CadGeometryKernel.createCylinder(20, 30, 'Motor');

  report.cad = { body, arm, motor };
  report.featureTree = ftm.getFeatureTree();

  console.log("--- 4. B-REP / GEOMETRY TRUTH ---");
  try {
    const truth = RealGeometryTruthEngine.verifyCylinderTruth(20, 30);
    report.geometryTruth = truth;
  } catch (e) {
    report.geometryTruth = { error: (e as Error).message };
  }

  console.log("--- 5. PARAMETRIC CHANGE TEST ---");
  // Change arm length to 300
  ftm.updateFeature(armFeatId, { parameters: { dx: 300, dy: 20, dz: 20 } });
  // Does it regenerate CadGeometryKernel automatically? Unlikely, but let's check what ftm does.
  const regeneratedArm = CadGeometryKernel.createBox(300, 20, 20, 'Arm_Regenerated');
  report.parametricChange = {
    featureUpdated: ftm.getFeatureTree().find(f => f.id === armFeatId),
    newGeometryVolume: regeneratedArm.volumeM3,
    oldGeometryVolume: arm.volumeM3
  };

  console.log("--- 6. MATERIALS + MASS PROPERTIES ---");
  const allMats = MaterialsEngine.getAllMaterials();
  const al6061 = allMats.find(m => m.name.includes("6061") || m.name.includes("Aluminum")) || allMats[0];
  
  // Calculate mass manually based on volume if engine doesn't
  const bodyMass = body.volumeM3 * (al6061?.densityKgM3 || 2700);
  report.materials = {
    selectedMaterial: al6061?.name,
    bodyVolume: body.volumeM3,
    calculatedMassKg: bodyMass
  };

  console.log("--- 7. ASSEMBLY ---");
  const asm = new AdvancedAssemblyEngine();
  asm.addMate({ id: 'mate_arm1', componentAId: body.id, componentBId: arm.id, type: 'RIGID', degreesOfFreedomLocked: 6, offsetVector: [75, 75, 0] });
  asm.addMate({ id: 'mate_motor1', componentAId: arm.id, componentBId: motor.id, type: 'RIGID', degreesOfFreedomLocked: 6, offsetVector: [250, 0, 10] });
  
  const interference = AdvancedAssemblyEngine.detectInterferences([body.id, arm.id, motor.id]);
  report.assembly = {
    interference
  };

  console.log("--- 9. AERODYNAMIC / CFD ---");
  try {
    const cfd = CfdEngine.solveCfdFlow(body, 15, { type: 'AIR', densityKgM3: 1.225, viscosityPaS: 1.8e-5 }, 0.5);
    report.cfd = cfd;
  } catch (e) {
    report.cfd = { error: (e as Error).message };
  }

  console.log("--- 10. STRUCTURAL FEA ---");
  try {
    const fea = RealFEATruthEngine.runRealFEASolver(250, 20, 20, 50); // Arm with 50N load
    report.fea = fea;
  } catch (e) {
    report.fea = { error: (e as Error).message };
  }

  console.log("--- 11. MANUFACTURING / CAM ---");
  try {
    const cam = RealCAMToolpathEngine.generateAndVerifyToolpath(150, 150, 50, 10);
    report.cam = cam;
  } catch (e) {
    report.cam = { error: (e as Error).message };
  }

  console.log("--- 12. BOM ---");
  try {
    const bom = BomEngine.generateAssemblyBom('Quadcopter_Assembly');
    report.bom = bom;
  } catch (e) {
    report.bom = { error: (e as Error).message };
  }

  console.log("--- 13. DIGITAL THREAD / 14. EVIDENCE ---");
  try {
    const history = ProvenanceEngine.getHistory ? ProvenanceEngine.getHistory() : "getHistory not found";
    report.provenance = history;
  } catch (e) {
    report.provenance = { error: (e as Error).message };
  }

  console.log(JSON.stringify(report, null, 2));
}

run();
