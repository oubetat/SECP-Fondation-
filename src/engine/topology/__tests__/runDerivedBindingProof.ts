import { CanonicalDerivedArtifactBindingSuite } from './CanonicalDerivedArtifactBindingSuite';
import { TopologyAdversarialRebindingSuite } from '../TopologyAdversarialRebindingSuite';

async function main() {
  console.log('=== SECP POST-TOPOLOGY-002 PROOF SUITE RUNNER ===');
  
  const bindingResult = await CanonicalDerivedArtifactBindingSuite.runSuite();
  console.log('\n--- Derived Artifact Binding Suite Results ---');
  console.log(`All Passed: ${bindingResult.allPassed}`);
  for (const [testName, pass] of Object.entries(bindingResult.testResults)) {
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${testName}`);
  }
  if (bindingResult.diagnostics.length > 0) {
    console.log('Diagnostics:', bindingResult.diagnostics);
  }

  const topoResult = TopologyAdversarialRebindingSuite.executeAdversarialProof(1);
  console.log('\n--- Topology Adversarial Rebinding Suite Results ---');
  console.log(`All Passed: ${topoResult.allPassed}`);
  for (const [crit, pass] of Object.entries(topoResult.criteriaResults)) {
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${crit}`);
  }

  if (bindingResult.allPassed && topoResult.allPassed) {
    console.log('\n>>> POST-TOPOLOGY-002 PROOF SUITE VERDICT: PASS <<<');
  } else {
    console.log('\n>>> POST-TOPOLOGY-002 PROOF SUITE VERDICT: FAIL <<<');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error running proof suite:', err);
  process.exit(1);
});
