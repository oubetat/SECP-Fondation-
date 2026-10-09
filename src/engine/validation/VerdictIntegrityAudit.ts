import * as fs from 'fs';
import * as path from 'path';

export class VerdictIntegrityAudit {
  public static audit(): { passed: boolean; violations: any[] } {
    const violations: any[] = [];
    const srcDir = path.join(process.cwd(), 'src', 'engine');
    
    const walkSync = (dir: string, filelist: string[] = []) => {
      if (!fs.existsSync(dir)) return filelist;
      fs.readdirSync(dir).forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
          filelist = walkSync(filepath, filelist);
        } else {
          if (filepath.endsWith('.ts') && !filepath.includes('__tests__') && !filepath.includes('VerdictIntegrityAudit.ts') && !filepath.includes('GateAntiFabricationAudit.ts')) {
            filelist.push(filepath);
          }
        }
      });
      return filelist;
    };

    const files = walkSync(srcDir);
    const forbiddenPatterns = [
      { regex: /forcePass\s*=/g, type: "override", desc: "Forced Pass" },
      { regex: /forceFail\s*=/g, type: "override", desc: "Forced Fail" },
      { regex: /overrideVerdict/g, type: "override", desc: "Verdict Override" },
      { regex: /skipCriterion/g, type: "override", desc: "Skipped Criterion" },
      { regex: /acceptAll\s*\(/g, type: "override", desc: "Accept All Override" },
      { regex: /return\s*['"]PASS['"]/g, type: "fabricated_pass", desc: "Hardcoded Return PASS" },
      { regex: /verdict:\s*['"]PASS['"]/g, type: "fabricated_pass", desc: "Hardcoded Object PASS" },
      { regex: /passed:\s*true/g, type: "fabricated_pass", desc: "Hardcoded passed: true" },
      { regex: /success:\s*true/g, type: "fabricated_pass", desc: "Hardcoded success: true" }
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Ignore typings and interfaces
        if (line.includes('|') || line.includes('type ') || line.includes('interface ')) return;

        forbiddenPatterns.forEach(pattern => {
          if (pattern.regex.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: index + 1,
              type: pattern.type,
              desc: pattern.desc,
              code: line.trim()
            });
          }
        });
      });
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }
}
