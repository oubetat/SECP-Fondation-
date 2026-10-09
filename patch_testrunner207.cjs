const { HardAcceptanceGate207 } = require('./src/engine/validation/HardAcceptanceGate207');
const fs = require('fs');

try {
    const gate = new HardAcceptanceGate207();
    const result = gate.evaluate();
    console.log("=== HARD ACCEPTANCE GATE 207 RESULTS ===");
    console.log(JSON.stringify(result, null, 2));

    const report = {
        patch: 'PATCH-207',
        title: 'Parametric + Direct Hybrid Modeling Engine',
        timestamp: new Date().toISOString(),
        verdict: result.verdict,
        checks: result.checks
    };

    fs.writeFileSync('/PATCH-207-REPORT.json', JSON.stringify(report, null, 2));
    console.log("Report written to /PATCH-207-REPORT.json");

    if (result.verdict !== 'PROVEN') {
        process.exit(1);
    }
} catch (e) {
    console.error("Test execution failed:", e);
    process.exit(1);
}
