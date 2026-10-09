
const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('dist')) {
        results = results.concat(walk(file));
      }
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
};

const files = walk('./src');

// List of known types/interfaces mistakenly imported from lucide-react
const blackList = [
  'IndustrialCapabilityState', 'EngineeringDomain', 'EngineeringCapability',
  'ReproducibleEngineeringPackage', 'ComparisonMode', 'ReproducibilityCertificate', 'RevocationReason',
  'ProductionBenchmarkBatteryReport', 'ProductionBenchmarkCaseResult', 'Record', 'HTMLCanvasElement',
  'CADBenchmarkBatteryReport', 'CADBenchmarkResult', 'MechanismPresetId', 'ComponentKinematicState',
  'MechanicalJoint', 'MotionLink', 'MotionCollisionRecord', 'CAMTool', 'ToolHolderDefinition',
  'ToolAssembly', 'WorkpieceMaterialClass', 'ToolSnapshot', 'ToolEvidence', 'MachiningSetup',
  'ToolpathEvidence', 'HTMLDivElement', 'HTMLInputElement', 'Props', 'CertificationMatrix',
  'EngineeringChange', 'ChangeType', 'ChangePriority', 'ChangeOrigin', 'CloudProjectState',
  'ProjectCollabState', 'CollaborationSession', 'CollaborationConflict', 'EngineeringObjective',
  'HardConstraint', 'DesignAlternativeSet', 'DesignAlternative', 'ThreadProjectionView',
  'ComputeNode', 'DistributedJob', 'WorkloadType', 'ScalingMetrics303', 'EngineeringChangeOrder',
  'ElectricalComponent', 'EngineDesignStudioPanelProps', 'CopilotSession', 'CopilotResponseContract',
  'FastenerEngineeringWorkspaceProps', 'PropertyClass', 'SurfaceTreatment', 'FastenerSpecification',
  'BoltedJointStack', 'FeatureTreePanelProps', 'GCodeVerificationReport', 'HardAcceptanceResult108',
  'AdversarialSuiteSummary', 'CFDMeshData', 'CFDKernelId', 'CFDOperatorComparisonResult',
  'CFDBenchmarkMetrics', 'FEMElementType', 'GPUFEMBenchmarkResult', 'LinearAlgebraOpType',
  'LinearAlgebraJobResult', 'CSRMatrixData', 'LinearAlgebraBenchmarkReport', 'HardAcceptanceGate297Report',
  'GPUMeshData', 'MeshQualityReport', 'MeshComparisonResult', 'Name', 'Component', 'SVGSVGElement',
  'PersistentEntityId', 'SelectionType', 'DisplayMode', 'ProjectionMode', 'CaeFieldType', 'EvidenceSnapshot',
  'SimulationResolution', 'StockRepresentationType', 'StockSimulationResult', 'MaterialFamilyType',
  'MaterialSubfamilyType', 'MaterialAssignment266', 'FemMaterialExport266', 'MaterialPropertySnapshot',
  'TemperatureUnit', 'EvaluatedPropertyValue', 'BenchmarkCaseResult', 'Gate264Report', 'VerificationResult',
  'PostProcessorDefinition', 'NCProgram', 'PostProcessingEvidence', 'NCBlock', 'CAMArtifactNodeType',
  'CAMProductionEvidencePackage', 'Gate265Report', 'CAMProductionTestResult', 'EvidencePackage',
  'IndependentVerificationResult', 'IndependentAuditPackage', 'AuditClaim', 'MatrixSnapshot',
  'MatrixGateResult', 'CompetitiveCapabilityEvidence', 'CapabilityStatus', 'CertificationLevel',
  'CertificationVerdict', 'HardGateReport', 'EvaluationContext', 'EngineeringProject', 'ProjectFolder',
  'ProjectEngineeringObject', 'DependencyLink', 'ProjectMilestone', 'ProjectDocument',
  'ProjectActivityEvent', 'EngineeringObjectType', 'ProjectMemberRole', 'ProjectSnapshot',
  'NonlinearSolverType', 'NonlinearKinematicsMode', 'YieldCriterionType', 'HardeningModelType',
  'NonlinearAnalysisResult', 'HardGate238Result', 'SimPreset', 'KinematicSolverConfig',
  'SimulationState', 'SimulationEvent', 'GearEngineeringWorkspaceProps', 'GearType', 'GearMaterialGrade'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const lucideRegex = /import\s*{([^}]*)}\s*from\s*['"]lucide-react['"]/g;
  
  const updatedContent = content.replace(lucideRegex, (match, p1) => {
    let members = p1.split(',').map(m => m.trim()).filter(m => m !== '');
    let filteredMembers = members.filter(m => !blackList.includes(m));
    
    if (members.length !== filteredMembers.length) {
      changed = true;
      if (filteredMembers.length === 0) return '';
      return `import { ${filteredMembers.join(', ')} } from 'lucide-react'`;
    }
    return match;
  });

  if (changed) {
    console.log(`Cleaning imports in ${file}`);
    fs.writeFileSync(file, updatedContent);
  }
});
