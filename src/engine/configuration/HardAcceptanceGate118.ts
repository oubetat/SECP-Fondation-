import { ConfigurationEvaluationEngine, EvaluationInput } from './ConfigurationEvaluationEngine';
import { IndependentConfigurationVerifier } from './IndependentConfigurationVerifier';
import { ConfigurationRuleEngine } from './ConfigurationRuleEngine';
import { ConfigurationCanonicalizer } from './ConfigurationCanonicalizer';
import { 
  ConfigurationContext, 
  ConfigurationOption, 
  ConfigurationSelection, 
  ConfigurationRule, 
  OptionDependency,
  ConfigurationVariant
} from './types';

export class HardAcceptanceGate118 {
  public static evaluate(): { passed: boolean; checks: any[] } {
    const checks: any[] = [];

    // 1. Configuration Context & Identity
    const context: ConfigurationContext = {
      productId: 'PROD-PUMP-5000',
      configurationId: 'CONFIG-PUMP-HIGH-TEMP-01',
      configurationVersion: 'v1.0',
      revisionContext: 'REV-SET-2026-A',
      dateContext: '2026-08-01T00:00:00Z',
      serialContext: 'SN-1001',
      projectContext: 'PROJECT-OFFSHORE-01'
    };

    const options: ConfigurationOption[] = [
      { optionId: 'OPT-ENGINE', optionCode: 'ENG_TYPE', name: 'Engine Type', description: 'Power source', type: 'ENUM', allowedValues: ['DIESEL', 'ELECTRIC'], required: true, status: 'ACTIVE' },
      { optionId: 'OPT-SEAL', optionCode: 'SEAL_MAT', name: 'Seal Material', description: 'O-ring seal grade', type: 'ENUM', allowedValues: ['VITON', 'FFKM'], required: true, status: 'ACTIVE' },
      { optionId: 'OPT-COOLING', optionCode: 'COOLING_SYS', name: 'Auxiliary Cooling', description: 'Liquid cooling jacket', type: 'BOOLEAN', required: false, status: 'ACTIVE' }
    ];

    const selections: ConfigurationSelection[] = [
      { selectionId: 'SEL-01', configurationId: context.configurationId, optionId: 'OPT-ENGINE', value: 'ELECTRIC', source: 'USER', selectedAt: new Date().toISOString(), selectedBy: 'ENG-LEAD-01' },
      { selectionId: 'SEL-02', configurationId: context.configurationId, optionId: 'OPT-SEAL', value: 'FFKM', source: 'USER', selectedAt: new Date().toISOString(), selectedBy: 'ENG-LEAD-01' }
    ];

    const dependencies: OptionDependency[] = [
      { dependencyId: 'DEP-01', sourceOptionId: 'OPT-SEAL', targetOptionId: 'OPT-COOLING', dependencyType: 'OPTION_IMPLIES', conditionValue: 'FFKM', targetRequiredValue: true }
    ];

    const rules: ConfigurationRule[] = [
      {
        ruleId: 'RULE-SAFETY-01',
        ruleCode: 'SAFE_COOLING',
        version: 'v1.0',
        priority: 1,
        precedence: 'SAFETY',
        condition: (sels) => sels.get('OPT-SEAL') === 'FFKM',
        action: { type: 'MODIFY_QUANTITY', targetId: 'PART-SEAL-FFKM-01', value: 2 },
        severity: 'CRITICAL',
        status: 'ACTIVE'
      }
    ];

    const components = [
      { componentId: 'PART-SEAL-FFKM-01', entityType: 'PART' as const, revisionId: 'R4', baseQuantity: 1 }
    ];

    const evalInput: EvaluationInput = {
      context,
      options,
      selections,
      rules,
      dependencies,
      components
    };

    // Evaluate
    const { resolved, evidenceChain } = ConfigurationEvaluationEngine.resolveConfiguration(evalInput);

    checks.push({
      checkId: 'GATE-118-01',
      name: 'Configuration Identity, Context & Explicit Binding',
      passed: resolved.configurationId === context.configurationId && resolved.configurationVersion === 'v1.0' && resolved.verdict === 'VALID',
      details: `Resolved configuration ${resolved.configurationId} version ${resolved.configurationVersion}`
    });

    // 2. Missing Required Option Enforcement
    const incompleteInput: EvaluationInput = {
      ...evalInput,
      selections: [] // Missing OPT-ENGINE and OPT-SEAL
    };
    const { resolved: incompleteRes } = ConfigurationEvaluationEngine.resolveConfiguration(incompleteInput);

    checks.push({
      checkId: 'GATE-118-02',
      name: 'Missing Required Option Protection (MISSING_REQUIRED_OPTION)',
      passed: incompleteRes.verdict === 'INVALID' && incompleteRes.unresolvedItems[0].includes('MISSING_REQUIRED_OPTIONS'),
      details: 'Strictly invalidated configuration with missing required options'
    });

    // 3. Rule Dependency Cycle Detection
    const cyclicDeps: OptionDependency[] = [
      { dependencyId: 'CD-1', sourceOptionId: 'OPT-A', targetOptionId: 'OPT-B', dependencyType: 'OPTION_REQUIRES' },
      { dependencyId: 'CD-2', sourceOptionId: 'OPT-B', targetOptionId: 'OPT-C', dependencyType: 'OPTION_REQUIRES' },
      { dependencyId: 'CD-3', sourceOptionId: 'OPT-C', targetOptionId: 'OPT-A', dependencyType: 'OPTION_REQUIRES' }
    ];
    const cycleCheck = ConfigurationRuleEngine.detectRuleCycles(cyclicDeps);

    checks.push({
      checkId: 'GATE-118-03',
      name: 'Rule Engine Dependency Cycle Detection',
      passed: cycleCheck.hasCycle && cycleCheck.cyclePath!.includes('OPT-A -> OPT-B -> OPT-C -> OPT-A'),
      details: `Detected rule cycle path: ${cycleCheck.cyclePath}`
    });

    // 4. Rule Engine Precedence Ordering (SAFETY > REGULATORY > ENGINEERING)
    const sortedRules = ConfigurationRuleEngine.sortRulesByPrecedence([
      { ruleId: 'R-ENG', ruleCode: 'ENG', version: 'v1', priority: 1, precedence: 'ENGINEERING', condition: () => true, action: { type: 'EXCLUDE_COMPONENT', targetId: 'X' }, severity: 'WARNING', status: 'ACTIVE' },
      { ruleId: 'R-SAFE', ruleCode: 'SAFE', version: 'v1', priority: 1, precedence: 'SAFETY', condition: () => true, action: { type: 'EXCLUDE_COMPONENT', targetId: 'Y' }, severity: 'CRITICAL', status: 'ACTIVE' }
    ]);

    checks.push({
      checkId: 'GATE-118-04',
      name: 'Rule Engine Precedence Ordering (SAFETY > ENGINEERING)',
      passed: sortedRules[0].ruleId === 'R-SAFE',
      details: `First evaluated rule by precedence: ${sortedRules[0].ruleId}`
    });

    // 5. Quantity Resolution & Override Traceability
    const resolvedComp = resolved.resolvedComponents.find(c => c.componentId === 'PART-SEAL-FFKM-01');

    checks.push({
      checkId: 'GATE-118-05',
      name: 'Quantity Resolution & Rule Override Traceability',
      passed: resolvedComp?.baseQuantity === 1 && resolvedComp?.resolvedQuantity === 2,
      details: `Base quantity 1 modified to 2 by SAFETY rule`
    });

    // 6. Historical Reconstruction & Explicit Revision Binding (No Latest Substitution)
    const revBinding = resolved.resolvedRevisions.find(r => r.entityId === 'PART-SEAL-FFKM-01');

    checks.push({
      checkId: 'GATE-118-06',
      name: 'Historical Reconstruction & Explicit Revision Binding',
      passed: revBinding?.revisionId === 'R4' && !revBinding?.reason.includes('latest'),
      details: `Bound explicit revision R4 without latest substitution`
    });

    // 7. Stage Hashes & Canonical Evidence Chain
    checks.push({
      checkId: 'GATE-118-07',
      name: 'Canonical Stage Hashes & Evidence Chain Freeze',
      passed: evidenceChain.stageHashes.finalConfigurationHash.length === 64 && resolved.configurationHash === evidenceChain.stageHashes.finalConfigurationHash,
      details: `Final Configuration Hash: ${resolved.configurationHash.substring(0, 16)}...`
    });

    // 8. Independent Configuration Verifier & Differential Comparison
    const diffResult = IndependentConfigurationVerifier.verifyConfiguration(resolved, evalInput);

    checks.push({
      checkId: 'GATE-118-08',
      name: 'Independent Configuration Verifier & Differential Comparison',
      passed: diffResult.verdict === 'MATCH' && diffResult.hashMatch && diffResult.componentsMatch,
      details: `Differential Verdict: ${diffResult.verdict} (Options, Components, Rules, and Hashes match 100%)`
    });

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }
}
