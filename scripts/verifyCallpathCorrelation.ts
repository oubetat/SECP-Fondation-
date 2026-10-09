/**
 * SECP Industrial OS v3 — Evidence Provenance Correlation Audit
 * Verifies 1:1 direct correlation between live CollisionAuthority.evaluateSync() runtime executions
 * and the recorded traces in /reports/COLLISION-ENGINE-P5-CALLPATH-001.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CollisionAuthority,
  CollisionStatus,
  CanonicalCollisionInput
} from '../src/engine/collision-authority/index';
import { CanonicalGeometryAdapter } from '../src/engine/collision-authority/adapters/CanonicalGeometryAdapter';
import {
  CamFiveAxisCollisionProvider,
  AssemblyCollisionProvider,
  MachineSimulationCollisionProvider,
  KinematicsCollisionProvider
} from '../src/engine/collision-authority/adapters/CanonicalDomainProviders';
import { DEFAULT_UNIT_SYSTEM_MM } from '../src/engine/cad-kernel/document/CADDocument';

async function auditCallpathCorrelation() {
  console.log('=== SECP EVIDENCE PROVENANCE CORRELATION AUDIT ===\n');

  // 1. Read existing CALLPATH JSON report
  const reportPath = path.resolve('reports/COLLISION-ENGINE-P5-CALLPATH-001.json');
  if (!fs.existsSync(reportPath)) {
    console.error(`CRITICAL: Report file not found at ${reportPath}`);
    process.exit(1);
  }

  const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const reportTraces = reportData.traces;

  if (!reportTraces || !Array.isArray(reportTraces) || reportTraces.length !== 5) {
    console.error(`CRITICAL: Expected 5 traces in report, found ${reportTraces?.length}`);
    process.exit(1);
  }

  // 2. Setup Collision Authority
  CollisionAuthority.ensureDefaultProviders();
  const resolver = CollisionAuthority.getResolver();

  function makeDoc(id: string, rev: number, hash: string) {
    return {
      documentId: id,
      revision: rev,
      name: `Part ${id}`,
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: rev },
      derived: {
        geometryHash: hash,
        topologyHash: `TOPO_${hash}`,
        mesh: {
          vertices: new Float32Array([-10, -10, -10, 10, 10, 10]),
          indices: new Uint32Array([0, 1, 2]),
          boundingBox: {
            min: { x: -10, y: -10, z: -10 },
            max: { x: 10, y: 10, z: 10 }
          }
        }
      },
      evidence: []
    };
  }

  const docCAM = makeDoc('DOC_CAM_TOOL_01', 1, 'HASH_CAM_99182');
  const doc5AXIS = makeDoc('DOC_5AXIS_HOLDER_01', 1, 'HASH_5AXIS_33819');
  const docMACH = makeDoc('DOC_MACH_SPINDLE_01', 1, 'HASH_MACH_77211');
  const docASM = makeDoc('DOC_ASM_FIXTURE_01', 1, 'HASH_ASM_55410');
  const docKIN = makeDoc('DOC_KIN_ROBOT_01', 1, 'HASH_KIN_11902');

  resolver.register(docCAM as any);
  resolver.register(doc5AXIS as any);
  resolver.register(docMACH as any);
  resolver.register(docASM as any);
  resolver.register(docKIN as any);

  const productionDomains = [
    {
      name: 'CAM',
      doc: docCAM,
      domain: 'CAM_MULTI_AXIS',
      providerId: CamFiveAxisCollisionProvider.PROVIDER_ID,
      caller: 'ProductionEngine::CAMPipeline',
      motion: { startTcp: { x: 0, y: 0, z: 50 }, endTcp: { x: 0, y: 0, z: 10 } }
    },
    {
      name: '5-Axis',
      doc: doc5AXIS,
      domain: 'CAM_MULTI_AXIS',
      providerId: CamFiveAxisCollisionProvider.PROVIDER_ID,
      caller: 'ProductionEngine::5-AxisPipeline',
      motion: {
        startTcp: { x: 10, y: 10, z: 60 },
        endTcp: { x: 10, y: 10, z: 15 },
        startOrientation: { x: 0, y: 0, z: 1 },
        endOrientation: { x: 0.1, y: 0, z: 0.995 }
      }
    },
    {
      name: 'Machine Simulation',
      doc: docMACH,
      domain: 'NC_SIMULATION',
      providerId: MachineSimulationCollisionProvider.PROVIDER_ID,
      caller: 'ProductionEngine::MachineSimulationPipeline',
      motion: { startTcp: { x: 0, y: 0, z: 200 }, endTcp: { x: 0, y: 0, z: 150 } }
    },
    {
      name: 'Assembly',
      doc: docASM,
      domain: 'ASSEMBLY',
      providerId: AssemblyCollisionProvider.PROVIDER_ID,
      caller: 'ProductionEngine::AssemblyClearancePipeline',
      motion: { startTcp: { x: 0, y: 0, z: 0 }, endTcp: { x: 0, y: 0, z: 0 } }
    },
    {
      name: 'Kinematics',
      doc: docKIN,
      domain: 'KINEMATIC_MECHANISM',
      providerId: KinematicsCollisionProvider.PROVIDER_ID,
      caller: 'ProductionEngine::KinematicMechanismPipeline',
      motion: { startTcp: { x: 20, y: 20, z: 40 }, endTcp: { x: 20, y: 20, z: 10 } }
    }
  ];

  let totalPassedDomains = 0;

  for (let i = 0; i < productionDomains.length; i++) {
    const pd = productionDomains[i];
    const reportTrace = reportTraces[i];
    const geo = CanonicalGeometryAdapter.adapt(pd.doc as any);

    const testTriangles = [
      {
        v0: { x: 100, y: 100, z: 0 },
        v1: { x: 120, y: 100, z: 0 },
        v2: { x: 110, y: 120, z: 0 }
      }
    ];

    const input: CanonicalCollisionInput = {
      domain: pd.domain as any,
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      toleranceProfile: {
        linearToleranceMm: 0.001,
        angularToleranceDeg: 0.1,
        clearanceWarningMarginMm: 2.0,
        safeClearanceMarginMm: 0.5
      },
      cadRevisionId: String(pd.doc.revision),
      canonicalGeometry: geo,
      geometry: {
        tessellatedTriangles: testTriangles
      },
      toolAssembly: {
        cutterDiameterMm: 10,
        fluteLengthMm: 30,
        stickoutMm: 60,
        shankDiameterMm: 10,
        holderDiameterMm: 40,
        holderLengthMm: 50
      },
      motionSegment: pd.motion
    };

    // Live Execution
    const runtimeResult = CollisionAuthority.evaluateSync(input, pd.providerId);

    console.log(`--- Domain [${pd.name}] Correlation Verification ---`);
    console.log(`  Document ID:      Runtime = ${pd.doc.documentId} | Report = ${reportTrace.documentId}`);
    console.log(`  Geometry ID:      Runtime = ${geo.geometryId} | Report = ${reportTrace.geometryId}`);
    console.log(`  Geometry Hash:    Runtime = ${geo.geometryHash} | Report = ${reportTrace.geometryHash}`);
    console.log(`  Provider ID:      Runtime = ${pd.providerId} | Report = ${reportTrace.providerId}`);
    console.log(`  Classification:   Runtime = ${runtimeResult.status} | Report = ${reportTrace.classification}`);
    console.log(`  Proven Safe:      Runtime = ${runtimeResult.provenSafe} | Report = ${reportTrace.canonicalChain?.find((c: any) => c.stage === 'Verification')?.provenSafe}`);

    // Assertions
    const docMatch = pd.doc.documentId === reportTrace.documentId;
    const geoMatch = geo.geometryId === reportTrace.geometryId;
    const hashMatch = geo.geometryHash === reportTrace.geometryHash;
    const providerMatch = pd.providerId === reportTrace.providerId;
    const classMatch = runtimeResult.status === reportTrace.classification;
    const verifiedProvenSafe = reportTrace.canonicalChain?.find((c: any) => c.stage === 'Verification')?.provenSafe;
    const safeMatch = runtimeResult.provenSafe === verifiedProvenSafe;

    const domainPassed = docMatch && geoMatch && hashMatch && providerMatch && classMatch && safeMatch;

    if (domainPassed) {
      console.log(`  RESULT: [PASS] 100% Correlation Confirmed for ${pd.name}\n`);
      totalPassedDomains++;
    } else {
      console.log(`  RESULT: [FAIL] Correlation Mismatch in ${pd.name}\n`);
    }
  }

  console.log(`=== AUDIT SUMMARY ===`);
  console.log(`Domains Verified: ${totalPassedDomains} / 5`);

  if (totalPassedDomains === 5) {
    console.log(`VERDICT: P5_EVIDENCE_PROVENANCE_FULLY_VERIFIED (5/5 PASS)`);
  } else {
    console.log(`VERDICT: P5_EVIDENCE_PROVENANCE_PARTIALLY_VERIFIED (${totalPassedDomains}/5 PASS)`);
    process.exit(1);
  }
}

auditCallpathCorrelation();
