import { HardAcceptanceGate201 } from './src/engine/cad/multibody/HardAcceptanceGate201';

async function run() {
  const result = await HardAcceptanceGate201.evaluateAll();
  console.log(JSON.stringify(result, null, 2));
}

run();
