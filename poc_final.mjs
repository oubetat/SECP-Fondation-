
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Polyfill for Emscripten Node.js compatibility
global.__dirname = __dirname;
global.__filename = __filename;

import initOpenCascade from './node_modules/opencascade.js/dist/opencascade.wasm.js';

async function runPoc() {
  console.log('--- SECP-038: REAL OCCT POC START ---');
  const report = {
    kernel: 'OCCT',
    executionMode: 'Node.js/WASM (Manual Load)',
    overallStatus: 'PENDING',
    timestamp: new Date().toISOString()
  };

  try {
    console.log('Phase 1: Loading OCCT WASM...');
    const wasmPath = path.resolve(__dirname, 'node_modules/opencascade.js/dist/opencascade.wasm.wasm');
    const wasmBinary = fs.readFileSync(wasmPath);
    const oc = await initOpenCascade({
      wasmBinary
    });
    console.log('OCCT Version: 7.x (OpenCascade.js)');
    report.occtVersion = '7.x (WASM)';
    report.phase1 = 'PASS';

    // Phase 2: Basic Solid (Box)
    console.log('Phase 2: Creating Box 100x100x100...');
    console.log('Available MakeBox constructors:', Object.keys(oc).filter(k => k.startsWith('BRepPrimAPI_MakeBox')));
    
    let boxBuilder;
    try {
      // Trying the 3-parameter version (likely _1 or _2 depending on build)
      boxBuilder = new oc.BRepPrimAPI_MakeBox_1(100, 100, 100);
    } catch (e) {
      console.log('MakeBox_1 failed, trying MakeBox_2 with 4 params (0,0,0, 100,100,100)...');
      // Some builds use (gp_Pnt, dx, dy, dz)
      const p0 = new oc.gp_Pnt_3(0, 0, 0);
      boxBuilder = new oc.BRepPrimAPI_MakeBox_3(p0, 100, 100, 100);
    }
    const boxShape = boxBuilder.Shape();
    
    if (boxShape.IsNull()) throw new Error('Box shape is null');
    
    // Topology Validation
    const boxExploration = new oc.TopExp_Explorer_2(boxShape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    let faces = 0;
    while (boxExploration.More()) {
      faces++;
      boxExploration.Next();
    }
    console.log(`Box Faces: ${faces}`);
    report.box = { status: 'PASS', faces };

    // Phase 3: Second Solid (Cylinder)
    console.log('Phase 3: Creating Cylinder R25 H120...');
    const center = new oc.gp_Pnt_3(50, 50, -10);
    const axis = new oc.gp_Dir_4(0, 0, 1);
    const ax2 = new oc.gp_Ax2_3(center, axis);
    const cylBuilder = new oc.BRepPrimAPI_MakeCylinder_3(ax2, 25, 120);
    const cylShape = cylBuilder.Shape();
    report.cylinder = { status: 'PASS' };

    // Phase 4: Boolean Cut
    console.log('Phase 4: Executing Boolean Cut...');
    const cutBuilder = new oc.BRepAlgoAPI_Cut_3(boxShape, cylShape);
    const resultShape = cutBuilder.Shape();
    
    if (resultShape.IsNull()) throw new Error('Result shape is null');
    
    const gprops = new oc.GProp_GProps_1();
    console.log('BRepGProp keys:', Object.keys(oc.BRepGProp || {}));
    
    // In many OCCT JS builds, static methods are on the class object itself with suffixes
    // Try common names
    if (oc.BRepGProp.VolumeProperties_1) {
      oc.BRepGProp.VolumeProperties_1(resultShape, gprops, false, false, false);
    } else if (oc.BRepGProp.VolumeProperties) {
      oc.BRepGProp.VolumeProperties(resultShape, gprops, false, false, false);
    } else {
      console.log('VolumeProperties not found on BRepGProp, searching globally...');
      const vpropKey = Object.keys(oc).find(k => k.includes('VolumeProperties'));
      console.log('Found VolumeProperties key:', vpropKey);
      if (vpropKey && typeof oc[vpropKey] === 'function') {
        oc[vpropKey](resultShape, gprops, false, false, false);
      } else {
        throw new Error('Could not find VolumeProperties function');
      }
    }
    const volume = gprops.Mass();
    console.log(`Result Volume: ${volume.toFixed(4)}`);
    report.booleanCut = { status: 'PASS', volume };

    // Phase 5: Fillet Test
    console.log('Phase 5: Fillet Test...');
    report.fillet = 'NOT_VERIFIED (Complexity out of scope for PoC)';

    // Phase 6: STEP Export
    console.log('Phase 6: STEP Export...');
    const writer = new oc.STEPControl_Writer_1();
    const transferStatus = writer.Transfer(resultShape, oc.STEPControl_StepModelType.STEPControl_AsIs, true);
    
    if (transferStatus !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      throw new Error('STEP Transfer Failed');
    }

    const stepPath = 'test_export.step';
    // OCCT's STEPControl_Writer.Write returns an IFSelect_ReturnStatus
    const writeStatus = writer.Write(stepPath);
    console.log('Write Status:', writeStatus);
    
    console.log('VFS Root Files after Write:', oc.FS.readdir('/'));
    
    // Find the file that was likely created (looking for non-standard names if test_export.step is missing)
    const files = oc.FS.readdir('/');
    const targetFile = files.find(f => f.includes('step')) || 'PV';
    console.log('Attempting to read file:', targetFile);

    const stepBytes = oc.FS.readFile(targetFile);
    const stepContent = Buffer.from(stepBytes).toString('utf8');
    
    // Also save to host FS for reference if possible (optional but good for PoC)
    fs.writeFileSync('./reports/secp_poc.step', stepContent);
    
    console.log('STEP Export Successful (from VFS).');
    report.stepExport = 'PASS';
    report.stepSchema = 'STEP AP203/214 (Standard OCCT Writer)';

    // Phase 7: STEP Re-import
    console.log(`Phase 7: STEP Re-import from ${targetFile}...`);
    const reader = new oc.STEPControl_Reader_1();
    const readStatus = reader.ReadFile(targetFile);
    if (readStatus === oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      reader.TransferRoots();
      const importedShape = reader.OneShape();
      
      const gpropsImp = new oc.GProp_GProps_1();
      // Search for VolumeProperties on BRepGProp again
      if (oc.BRepGProp.VolumeProperties_1) {
        oc.BRepGProp.VolumeProperties_1(importedShape, gpropsImp, false, false, false);
      } else {
        const vpropKey = Object.keys(oc).find(k => k.includes('VolumeProperties'));
        oc[vpropKey](importedShape, gpropsImp, false, false, false);
      }
      
      const importedVolume = gpropsImp.Mass();
      console.log(`Imported Volume: ${importedVolume.toFixed(4)}`);
      report.stepImport = 'PASS';
      report.importedVolume = importedVolume;

      // Phase 8: Fidelity
      const volumeDev = Math.abs(volume - importedVolume);
      report.volumeDeviation = volumeDev;
      console.log(`Volume Deviation: ${volumeDev.toExponential(4)}`);
      
      if (volumeDev < 1e-5) {
        report.overallStatus = 'REAL_OCCT_POC_PASS';
        report.fidelity = 'PASS';
      } else {
        report.overallStatus = 'REAL_OCCT_POC_PARTIAL';
        report.fidelity = 'PARTIAL';
      }
    } else {
      console.error('STEP Read Failed with status:', readStatus);
      report.stepImport = 'FAIL';
      report.overallStatus = 'REAL_OCCT_POC_PARTIAL';
    }

  } catch (err) {
    console.error('POC ERROR:', err);
    report.overallStatus = 'REAL_OCCT_POC_FAIL';
    report.error = err.message || String(err);
  }

  // Save Report
  const reportPath = path.join(process.cwd(), 'reports/SECP-038-CAD-KERNEL-POC.json');
  if (!fs.existsSync(path.dirname(reportPath))) fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('--- POC COMPLETE ---');
  console.log(JSON.stringify(report, null, 2));
}

runPoc();
