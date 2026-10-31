
import { HardAcceptanceGate020 } from './src/engine/cad-kernel/healing/HardAcceptanceGate020';

const report = HardAcceptanceGate020.evaluateAll();
console.log(JSON.stringify(report, null, 2));
