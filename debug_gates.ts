import { HardAcceptanceGateP7 } from './src/engine/collision-authority/HardAcceptanceGateP7';
import { HardAcceptanceGateP8 } from './src/engine/collision-authority/HardAcceptanceGateP8';

async function debug() {
  console.log('--- P7 GATE DEBUG ---');
  const p7 = await HardAcceptanceGateP7.evaluate();
  p7.gates.filter(g => !g.passed).forEach(g => {
    console.log(`FAIL ${g.gateId}: ${g.requirement} -> ${g.evidence}`);
  });

  console.log('\n--- P8 GATE DEBUG ---');
  const p8 = await HardAcceptanceGateP8.evaluate();
  p8.gates.filter(g => !g.passed).forEach(g => {
    console.log(`FAIL ${g.gateId}: ${g.requirement} -> ${g.evidence}`);
  });
}

debug();
