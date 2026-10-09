
import initOpenCascade from 'opencascade.js';
import fs from 'fs';
import path from 'path';

async function runOcctPoc() {
  console.log('--- SECP-038: REAL OCCT POC START ---');
  const report: any = {
    kernel: 'OCCT',
    executionMode: 'Node.js/WASM',
    overallStatus: 'PENDING'
  };

  try {
    console.log('Phase 1: Initializing OCCT WASM...');
    const oc = await initOpenCascade();
    console.log('OCCT Initialized Successfully.');
    report.phase1 = 'PASS';

    // Phase 2: Basic Solid (Box)
    console.log('Phase 2: Creating Box 100x100x100...');
    const box = new oc.BRepPrimAPI_MakeBox_2(100, 100, 100);
    const boxShape = box.Shape();
    
    if (boxShape.IsNull()) throw new Error('Box shape is null');
    
    // Topology Check
    const boxExploration = new oc.TopExp_Explorer_2(boxShape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    let faceCount = 0;
    while (boxExploration.More()) {
      faceCount++;
      boxExploration.Next();
    }
    console.log(`Box Faces: ${faceCount}`);
    report.box = { status: 'PASS', faces: faceCount };

    // Phase 3: Second Solid (Cylinder)
    console.log('Phase 3: Creating Cylinder R25 H120...');
    const centerPoint = new oc.gp_Pnt_3(50, 50, -10);
    const axis = new oc.gp_Dir_4(0, 0, 1);
    const ax2 = new oc.gp_Ax2_3(centerPoint, axis);
    const cylinder = new oc.BRepPrimAPI_MakeCylinder_3(ax2, 25, 120);
    const cylinderShape = cylinder.Shape();
    report.cylinder = { status: 'PASS' };

    // Phase 4: Boolean Cut
    console.log('Phase 4: Executing Boolean Cut (Box - Cylinder)...');
    const cut = new oc.BRepAlgoAPI_Cut_3(boxShape, cylinderShape);
    const resultShape = cut.Shape();
    
    if (resultShape.IsNull()) throw new Error('Boolean cut result is null');
    
    // Geometric Validation (Volume)
    const gprops = new oc.GProp_GProps_1();
    oc.BRepGProp.VolumeProperties(resultShape, gprops, false, false, false);
    const volume = gprops.Mass();
    console.log(`Result Volume: ${volume.toFixed(2)}`);
    report.booleanCut = { status: 'PASS', volume };

    // Phase 5: Fillet Test
    console.log('Phase 5: Fillet Test (Attempting on one edge)...');
    try {
      const fillet = new oc.BRepFilletAPI_MakeFillet(resultShape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      const edgeExploration = new oc.TopExp_Explorer_2(resultShape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      if (edgeExploration.More()) {
        const edge = oc.TopoDS.Edge_1(edgeExploration.Value());
        fillet.Add_2(5, edge);
        const filletedShape = fillet.Shape();
        if (!filletedShape.IsNull()) {
          console.log('Fillet applied successfully.');
          report.fillet = 'PASS';
        } else {
          report.fillet = 'FAIL';
        }
      } else {
        report.fillet = 'NO_EDGES';
      }
    } catch (e) {
      console.log('Fillet failed or unsupported in this build.');
      report.fillet = 'NOT_VERIFIED';
    }

    // Phase 6: STEP Export
    console.log('Phase 6: Exporting to STEP...');
    const stepWriter = new oc.STEPControl_Writer_1();
    const status = stepWriter.Transfer(resultShape, oc.STEPControl_StepModelType.STEPControl_AsIs, true);
    let stepContent = '';
    if (status === oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      const tempPath = '/tmp/secp_poc_export.step';
      stepWriter.Write(tempPath);
      stepContent = fs.readFileSync(tempPath, 'utf8');
      console.log('STEP Export Success.');
      report.stepExport = 'PASS';
    } else {
      throw new Error('STEP Transfer Failed');
    }

    // Phase 7: STEP Re-import
    console.log('Phase 7: Re-importing STEP...');
    const stepReader = new oc.STEPControl_Reader_1();
    const readStatus = stepReader.ReadFile('/tmp/secp_poc_export.step');
    if (readStatus === oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      stepReader.TransferRoots();
      const importedShape = stepReader.OneShape();
      
      const gpropsImport = new oc.GProp_GProps_1();
      oc.BRepGProp.VolumeProperties(importedShape, gpropsImport, false, false, false);
      const importedVolume = gpropsImport.Mass();
      console.log(`Imported Volume: ${importedVolume.toFixed(2)}`);
      
      report.stepImport = 'PASS';
      report.importedVolume = importedVolume;

      // Phase 8: Fidelity Check
      const volumeDeviation = Math.abs(volume - importedVolume);
      report.volumeDeviation = volumeDeviation;
      console.log(`Volume Deviation: ${volumeDeviation.toExponential(4)}`);
      
      if (volumeDeviation < 1e-5) {
        report.fidelity = 'PASS';
        report.overallStatus = 'REAL_OCCT_POC_PASS';
      } else {
        report.fidelity = 'PARTIAL';
        report.overallStatus = 'REAL_OCCT_POC_PARTIAL';
      }
    } else {
      report.stepImport = 'FAIL';
      report.overallStatus = 'REAL_OCCT_POC_PARTIAL';
    }

  } catch (err: any) {
    console.error('POC FAILED:', err);
    report.overallStatus = 'REAL_OCCT_POC_FAIL';
    report.error = err.message;
  }

  // Write Report
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);
  fs.writeFileSync(path.join(reportsDir, 'SECP-038-CAD-KERNEL-POC.json'), JSON.stringify(report, null, 2));
  
  console.log('--- SECP-038: POC COMPLETE ---');
  console.log(JSON.stringify(report, null, 2));
}

runOcctPoc();
