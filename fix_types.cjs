const fs = require('fs');
let content = fs.readFileSync('src/engine/structural-physics/StructuralPhysicsTypes.ts', 'utf-8');
content = content.replace(
  "type: 'BAR_1D' | 'TRI_2D' | 'TET_3D';",
  "type: 'BAR_1D' | 'TRI_2D' | 'TET_3D' | 'QUAD_2D' | 'HEX_3D';"
);
content = content.replace(
  "export interface LoadDefinition {\n  id: string;",
  "export interface LoadDefinition {\n  id: string;\n  type?: string;"
);
fs.writeFileSync('src/engine/structural-physics/StructuralPhysicsTypes.ts', content);

let cadContent = fs.readFileSync('src/engine/parametric-cad/ParametricCADTypes.ts', 'utf-8');
cadContent = cadContent.replace(
  "export interface CADPart {\n  id: string;",
  "export interface CADPart {\n  id: string;\n  parameters?: Record<string, number>;"
);
fs.writeFileSync('src/engine/parametric-cad/ParametricCADTypes.ts', cadContent);

let roadmapContent = fs.readFileSync('src/engine/validation/SECPMasterRoadmapManager.ts', 'utf-8');
roadmapContent = roadmapContent.replace(
  "status: 'PLANNED' | 'LOCKED_FROZEN' | 'IN_DEVELOPMENT';",
  "status: 'PLANNED' | 'LOCKED_FROZEN' | 'IN_DEVELOPMENT' | 'COMPLIANT_ACTIVE';"
);
fs.writeFileSync('src/engine/validation/SECPMasterRoadmapManager.ts', roadmapContent);
