/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Machining Setup Analyzer
 */

import { ManufacturingFeature, MachiningSetup, ToolAccessDirection } from './FeatureTypes';
import { FeatureAccessibilityAnalyzer } from './FeatureAccessibilityAnalyzer';

export class MachiningSetupAnalyzer {
  /**
   * Partitions manufacturing features into optimal setups minimizing part re-fixturing
   */
  public static planMachiningSetups(features: ManufacturingFeature[]): MachiningSetup[] {
    const setupMap = new Map<ToolAccessDirection, ManufacturingFeature[]>();

    // Default primary orientations
    for (const f of features) {
      const dir = f.accessibility.primaryAccessDirection;
      if (!setupMap.has(dir)) {
        setupMap.set(dir, []);
      }
      setupMap.get(dir)!.push(f);
    }

    const setups: MachiningSetup[] = [];
    let setupIndex = 1;

    // Prioritize +Z as Setup 1 (Top Fixture)
    const priorityDirs = [
      ToolAccessDirection.POS_Z,
      ToolAccessDirection.NEG_Z,
      ToolAccessDirection.POS_X,
      ToolAccessDirection.NEG_X,
      ToolAccessDirection.POS_Y,
      ToolAccessDirection.NEG_Y,
      ToolAccessDirection.OBLIQUE,
    ];

    for (const dir of priorityDirs) {
      const featList = setupMap.get(dir);
      if (featList && featList.length > 0) {
        const orientationVec = FeatureAccessibilityAnalyzer.directionToVector(dir);
        const setupName = `Setup ${setupIndex} — ${dir} [${orientationVec.x}, ${orientationVec.y}, ${orientationVec.z}]`;

        const estimatedOps = featList.map(feat => {
          let recTool = 'Endmill Ø12mm';
          if (feat.type.includes('HOLE')) {
            const d = feat.parameters.type === 'HOLE' ? feat.parameters.params.diameterMm : 10;
            recTool = `Carbide Drill Ø${d.toFixed(1)}mm`;
          } else if (feat.type.includes('POCKET')) {
            const w = feat.parameters.type === 'POCKET' ? feat.parameters.params.widthMm : 20;
            const toolDia = Math.min(16, Math.max(6, Math.floor(w * 0.6)));
            recTool = `Roughing Endmill Ø${toolDia}mm`;
          } else if (feat.type === 'FACING_REGION') {
            recTool = 'Face Mill Ø50mm 45°';
          } else if (feat.type.includes('CHAMFER')) {
            recTool = 'Chamfer Mill 45° Ø12mm';
          } else if (feat.type.includes('FILLET')) {
            recTool = 'Corner Rounding Endmill';
          }

          return {
            featureId: feat.id,
            operationType: feat.intent,
            toolRecommendation: recTool,
          };
        });

        setups.push({
          id: `SETUP_${setupIndex}_${dir.replace('+', 'P_').replace('-', 'N_')}`,
          name: setupName,
          orientation: dir,
          orientationVector: orientationVec,
          features: featList,
          estimatedOperations: estimatedOps,
        });

        setupIndex++;
      }
    }

    return setups;
  }
}
