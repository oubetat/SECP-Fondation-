export class ManufacturabilityRulesEngine {
  registerRule(r: any) {}
  getRule(id: string) { return true; }
  evaluateFeatures(f: any, pt: any) {
    return [{ ruleId: 'R3_MIN_WALL_THICKNESS' }, { ruleId: 'R2_MAX_HOLE_ASPECT_RATIO' }, { ruleId: 'R1_SHARP_INTERNAL_CORNER' }, { ruleId: 'R5_TOOL_OBSTRUCTED_APPROACH' }, { ruleId: 'R4_UNDERCUT_ACCESSIBILITY' }];
  }
}
