/**
 * SECP Industrial OS — EPC-018: Product Architecture Manager
 * Domain-neutral management engine for product architectures, revisions, variants,
 * component updates, change impact propagation, and CAD/CAE handoff.
 */

import {
  ArchitectureComponent,
  DigitalThreadNode,
  ProductArchitecture,
  ProductArchitectureValidationError,
  SubsystemDefinition,
  SystemInterface,
  SystemLevelParameters
} from './ProductArchitectureTypes';
import { ProductArchitectureValidator } from './ProductArchitectureValidator';
import { ArchitectureTraceabilityBridge } from './ArchitectureTraceabilityBridge';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export interface ComponentUpdateParams {
  readonly massKg?: number;
  readonly powerDrawWatts?: number;
  readonly maxThrustNewtons?: number;
  readonly materialName?: string;
  readonly isCritical?: boolean;
  readonly traceableRequirementIds?: readonly string[];
}

export interface ArchitectureDiffResult {
  readonly archIdA: string;
  readonly archIdB: string;
  readonly massDeltaKg: number;
  readonly powerDeltaWatts: number;
  readonly twrDelta: number;
  readonly enduranceDeltaMinutes: number;
  readonly componentCountDelta: number;
  readonly interfaceCountDelta: number;
  readonly modifiedComponents: readonly string[];
}

export interface ArchitectureImpactReport {
  readonly targetComponentId: string;
  readonly targetSubsystemId: string;
  readonly affectedSubsystems: readonly string[];
  readonly affectedInterfaces: readonly string[];
  readonly affectedRequirements: readonly string[];
  readonly affectedSystemParameters: readonly string[];
  readonly massImpactKg: number;
  readonly powerImpactWatts: number;
  readonly twrImpact: number;
}

export class ProductArchitectureManager {
  private architectures = new Map<string, ProductArchitecture>();
  private revisionHistory = new Map<string, ProductArchitecture[]>();

  constructor(initialArchitectures?: readonly ProductArchitecture[]) {
    if (initialArchitectures) {
      for (const arch of initialArchitectures) {
        this.registerArchitecture(arch);
      }
    }
  }

  /**
   * Registers and validates a ProductArchitecture.
   */
  public registerArchitecture(arch: ProductArchitecture): ProductArchitecture {
    const validated = ProductArchitectureValidator.validateArchitecture(arch);

    // Compute digital thread graph if missing
    const withThread: ProductArchitecture = {
      ...validated,
      digitalThreadGraph: validated.digitalThreadGraph || ArchitectureTraceabilityBridge.buildDigitalThreadGraph(validated)
    };

    // Calculate deterministic hash
    const provenanceHash = EvidenceIntegrityService.computeHash({
      architectureId: withThread.architectureId,
      productId: withThread.productId,
      revision: withThread.revision,
      variantCode: withThread.variantCode,
      systemParameters: withThread.systemParameters,
      subsystemsCount: withThread.subsystems.length,
      interfacesCount: withThread.interfaces.length
    });

    const finalArch: ProductArchitecture = {
      ...withThread,
      provenanceHash
    };

    this.architectures.set(finalArch.architectureId, finalArch);

    const history = this.revisionHistory.get(finalArch.productId) || [];
    history.push(finalArch);
    this.revisionHistory.set(finalArch.productId, history);

    return finalArch;
  }

  public getArchitecture(architectureId: string): ProductArchitecture | undefined {
    return this.architectures.get(architectureId);
  }

  public getAllArchitectures(): readonly ProductArchitecture[] {
    return Array.from(this.architectures.values());
  }

  public getRevisionsForProduct(productId: string): readonly ProductArchitecture[] {
    return this.revisionHistory.get(productId) || [];
  }

  /**
   * Updates an existing component and creates a new immutable architecture revision.
   */
  public updateComponent(
    architectureId: string,
    componentId: string,
    updates: ComponentUpdateParams,
    changeReason: string,
    author = 'Engineering Core'
  ): { updatedArchitecture: ProductArchitecture; impact: ArchitectureImpactReport } {
    const current = this.architectures.get(architectureId);
    if (!current) {
      throw new ProductArchitectureValidationError(`Architecture ${architectureId} not found`, 'ARCH_NOT_FOUND');
    }

    let foundComponent: ArchitectureComponent | null = null;
    let targetSubsystemId = '';

    const newSubsystems: SubsystemDefinition[] = current.subsystems.map(sub => {
      let subMass = 0;
      let subPower = 0;

      const newComponents = sub.components.map(comp => {
        if (comp.componentId === componentId) {
          foundComponent = comp;
          targetSubsystemId = sub.subsystemId;

          const updatedComp: ArchitectureComponent = {
            ...comp,
            physical: {
              ...comp.physical,
              massKg: updates.massKg !== undefined ? updates.massKg : comp.physical.massKg,
              materialName: updates.materialName !== undefined ? updates.materialName : comp.physical.materialName
            },
            electrical: comp.electrical
              ? {
                  ...comp.electrical,
                  powerDrawWatts:
                    updates.powerDrawWatts !== undefined
                      ? updates.powerDrawWatts
                      : comp.electrical.powerDrawWatts
                }
              : undefined,
            performance: comp.performance
              ? {
                  ...comp.performance,
                  maxThrustNewtons:
                    updates.maxThrustNewtons !== undefined
                      ? updates.maxThrustNewtons
                      : comp.performance.maxThrustNewtons
                }
              : undefined,
            isCritical: updates.isCritical !== undefined ? updates.isCritical : comp.isCritical,
            traceableRequirementIds:
              updates.traceableRequirementIds !== undefined
                ? updates.traceableRequirementIds
                : comp.traceableRequirementIds
          };

          subMass += updatedComp.physical.massKg * (updatedComp.quantity || 1);
          subPower += (updatedComp.electrical?.powerDrawWatts || 0) * (updatedComp.quantity || 1);
          return updatedComp;
        }

        subMass += comp.physical.massKg * (comp.quantity || 1);
        subPower += (comp.electrical?.powerDrawWatts || 0) * (comp.quantity || 1);
        return comp;
      });

      return {
        ...sub,
        components: newComponents,
        totalMassKg: Number(subMass.toFixed(4)),
        totalPowerDrawWatts: Number(subPower.toFixed(1))
      };
    });

    if (!foundComponent) {
      throw new ProductArchitectureValidationError(
        `Component ${componentId} not found in architecture ${architectureId}`,
        'COMPONENT_NOT_FOUND'
      );
    }

    // Increment revision
    const prevRevNum = parseFloat(current.revision) || 1.0;
    const nextRevision = (prevRevNum + 0.1).toFixed(1);
    const newArchId = `ARCH-${current.productId}-${current.variantCode}-REV${nextRevision.replace('.', '_')}`;

    // Recalculate system parameters
    const recalculatedParams = this.recalculateSystemParameters(newSubsystems, current.systemParameters);

    // Compute Impact
    const impact = this.computeChangeImpact(
      current,
      foundComponent,
      targetSubsystemId,
      updates,
      recalculatedParams
    );

    const now = new Date().toISOString();
    const updatedArch: ProductArchitecture = {
      ...current,
      architectureId: newArchId,
      revision: nextRevision,
      subsystems: newSubsystems,
      systemParameters: recalculatedParams,
      metadata: {
        ...current.metadata,
        updatedAt: now,
        author,
        domain: current.metadata.domain
      }
    };

    const registered = this.registerArchitecture(updatedArch);
    return { updatedArchitecture: registered, impact };
  }

  /**
   * Recalculates System Level Parameters based on modified subsystems.
   */
  public recalculateSystemParameters(
    subsystems: readonly SubsystemDefinition[],
    baseParams: SystemLevelParameters
  ): SystemLevelParameters {
    let totalMassKg = 0;
    let structuralMassKg = 0;
    let propulsionMassKg = 0;
    let batteryMassKg = 0;
    let payloadMassKg = 0;
    let avionicsMassKg = 0;
    let landingGearMassKg = 0;

    let weightedX = 0;
    let weightedY = 0;
    let weightedZ = 0;

    for (const sub of subsystems) {
      for (const comp of sub.components) {
        const compMass = comp.physical.massKg * (comp.quantity || 1);
        totalMassKg += compMass;

        weightedX += compMass * comp.physical.centerOfGravity.x;
        weightedY += compMass * comp.physical.centerOfGravity.y;
        weightedZ += compMass * comp.physical.centerOfGravity.z;

        if (sub.category === 'AIRFRAME') structuralMassKg += compMass;
        else if (sub.category === 'PROPULSION') propulsionMassKg += compMass;
        else if (sub.category === 'BATTERY') batteryMassKg += compMass;
        else if (sub.category === 'PAYLOAD') payloadMassKg += compMass;
        else if (sub.category === 'LANDING_GEAR') landingGearMassKg += compMass;
        else if (sub.category === 'AVIONICS') avionicsMassKg += compMass;
      }
    }

    const totalSystemMass = Number(totalMassKg.toFixed(4));
    const cg = {
      x: Number((weightedX / totalSystemMass).toFixed(4)),
      y: Number((weightedY / totalSystemMass).toFixed(4)),
      z: Number((weightedZ / totalSystemMass).toFixed(4))
    };

    const massBreakdown = {
      ...baseParams.massBreakdown,
      totalMassKg: totalSystemMass,
      structuralMassKg: Number(structuralMassKg.toFixed(4)),
      propulsionMassKg: Number(propulsionMassKg.toFixed(4)),
      batteryMassKg: Number(batteryMassKg.toFixed(4)),
      payloadMassKg: Number(payloadMassKg.toFixed(4)),
      avionicsMassKg: Number(avionicsMassKg.toFixed(4)),
      landingGearMassKg: Number(landingGearMassKg.toFixed(4)),
      massMarginKg: Number((baseParams.operatingEnvelope.maxTakeoffMassKg - totalSystemMass).toFixed(3)),
      massMarginPercentage: Number(
        (((baseParams.operatingEnvelope.maxTakeoffMassKg - totalSystemMass) / baseParams.operatingEnvelope.maxTakeoffMassKg) * 100).toFixed(1)
      )
    };

    const hoverThrustRequiredNewtons = Number((totalSystemMass * 9.80665).toFixed(2));
    const thrustToWeightRatio = Number((baseParams.flightMetrics.totalMaxThrustNewtons / hoverThrustRequiredNewtons).toFixed(2));
    const hoverThrottlePercentage = Number(((1 / thrustToWeightRatio) * 100).toFixed(1));

    const hoverPowerWatts = Number((totalSystemMass * 122.0).toFixed(1));
    const totalHoverPowerWatts = hoverPowerWatts + baseParams.powerBudget.avionicsAndPayloadPowerWatts;
    const estimatedHoverEnduranceMinutes = Number(
      ((baseParams.powerBudget.usableEnergyWh / totalHoverPowerWatts) * 60).toFixed(1)
    );

    const flightMetrics = {
      ...baseParams.flightMetrics,
      hoverThrustRequiredNewtons,
      thrustToWeightRatio,
      hoverThrottlePercentage,
      estimatedHoverEnduranceMinutes
    };

    const powerBudget = {
      ...baseParams.powerBudget,
      hoverPowerWatts: totalHoverPowerWatts
    };

    return {
      ...baseParams,
      massBreakdown,
      centerOfGravity: cg,
      flightMetrics,
      powerBudget
    };
  }

  private computeChangeImpact(
    current: ProductArchitecture,
    comp: ArchitectureComponent,
    subsystemId: string,
    updates: ComponentUpdateParams,
    newParams: SystemLevelParameters
  ): ArchitectureImpactReport {
    const affectedSubsystems = new Set<string>([subsystemId]);
    const affectedInterfaces: string[] = [];

    // Find affected interfaces
    for (const iface of current.interfaces) {
      if (iface.sourceComponentId === comp.componentId || iface.targetComponentId === comp.componentId) {
        affectedInterfaces.push(iface.interfaceId);
        affectedSubsystems.add(iface.sourceSubsystemId);
        affectedSubsystems.add(iface.targetSubsystemId);
      }
    }

    const affectedRequirements = Array.from(new Set(comp.traceableRequirementIds));
    const affectedSystemParameters = ['totalMassKg', 'centerOfGravity', 'thrustToWeightRatio', 'hoverEnduranceMinutes'];

    const massImpactKg = Number((newParams.massBreakdown.totalMassKg - current.systemParameters.massBreakdown.totalMassKg).toFixed(4));
    const powerImpactWatts = Number(
      (newParams.powerBudget.hoverPowerWatts - current.systemParameters.powerBudget.hoverPowerWatts).toFixed(1)
    );
    const twrImpact = Number((newParams.flightMetrics.thrustToWeightRatio - current.systemParameters.flightMetrics.thrustToWeightRatio).toFixed(2));

    return {
      targetComponentId: comp.componentId,
      targetSubsystemId: subsystemId,
      affectedSubsystems: Array.from(affectedSubsystems),
      affectedInterfaces,
      affectedRequirements,
      affectedSystemParameters,
      massImpactKg,
      powerImpactWatts,
      twrImpact
    };
  }

  /**
   * Compares two product architecture variants or revisions.
   */
  public compareArchitectures(archIdA: string, archIdB: string): ArchitectureDiffResult {
    const archA = this.architectures.get(archIdA);
    const archB = this.architectures.get(archIdB);

    if (!archA || !archB) {
      throw new ProductArchitectureValidationError('One or both architectures not found for comparison', 'ARCH_NOT_FOUND');
    }

    const massDeltaKg = Number((archB.systemParameters.massBreakdown.totalMassKg - archA.systemParameters.massBreakdown.totalMassKg).toFixed(4));
    const powerDeltaWatts = Number(
      (archB.systemParameters.powerBudget.hoverPowerWatts - archA.systemParameters.powerBudget.hoverPowerWatts).toFixed(1)
    );
    const twrDelta = Number((archB.systemParameters.flightMetrics.thrustToWeightRatio - archA.systemParameters.flightMetrics.thrustToWeightRatio).toFixed(2));
    const enduranceDeltaMinutes = Number(
      (archB.systemParameters.flightMetrics.estimatedHoverEnduranceMinutes - archA.systemParameters.flightMetrics.estimatedHoverEnduranceMinutes).toFixed(1)
    );

    const compsA = new Map(archA.subsystems.flatMap(s => s.components).map(c => [c.componentId, c]));
    const compsB = new Map(archB.subsystems.flatMap(s => s.components).map(c => [c.componentId, c]));

    const modifiedComponents: string[] = [];
    for (const [id, cB] of compsB.entries()) {
      const cA = compsA.get(id);
      if (!cA || cA.physical.massKg !== cB.physical.massKg || cA.quantity !== cB.quantity) {
        modifiedComponents.push(id);
      }
    }

    return {
      archIdA,
      archIdB,
      massDeltaKg,
      powerDeltaWatts,
      twrDelta,
      enduranceDeltaMinutes,
      componentCountDelta: compsB.size - compsA.size,
      interfaceCountDelta: archB.interfaces.length - archA.interfaces.length,
      modifiedComponents
    };
  }
}
