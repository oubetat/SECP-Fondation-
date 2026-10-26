set -euo pipefail

DIR="qualification-002/integrated-physics-evidence-reconciliation"

test -d "$DIR"

for f in \
  convergence-iteration-trace.json \
  interface-moment-audit.json \
  structural-reference-accuracy.json \
  adversarial-assertion-audit.json \
  source-binding.json \
  reconciliation-defect-register.json \
  closure-verdict.json
do
  test -s "$DIR/$f"
  node -e '
    const fs = require("node:fs");
    const p = process.argv[1];
    JSON.parse(fs.readFileSync(p, "utf8"));
    console.log("JSON_VALID:", p);
  ' "$DIR/$f"
done

printf '\n--- CLOSURE VERDICT ---\n'
cat "$DIR/closure-verdict.json"

printf '\n--- CONVERGENCE TRACE ---\n'
cat "$DIR/convergence-iteration-trace.json"

printf '\n--- INTERFACE MOMENT AUDIT ---\n'
cat "$DIR/interface-moment-audit.json"

printf '\n--- STRUCTURAL ACCURACY ---\n'
cat "$DIR/structural-reference-accuracy.json"

printf '\n--- ADVERSARIAL ASSERTION AUDIT ---\n'
cat "$DIR/adversarial-assertion-audit.json"

printf '\n--- SOURCE BINDING ---\n'
cat "$DIR/source-binding.json"

printf '\n--- DEFECT REGISTER ---\n'
cat "$DIR/reconciliation-defect-register.json"
