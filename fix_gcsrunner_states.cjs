const fs = require('fs');
let code = fs.readFileSync('src/engine/benchmark/gcs/GCSRunner.ts', 'utf8');

code = code.replace(
  /if \(solveResult\.solutionState === 'INCONSISTENT' \|\| solveResult\.solutionState === 'OVER_CONSTRAINED'\) \{/g,
  "if (solveResult.solutionState === 'INCONSISTENT' || solveResult.solutionState === 'OVER_CONSTRAINED' || solveResult.solutionState === 'CONFLICTING') {"
);

code = code.replace(
  /if \(\(solveResult\.solutionState === 'FULLY_CONSTRAINED' \|\| solveResult\.solutionState === 'SOLVED'\) && geometricValidation\.satisfied\) \{/g,
  "if ((solveResult.solutionState === 'FULLY_CONSTRAINED' || solveResult.solutionState === 'SOLVED' || solveResult.solutionState === 'REDUNDANT') && geometricValidation.satisfied) {"
);

fs.writeFileSync('src/engine/benchmark/gcs/GCSRunner.ts', code);
console.log("Fixed states");
