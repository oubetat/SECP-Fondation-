export * from "./types";
export * from "./dbTypes";
export * from "./MaterialPropertyResolver";
export * from "./MaterialIdentityManager";
export * from "./MaterialRegistry";
export * from "./MaterialSubstitutionEngine";
export * from "./MaterialDatabaseService";
export * from "./ImportPipeline";
export * from "./MaterialSearchEngine";
export * from "./MaterialResolver";
export * from "./IndependentMaterialAuditor";
export * from "./IndependentMaterialDatabaseAuditor";
export * from "./HardAcceptanceGate089";
export * from "./HardAcceptanceGate090";
export * from "./generateReports089";
export * from "./generateReports090";
export * from "./temperature";
export * from "./plasticity";
export * from "./creep";
export * from "./fatigue";
export * from "./fracture";
export * from "./heattreatment";

// PATCH-266
export * from "./MaterialDatabase266Types";
export * from "./MaterialUnitService";
export * from "./MaterialLibrary266";
export * from "./MaterialTestBattery266";
export * from "./HardAcceptanceGate266";

// PATCH-267
export * from "./MaterialPropertyService267";
export * from "./MaterialPropertyTestBattery267";
export * from "./HardAcceptanceGate267";
export type { 
  MaterialProperty as MaterialProperty267,
  MaterialPropertySnapshot as MaterialPropertySnapshot267,
  PropertySource as PropertySource267,
  PropertySourceType as PropertySourceType267
} from "./MaterialPropertyTypes267";

// PATCH-268
export * from "./TemperaturePropertyService268";
export * from "./MaterialPropertyTestBattery268";
export * from "./HardAcceptanceGate268";
export type {
  TemperatureDependentProperty as TemperatureDependentProperty268,
  InterpolationPolicy as InterpolationPolicy268,
  TemperatureUnit as TemperatureUnit268
} from "./TemperaturePropertyTypes268";

// PATCH-269
export * from "./FatigueTypes269";
export * from "./RainflowCycleCounter269";
export * from "./FatigueAnalysisService269";
export * from "./FatigueTestBattery269";
export * from "./HardAcceptanceGate269";

// PATCH-270
export type {
  StressTensor3D,
  FailureCriterionType270,
  FailureModelDefinition270,
  FailureEvaluationResult270,
  CrackModel270,
  FailureAnalysisSnapshot270,
  FEMFailureFieldResult270,
  PrincipalStressResult
} from "./FailureTypes270";
export * from "./FailureModelRegistry270";
export * from "./FailureAnalysisEngine270";
export * from "./FailureTestBattery270";
export * from "./HardAcceptanceGate270";

// PATCH-271
export * from "./SafetyTypes271";
export * from "./SafetyFactorMethodRegistry271";
export * from "./SafetyFactorEngine271";
export * from "./SafetyTestBattery271";
export * from "./HardAcceptanceGate271";

// PATCH-272
export * from "./OptimizationTypes272";
export * from "./EngineeringOptimizationEngine272";
export * from "./HardAcceptanceGate272";

// PATCH-273
export * from "./ParameterOptimizationTypes273";
export * from "./ParameterOptimizationEngine273";
export * from "./ParameterDependencyEngine273";
export * from "./CADParameterRegenerationEngine273";
export * from "./ParameterSensitivityEngine273";
export * from "./ParameterTestBattery273";
export * from "./HardAcceptanceGate273";

// PATCH-274
export * from "./TopologyOptimizationTypes274";
export * from "./TopologyOptimizationEngine274";
export * from "./TopologyTestBattery274";
export * from "./HardAcceptanceGate274";

// PATCH-275
export type {
  DesignVariable as DesignVariable275,
  DesignCandidate as DesignCandidate275,
  ParetoFront as ParetoFront275,
  DesignSpaceExplorationStudy,
  AICandidateProposal,
  SamplingStrategy,
  HardDesignRule as DesignSpaceHardRule
} from "./DesignSpaceExplorationTypes275";
export * from "./DesignSpaceExplorationEngine275";
export * from "./DesignSpaceTestBattery275";
export * from "./HardAcceptanceGate275";

export * from "./MaterialDatabaseWorkspace";
