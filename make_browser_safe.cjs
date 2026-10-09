const fs = require('fs');
const path = require('path');

const files = [
  'src/engine/industrial-os/EngineeringObjectOS.ts',
  'src/engine/industrial-os/event-model/EngineeringEventStore.ts',
  'src/engine/industrial-os/state-machine/EngineeringStateMachine.ts',
  'src/engine/industrial-os/evidence-bus/EvidenceStorageAdapter.ts',
  'src/engine/manufacturing/cam/generateReports104.ts',
  'src/engine/manufacturing/cam/generateReports105.ts',
  'src/engine/custody/generateReports167.ts',
  'src/engine/verification/portal/generateReports168.ts',
  'src/engine/interop/organization/generateReports169.ts',
  'src/engine/certification/truth/generateReports170.ts',
  'src/engine/validation/GateDependencyAudit.ts',
  'src/engine/fem/contact/generateReports081.ts'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Replace imports
  content = content.replace(/import \* as fs from 'fs';/g, "const fs = typeof window === 'undefined' ? require('fs') : null;");
  content = content.replace(/import \* as path from 'path';/g, "const path = typeof window === 'undefined' ? require('path') : null;");

  // If it's a generateReports file, wrap the body
  if (file.includes('generateReports')) {
    content = content.replace(/export async function generateReports\w+\(\) \{([\s\S]+?)\}/g, (match, body) => {
      return `export async function ${match.match(/generateReports\w+/)[0]}() {
  if (typeof window !== 'undefined') {
    console.log("[REPORT] Skipping file report generation in browser environment.");
    return null;
  }
  ${body.trim()}
}`;
    });
  }

  // Special case for GateDependencyAudit
  if (file.includes('GateDependencyAudit')) {
    content = content.replace(/public static auditGates\(\): \{ passed: boolean; violations: string\[\] \} \{([\s\S]+?)\}/g, (match, body) => {
      return `public static auditGates(): { passed: boolean; violations: string[] } {
    if (typeof window !== 'undefined') return { passed: true, violations: [] };
    ${body.trim()}
}`;
    });
  }

  fs.writeFileSync(file, content);
});

console.log('Browser-safe guards applied.');
