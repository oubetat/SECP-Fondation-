import assert from 'assert';
import { EngineeringPolicyEngine } from '../../src/engine/industrial-os/policy/EngineeringPolicyEngine';
import { INITIAL_SECP_POLICIES } from '../../src/engine/industrial-os/policy/DefaultPolicies';
import { EngineeringObjectOS } from '../../src/engine/industrial-os/EngineeringObjectOS';
import { HardAcceptanceGate159 } from '../../src/engine/HardAcceptanceGate159';

async function runPolicyTestBattery() {
  console.log('--- SECP Industrial OS v2: PATCH-159 Policy Engine Test Battery ---');

  const engine = EngineeringPolicyEngine.getInstance(INITIAL_SECP_POLICIES);
  const os = new EngineeringObjectOS();
  os.clear();

  // Test 1: Policy Registration & Determinism
  console.log('[TEST] Policy Registration & Determinism');
  const context = {
    subject: { identityId: 'OBJ-1', objectType: 'DESIGN' as any, projectId: 'P1', revisionId: '1', objectVersion: 1, createdBy: 'U1', contentHash: 'H1', timestamp: 'T1' },
    operation: 'CREATE',
    actor: { id: 'U1', type: 'USER', capabilities: [] },
    environment: { timestamp: '2026-01-01T00:00:00Z', stage: 'PRODUCTION' as any }
  };
  const d1 = engine.evaluate(context);
  const d2 = engine.evaluate(context);
  assert(d1.overallEffect === d2.overallEffect, 'Decisions must be deterministic');
  console.log('[PASS] Determinism verified');

  // Test 2: ALLOW Decision
  console.log('[TEST] ALLOW Decision');
  // Default is ALLOW if no policies match DENY
  assert(d1.overallEffect === 'ALLOW', 'Should allow CREATE by default if no restrictive policies match');
  console.log('[PASS] ALLOW decision verified');

  // Test 3: DENY Decision (Override)
  console.log('[TEST] DENY Decision (Override)');
  engine.registerPolicy({
    policyId: 'DENY-CREATE-TEST',
    policyVersion: '1.0.0',
    name: 'Deny Create',
    scope: 'GLOBAL',
    priority: 1000,
    conditions: [{ field: 'operation', operator: 'EQUALS', value: 'CREATE' }],
    effect: 'DENY',
    status: 'ACTIVE',
    createdAt: '', updatedAt: '', schemaVersion: ''
  });
  const d3 = engine.evaluate(context);
  assert(d3.overallEffect === 'DENY', 'High-priority DENY must override');
  console.log('[PASS] DENY override verified');

  // Test 4: REQUIRE_VERIFICATION
  console.log('[TEST] REQUIRE_VERIFICATION');
  // Using INITIAL_SECP_POLICIES: SIM-CERT-001 requires state VERIFIED for certification
  const certContext = {
    subject: { identityId: 'SIM-1', objectType: 'SIMULATION' as any, projectId: 'P1', revisionId: '1', objectVersion: 1, createdBy: 'U1', contentHash: 'H1', timestamp: 'T1' },
    operation: 'TRANSITION_CERTIFIED',
    state: { stateType: 'COMPLETED' } as any, // Not VERIFIED
    actor: { id: 'U1', type: 'USER', capabilities: [] }
  };
  const d4 = engine.evaluate(certContext);
  assert(d4.decisions.some(d => d.effect === 'REQUIRE_VERIFICATION'), 'Should require verification for non-verified simulation certification');
  console.log('[PASS] REQUIRE_VERIFICATION verified');

  // Test 5: Integration with EngineeringObjectOS
  console.log('[TEST] Integration with EngineeringObjectOS');
  try {
    os.register({
      id: 'OBJ-POLICY-1',
      objectType: 'DESIGN' as any,
      metadata: {},
      author: 'U1'
    });
    assert.fail('Should have thrown error due to active DENY policy');
  } catch (e: any) {
    assert(e.message.includes('Registration Rejected by Policy'), 'OS must respect policy engine rejection');
  }
  console.log('[PASS] OS integration verified');

  // Test 6: Hard Acceptance Gate
  console.log('[TEST] Hard Acceptance Gate');
  const report = HardAcceptanceGate159.auditPolicyEngine();
  console.log(`Gate Verdict: ${report.verdict}`);
  report.details.forEach(d => console.log(` - ${d}`));
  assert(report.verdict === 'PASS', 'Gate must pass for production readiness');

  console.log('--- TEST RESULTS ---');
  console.log('[SUCCESS] PATCH-159 Policy Engine fully verified.');
}

runPolicyTestBattery().catch(e => {
  console.error(e);
  process.exit(1);
});
