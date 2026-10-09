import { HardAcceptanceGate206 } from './HardAcceptanceGate206';

const gate = new HardAcceptanceGate206();
const result = gate.evaluate();

console.log(JSON.stringify(result, null, 2));
if (result.verdict !== 'PROVEN') {
    process.exit(1);
}
