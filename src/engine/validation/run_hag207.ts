import { HardAcceptanceGate207 } from './HardAcceptanceGate207';

const gate = new HardAcceptanceGate207();
const result = gate.evaluate();

console.log(JSON.stringify(result, null, 2));
if (result.verdict !== 'PROVEN') {
    process.exit(1);
}
