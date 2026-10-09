const fs = require('fs');

// Fix HardAcceptanceGate075
let gate = fs.readFileSync('src/engine/validation/HardAcceptanceGate075.ts', 'utf-8');
gate = gate.replace(
  "parameters: { length: 2.0 }",
  "parameters: { length: 2.0 },\n        sketches: [],\n        features: [],\n        solids: [],\n        fingerprint: 'dummy',\n        version: 1"
);
fs.writeFileSync('src/engine/validation/HardAcceptanceGate075.ts', gate);

// Fix TestRunnerPanel.tsx
let panel = fs.readFileSync('src/components/TestRunnerPanel.tsx', 'utf-8');
if (!panel.includes("import { HardAcceptanceGate075 }")) {
    panel = panel.replace(
      "import { HardAcceptanceGate074 } from '../engine/validation/HardAcceptanceGate074';",
      "import { HardAcceptanceGate074 } from '../engine/validation/HardAcceptanceGate074';\nimport { HardAcceptanceGate075 } from '../engine/validation/HardAcceptanceGate075';"
    );
    fs.writeFileSync('src/components/TestRunnerPanel.tsx', panel);
}

// Fix Roadmap
let roadmap = fs.readFileSync('src/engine/validation/SECPMasterRoadmapManager.ts', 'utf-8');
roadmap = roadmap.replace(/'COMPLIANT_ACTIVE'/g, "'LOCKED_FROZEN'");
fs.writeFileSync('src/engine/validation/SECPMasterRoadmapManager.ts', roadmap);
