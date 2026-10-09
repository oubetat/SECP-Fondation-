import { CFDBenchmarkBattery } from './src/engine/benchmark/cfd/CFDBenchmarkBattery';
const report = CFDBenchmarkBattery.runCompleteBattery();
console.log(JSON.stringify(report.tests.filter(t => !t.passed), null, 2));
