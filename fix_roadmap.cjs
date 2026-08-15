const fs = require('fs');
let content = fs.readFileSync('src/engine/validation/SECPMasterRoadmapManager.ts', 'utf-8');
content = content.replace(
  "status: 'PLANNED' | 'LOCKED_FROZEN' | 'IN_DEVELOPMENT';",
  "status: 'PLANNED' | 'LOCKED_FROZEN' | 'IN_DEVELOPMENT' | 'COMPLIANT_ACTIVE';"
);
fs.writeFileSync('src/engine/validation/SECPMasterRoadmapManager.ts', content);
