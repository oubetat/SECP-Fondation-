import { HardAcceptanceGate300 } from './HardAcceptanceGate300';

const gate = new HardAcceptanceGate300();
const result = gate.evaluate();

console.log(JSON.stringify(result, null, 2));
if (result.verdict !== 'PROVEN') {
    process.exit(1);
}
