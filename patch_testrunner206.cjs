const { execSync } = require('child_process');
const fs = require('fs');

console.log('Running PATCH-206 Acceptance Gate...');
try {
    const output = execSync('npx tsx src/engine/validation/run_hag206.ts', { encoding: 'utf-8' });
    console.log(output);
    // Find the JSON part
    const jsonStr = output.substring(output.indexOf('{'));
    const result = JSON.parse(jsonStr);
    if (result.verdict === 'PROVEN') {
        fs.writeFileSync('PATCH-206-REPORT.json', JSON.stringify(result, null, 2));
        fs.writeFileSync('PATCH-206-REPORT.md', `# PATCH-206 Verification\n\nVerdict: **PROVEN**\n\nChecks Passed: ${result.checks.length}`);
        console.log('PATCH-206 successfully verified.');
    }
} catch (e) {
    console.error('FAILED:', e.stdout || e.message);
    process.exit(1);
}
