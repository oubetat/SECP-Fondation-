/**
 * SECP P6 Forensic Evidence — Kinematic Clearance Authority Isolation Proof
 * Proves in diff and runtime that:
 * 1. KinematicClearanceEngine.evaluateKinematicClearance calculates local metrics.
 * 2. KinematicsCollisionProvider DOES NOT return or forward report.provenSafe.
 * 3. CollisionAuthority enforces fail-closed: exactnessLevel = SAMPLED => provenSafe = false.
 */

import { CollisionAuthority, CollisionStatus, CollisionExactness } from '../src/engine/collision-authority';
import { KinematicClearanceEngine } from '../src/engine/collision-authority/kinematics/KinematicClearanceEngine';
import { KinematicsCollisionProvider } from '../src/engine/collision-authority/adapters/CanonicalDomainProviders';

async function runProof() {
  console.log('=== SECP FORENSIC PROOF: KINEMATIC CLEARANCE AUTHORITY ENFORCEMENT ===\n');

  CollisionAuthority.ensureDefaultProviders();

  const sampleInput: any = {
    domain: 'KINEMATIC_MECHANISM',
    coordinateFrame: 'WCS',
    units: 'MILLIMETERS',
    toleranceProfile: {
      linearToleranceMm: 0.005,
      angularToleranceDeg: 0.5,
      clearanceWarningMarginMm: 2.0,
      safeClearanceMarginMm: 0.5
    },
    cadRevisionId: 'REV-KIN-001',
    mechanism: {
      mechanismId: 'MECH-ROBOT-6AXIS',
      jointConfigurations: [
        { jointId: 'J1', currentPosition: 0 },
        { jointId: 'J2', currentPosition: 0 }
      ],
      links: [
        {
          linkId: 'LINK_BASE',
          geometryRef: 'BASE_GEO',
          tessellatedMesh: [
            { v0: { x: 0, y: 0, z: 0 }, v1: { x: 10, y: 0, z: 0 }, v2: { x: 0, y: 10, z: 0 } }
          ]
        },
        {
          linkId: 'LINK_ARM',
          geometryRef: 'ARM_GEO',
          tessellatedMesh: [
            { v0: { x: 100, y: 100, z: 100 }, v1: { x: 110, y: 100, z: 100 }, v2: { x: 100, y: 110, z: 100 } }
          ]
        }
      ]
    },
    geometry: { tessellatedTriangles: [] }
  };

  // Step 1: Internal Helper evaluation
  console.log('[1] Executing KinematicClearanceEngine.evaluateKinematicClearance(input)...');
  const helperReport = KinematicClearanceEngine.evaluateKinematicClearance(sampleInput);
  console.log(`    Helper Report isColliding:      ${helperReport.isColliding}`);
  console.log(`    Helper Report minimumClearance:  ${helperReport.minimumClearanceMm} mm`);
  console.log(`    Helper Report local provenSafe:  ${helperReport.provenSafe}`);

  // Step 2: Provider raw evaluation
  console.log('\n[2] Executing KinematicsCollisionProvider.evaluate(input)...');
  const provider = new KinematicsCollisionProvider();
  const rawProviderResult = provider.evaluate(sampleInput);
  console.log(`    Provider Exactness Level:       ${provider.capabilities.exactnessLevel} (${CollisionExactness[provider.capabilities.exactnessLevel]})`);
  console.log(`    Provider Raw Status:            ${rawProviderResult.status}`);
  console.log(`    Does RawProviderResult contain "provenSafe"? ${'provenSafe' in rawProviderResult ? 'YES' : 'NO'}`);

  // Step 3: Canonical Authority evaluation
  console.log('\n[3] Executing CollisionAuthority.evaluate(input)...');
  const canonicalResult = await CollisionAuthority.evaluate(sampleInput, KinematicsCollisionProvider.PROVIDER_ID);
  console.log(`    Canonical Execution ID:         ${canonicalResult.executionId}`);
  console.log(`    Canonical Status:               ${canonicalResult.status}`);
  console.log(`    Canonical Exactness:            ${canonicalResult.exactness}`);
  console.log(`    Canonical provenSafe:           ${canonicalResult.provenSafe}`);

  console.log('\n=== AUTHORITY ISOLATION SUMMARY ===');
  console.table([
    {
      Layer: '1. Internal Helper Engine',
      Component: 'KinematicClearanceEngine',
      Exactness: 'N/A (Helper)',
      Status: helperReport.overallStatus,
      ProvenSafeReported: String(helperReport.provenSafe),
      Authoritative: 'NO'
    },
    {
      Layer: '2. Domain Adapter Provider',
      Component: 'KinematicsCollisionProvider',
      Exactness: provider.capabilities.exactnessLevel,
      Status: rawProviderResult.status,
      ProvenSafeReported: 'UNDEFINED (Stripped/Not Provided)',
      Authoritative: 'NO'
    },
    {
      Layer: '3. Canonical Collision Authority',
      Component: 'CollisionAuthority Core',
      Exactness: canonicalResult.exactness,
      Status: canonicalResult.status,
      ProvenSafeReported: String(canonicalResult.provenSafe),
      Authoritative: 'YES (Final Law)'
    }
  ]);

  if (canonicalResult.provenSafe === false && !('provenSafe' in rawProviderResult)) {
    console.log('\n✔ FORENSIC VERIFICATION PASSED: SAMPLED kinematics is strictly quarantined from authoritative safety.');
  } else {
    console.error('\n❌ FORENSIC VERIFICATION FAILED: Authority leakage detected.');
    process.exit(1);
  }
}

runProof().catch(err => {
  console.error(err);
  process.exit(1);
});
