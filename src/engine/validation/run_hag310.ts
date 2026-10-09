import { HardAcceptanceGate310 } from './HardAcceptanceGate310';

const gate = new HardAcceptanceGate310();
const result = gate.evaluate();

console.log(JSON.stringify(result, null, 2));
if (result.verdict !== 'PROVEN') {
    process.exit(1);
}
