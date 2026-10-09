import { runBooleanQualificationSuite } from './src/engine/benchmark/boolean/BooleanQualificationSuite.js';

runBooleanQualificationSuite().then((results: any) => {
  for (const r of results) {
    if (r.caseId === 'CASE_A04_CYLINDER_UNION_BOX' || r.caseId === 'CASE_A05_CYLINDER_INTERSECTION_BOX') {
      console.log(`\n[${r.caseId}] -> Verdict: ${r.verdict}`);
      if (r.diagnostics) {
         for(const d of r.diagnostics) console.log(`   └─ ${d}`);
      }
    }
  }
}).catch(console.error);
