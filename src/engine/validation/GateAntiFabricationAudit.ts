import * as fs from 'fs';
import * as path from 'path';

export class GateAntiFabricationAudit {
  public static auditGates(): { passed: boolean; violations: string[] } {
    const violations: string[] = [];
    const validationDir = path.join(process.cwd(), 'src', 'engine', 'validation');

    if (!fs.existsSync(validationDir)) {
      return { passed: true, violations: [] };
    }

    const files = fs.readdirSync(validationDir);

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) {
        continue;
      }

      const filePath = path.join(validationDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for hardcoded PASS, but ignore type definitions
        if (!line.includes('|') && !line.includes('type ') && !line.includes('interface ')) {
          if (line.match(/return\s*'PASS'/) || line.match(/return\s*\{\s*(verdict|status|passed):\s*('PASS'|true)/) || line.match(/status:\s*'PASS'/)) {
            violations.push(`Violation in ${file}:${i + 1} - Hardcoded PASS detected: "${line}"`);
          }
        }
        
        // Check for catch returning PASS or success
        if (line.includes('catch') && i + 1 < lines.length) {
             const nextLine = lines[i+1].trim();
             if ((nextLine.includes('PASS') || nextLine.includes('true')) && !nextLine.includes('false')) {
                violations.push(`Violation in ${file}:${i + 1} - Catch block hiding error and returning PASS/true.`);
             }
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }
}
