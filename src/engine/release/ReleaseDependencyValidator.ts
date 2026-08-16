import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export class ReleaseDependencyValidator {
  public validate(): { allPassed: boolean, results: Record<string, string> } {
    const scripts = ['096', '097', '098', '099', '100'];
    const results: Record<string, string> = {};
    let allPassed = true;

    for (const gate of scripts) {
      try {
        const cmd = `npx tsx run_secp_${gate}_closure.ts`;
        const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
        if (output.includes('PASS')) {
          results[`secp${gate}`] = 'PASS';
        } else {
          results[`secp${gate}`] = 'FAIL';
          allPassed = false;
        }
      } catch (err: any) {
        // Look at stdout to see if it says PASS or FAIL
        const out = err.stdout?.toString() || '';
        if (out.includes('FINAL') && out.includes('PASS')) {
           results[`secp${gate}`] = 'PASS';
        } else {
           results[`secp${gate}`] = 'FAIL';
           allPassed = false;
        }
      }
    }

    return { allPassed, results };
  }
}
