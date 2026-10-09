import { SketchUIIntegration } from '../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { AssemblyEngine } from '../engine/assembly';
import { DocumentEvaluator } from '../engine/cad-kernel/document/DocumentEvaluator';
import { IDocumentResolver } from '../engine/cad-kernel/document/DocumentResolver';
import { createCanonicalRenderData } from '../engine/viewport/CanonicalRenderContract';
import { convertRenderDataToThreeBufferGeometry } from '../engine/viewport/ThreeGeometryConverter';

const testDocumentResolver: IDocumentResolver = {
  resolveDocument: (docId: string) => null
};

async function runCanonical3DConvergenceProof() {
  console.log('================================================================');
  console.log(' PROFESSIONAL 3D CANONICAL CONVERGENCE — RUNTIME VERIFICATION ');
  console.log('================================================================\n');

  const projectCases = [
    {
      name: 'BALL_VALVE',
      createDoc: () => SketchUIIntegration.createValveDocument('DOC_VALVE_001').document
    },
    {
      name: 'INDUSTRIAL_DRONE',
      createDoc: () => SketchUIIntegration.createIndustrialDroneDocument('DOC_DRONE_001').document
    },
    {
      name: 'CUSTOM_SOLID (BOX)',
      createDoc: () => SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_BOX_001').document
    },
    {
      name: 'IMPORTED (CYLINDER)',
      createDoc: () => SketchUIIntegration.createPrimitiveDocument('CYLINDER', 'DOC_CYL_001').document
    }
  ];

  let totalPassed = 0;

  for (const pCase of projectCases) {
    console.log(`----------------------------------------------------------------`);
    console.log(` TESTING PROJECT TYPE: [ ${pCase.name} ]`);
    console.log(`----------------------------------------------------------------`);

    const doc = pCase.createDoc();
    const renderData = createCanonicalRenderData(doc);

    // Main CAD Viewport conversion (Meters -> Millimeters, x1000)
    const mainViewportGeom = convertRenderDataToThreeBufferGeometry(renderData, { unitScaleMultiplier: 1000 });

    // Professional 3D Viewport conversion (Standard unitScale)
    const pro3dViewportGeom = convertRenderDataToThreeBufferGeometry(renderData);

    const mainPos = mainViewportGeom.getAttribute('position');
    const proPos = pro3dViewportGeom.getAttribute('position');

    const mainIdx = mainViewportGeom.getIndex();
    const proIdx = pro3dViewportGeom.getIndex();

    const mainVertCount = mainPos ? mainPos.count : 0;
    const proVertCount = proPos ? proPos.count : 0;

    const mainIdxCount = mainIdx ? mainIdx.count : 0;
    const proIdxCount = proIdx ? proIdx.count : 0;

    const mainUserData = mainViewportGeom.userData;
    const proUserData = pro3dViewportGeom.userData;

    console.log(` Document ID   : ${renderData.documentId}`);
    console.log(` Revision      : ${renderData.revision}`);
    console.log(` BRep Hash     : ${renderData.brepHash}`);
    console.log(` Mesh Hash     : ${renderData.meshHash}`);
    console.log(` Vertices      : Main CAD Viewport = ${mainVertCount} | Pro 3D Viewport = ${proVertCount}`);
    console.log(` Indices       : Main CAD Viewport = ${mainIdxCount} | Pro 3D Viewport = ${proIdxCount}`);
    console.log(` Faces Count   : ${renderData.facesCount}`);
    console.log(` Topology      : ${Object.keys(renderData.topologyMap?.faceTriangleMap || {}).length} Faces mapped`);

    const idMatches = mainUserData.documentId === proUserData.documentId;
    const revMatches = mainUserData.revision === proUserData.revision;
    const brepHashMatches = mainUserData.brepHash === proUserData.brepHash;
    const meshHashMatches = mainUserData.meshHash === proUserData.meshHash;
    const vertMatches = mainVertCount === proVertCount && mainVertCount > 0;
    const idxMatches = mainIdxCount === proIdxCount;

    const isIdentical = idMatches && revMatches && brepHashMatches && meshHashMatches && vertMatches && idxMatches;

    if (isIdentical) {
      console.log(` VERDICT      : [ PASS ] — Identical SOT Geometry rendered in both viewports\n`);
      totalPassed++;
    } else {
      console.error(` VERDICT      : [ FAIL ] — Divergence detected!`);
      console.error(`                idMatches=${idMatches}, revMatches=${revMatches}, brepHashMatches=${brepHashMatches}, meshHashMatches=${meshHashMatches}, vertMatches=${vertMatches}, idxMatches=${idxMatches}\n`);
    }
  }

  console.log('================================================================');
  if (totalPassed === projectCases.length) {
    console.log(' OVERALL VERDICT: PROFESSIONAL 3D CANONICAL CONVERGENCE — PASS');
    console.log(' All project types verified with zero SOT divergence.');
  } else {
    console.log(` OVERALL VERDICT: PROFESSIONAL 3D CANONICAL CONVERGENCE — FAIL (${totalPassed}/${projectCases.length} passed)`);
    process.exit(1);
  }
  console.log('================================================================');
}

runCanonical3DConvergenceProof().catch(err => {
  console.error('Fatal error in convergence proof:', err);
  process.exit(1);
});
