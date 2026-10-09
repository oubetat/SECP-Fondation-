/**
 * SECP Industrial OS — EPC-018: Product Architecture Validator
 * Strict domain-neutral validation engine enforcing structural hierarchy,
 * interface graph completeness, mass/energy consistency, and traceability.
 */

import {
  ArchitectureComponent,
  EPC018ValidationResult,
  ProductArchitecture,
  ProductArchitectureValidationError,
  SubsystemDefinition,
  SystemInterface
} from './ProductArchitectureTypes';
import { UnitRegistry } from '../../core/units/UnitRegistry';

export class ProductArchitectureValidator {
  /**
   * Validates a complete ProductArchitecture document according to SECP engineering rules.
   */
  public static validateArchitecture(arch: ProductArchitecture): ProductArchitecture {
    if (!arch) {
      throw new ProductArchitectureValidationError('Architecture object cannot be null or undefined', 'NULL_ARCHITECTURE');
    }

    if (!arch.architectureId || arch.architectureId.trim() === '') {
      throw new ProductArchitectureValidationError('Architecture ID must be non-empty', 'MISSING_ARCH_ID');
    }

    if (!arch.productId || arch.productId.trim() === '') {
      throw new ProductArchitectureValidationError('Product ID must be non-empty', 'MISSING_PRODUCT_ID');
    }

    if (!arch.productName || arch.productName.trim() === '') {
      throw new ProductArchitectureValidationError('Product Name must be non-empty', 'MISSING_PRODUCT_NAME');
    }

    if (!arch.revision || arch.revision.trim() === '') {
      throw new ProductArchitectureValidationError('Architecture revision must be specified', 'MISSING_REVISION');
    }

    if (!arch.subsystems || arch.subsystems.length === 0) {
      throw new ProductArchitectureValidationError('Architecture must contain at least one subsystem', 'EMPTY_SUBSYSTEMS');
    }

    // 1. Validate Subsystems and Components
    const subsystemIds = new Set<string>();
    const componentMap = new Map<string, ArchitectureComponent>();

    for (const sub of arch.subsystems) {
      this.validateSubsystem(sub);
      if (subsystemIds.has(sub.subsystemId)) {
        throw new ProductArchitectureValidationError(`Duplicate subsystem ID: ${sub.subsystemId}`, 'DUPLICATE_SUBSYSTEM_ID');
      }
      subsystemIds.add(sub.subsystemId);

      for (const comp of sub.components) {
        if (componentMap.has(comp.componentId)) {
          throw new ProductArchitectureValidationError(`Duplicate component ID: ${comp.componentId}`, 'DUPLICATE_COMPONENT_ID');
        }
        componentMap.set(comp.componentId, comp);
      }
    }

    // 2. Drone-specific check if productType is drone
    if (arch.productType === 'INDUSTRIAL_DRONE' || arch.productType === 'DRONE' || arch.productType === 'UAV') {
      this.validateDroneCoreSubsystems(arch.subsystems);
    }

    // 3. Validate Interfaces
    if (arch.interfaces) {
      const interfaceIds = new Set<string>();
      for (const iface of arch.interfaces) {
        this.validateInterface(iface, subsystemIds, componentMap);
        if (interfaceIds.has(iface.interfaceId)) {
          throw new ProductArchitectureValidationError(`Duplicate interface ID: ${iface.interfaceId}`, 'DUPLICATE_INTERFACE_ID');
        }
        interfaceIds.add(iface.interfaceId);
      }
    }

    // 4. Validate System Level Parameters & Mass Conservation
    this.validateSystemParameters(arch, componentMap);

    return arch;
  }

  /**
   * Validates that all 6 core drone subsystems are present.
   */
  public static validateDroneCoreSubsystems(subsystems: readonly SubsystemDefinition[]): void {
    const requiredCategories = ['AIRFRAME', 'PROPULSION', 'BATTERY', 'PAYLOAD', 'LANDING_GEAR', 'AVIONICS'] as const;
    const presentCategories = new Set(subsystems.map(s => s.category));

    for (const cat of requiredCategories) {
      if (!presentCategories.has(cat)) {
        throw new ProductArchitectureValidationError(
          `Industrial Drone architecture is missing mandatory subsystem category: ${cat}`,
          'MISSING_MANDATORY_SUBSYSTEM',
          { missingCategory: cat }
        );
      }
    }
  }

  /**
   * Validates a subsystem definition.
   */
  public static validateSubsystem(sub: SubsystemDefinition): void {
    if (!sub.subsystemId || sub.subsystemId.trim() === '') {
      throw new ProductArchitectureValidationError('Subsystem ID is required', 'INVALID_SUBSYSTEM_ID');
    }
    if (!sub.name || sub.name.trim() === '') {
      throw new ProductArchitectureValidationError(`Subsystem ${sub.subsystemId} name is required`, 'INVALID_SUBSYSTEM_NAME');
    }
    if (!sub.category) {
      throw new ProductArchitectureValidationError(`Subsystem ${sub.subsystemId} must specify a category`, 'INVALID_SUBSYSTEM_CATEGORY');
    }
    if (!sub.components || sub.components.length === 0) {
      throw new ProductArchitectureValidationError(`Subsystem ${sub.subsystemId} must contain at least one component`, 'EMPTY_COMPONENTS');
    }

    let calculatedMass = 0;
    for (const comp of sub.components) {
      this.validateComponent(comp, sub.subsystemId);
      calculatedMass += comp.physical.massKg * (comp.quantity || 1);
    }

    // Check mass consistency with small numerical tolerance
    if (Math.abs(calculatedMass - sub.totalMassKg) > 1e-4) {
      throw new ProductArchitectureValidationError(
        `Subsystem ${sub.subsystemId} declared total mass (${sub.totalMassKg} kg) does not match sum of component masses (${calculatedMass.toFixed(4)} kg)`,
        'SUBSYSTEM_MASS_MISMATCH'
      );
    }
  }

  /**
   * Validates an individual component.
   */
  public static validateComponent(comp: ArchitectureComponent, expectedSubsystemId: string): void {
    if (!comp.componentId || comp.componentId.trim() === '') {
      throw new ProductArchitectureValidationError('Component ID is required', 'INVALID_COMPONENT_ID');
    }
    if (comp.subsystemId !== expectedSubsystemId) {
      throw new ProductArchitectureValidationError(
        `Component ${comp.componentId} subsystemId '${comp.subsystemId}' does not match parent '${expectedSubsystemId}'`,
        'SUBSYSTEM_ID_MISMATCH'
      );
    }
    if (!comp.name || comp.name.trim() === '') {
      throw new ProductArchitectureValidationError(`Component ${comp.componentId} name is required`, 'INVALID_COMPONENT_NAME');
    }
    if (comp.quantity <= 0) {
      throw new ProductArchitectureValidationError(`Component ${comp.componentId} quantity must be > 0`, 'INVALID_QUANTITY');
    }
    if (!comp.physical) {
      throw new ProductArchitectureValidationError(`Component ${comp.componentId} physical properties are required`, 'MISSING_PHYSICAL_PROPS');
    }
    if (comp.physical.massKg < 0) {
      throw new ProductArchitectureValidationError(`Component ${comp.componentId} mass cannot be negative`, 'INVALID_MASS');
    }
    if (
      comp.physical.dimensions.lengthMm <= 0 ||
      comp.physical.dimensions.widthMm <= 0 ||
      comp.physical.dimensions.heightMm <= 0
    ) {
      throw new ProductArchitectureValidationError(`Component ${comp.componentId} dimensions must be positive numbers`, 'INVALID_DIMENSIONS');
    }

    // If marked critical, must have traceable requirements
    if (comp.isCritical && (!comp.traceableRequirementIds || comp.traceableRequirementIds.length === 0)) {
      throw new ProductArchitectureValidationError(
        `Critical component ${comp.componentId} must have at least one traceable requirement ID`,
        'CRITICAL_COMPONENT_UNTRACED'
      );
    }
  }

  /**
   * Validates a system interface between subsystems and components.
   */
  public static validateInterface(
    iface: SystemInterface,
    subsystemIds: Set<string>,
    componentMap: Map<string, ArchitectureComponent>
  ): void {
    if (!iface.interfaceId || iface.interfaceId.trim() === '') {
      throw new ProductArchitectureValidationError('Interface ID is required', 'INVALID_INTERFACE_ID');
    }
    if (!iface.sourceSubsystemId || !subsystemIds.has(iface.sourceSubsystemId)) {
      throw new ProductArchitectureValidationError(
        `Interface ${iface.interfaceId} references non-existent source subsystem: ${iface.sourceSubsystemId}`,
        'INTERFACE_SOURCE_SUBSYSTEM_NOT_FOUND'
      );
    }
    if (!iface.targetSubsystemId || !subsystemIds.has(iface.targetSubsystemId)) {
      throw new ProductArchitectureValidationError(
        `Interface ${iface.interfaceId} references non-existent target subsystem: ${iface.targetSubsystemId}`,
        'INTERFACE_TARGET_SUBSYSTEM_NOT_FOUND'
      );
    }
    if (!iface.sourceComponentId || !componentMap.has(iface.sourceComponentId)) {
      throw new ProductArchitectureValidationError(
        `Interface ${iface.interfaceId} references non-existent source component: ${iface.sourceComponentId}`,
        'INTERFACE_SOURCE_COMPONENT_NOT_FOUND'
      );
    }
    if (!iface.targetComponentId || !componentMap.has(iface.targetComponentId)) {
      throw new ProductArchitectureValidationError(
        `Interface ${iface.interfaceId} references non-existent target component: ${iface.targetComponentId}`,
        'INTERFACE_TARGET_COMPONENT_NOT_FOUND'
      );
    }

    // Type specific checks
    if (iface.interfaceType === 'MECHANICAL' || iface.interfaceType === 'STRUCTURAL_LOAD') {
      if (!iface.mechanical || !iface.mechanical.mountType) {
        throw new ProductArchitectureValidationError(
          `Mechanical interface ${iface.interfaceId} must specify mechanical.mountType`,
          'MISSING_MECHANICAL_SPEC'
        );
      }
    }

    if (iface.interfaceType === 'ELECTRICAL_POWER') {
      if (!iface.electrical || iface.electrical.nominalVoltageV === undefined) {
        throw new ProductArchitectureValidationError(
          `Electrical power interface ${iface.interfaceId} must specify electrical.nominalVoltageV`,
          'MISSING_ELECTRICAL_SPEC'
        );
      }
    }

    if (iface.interfaceType === 'DATA_COMMUNICATION' || iface.interfaceType === 'ELECTRICAL_SIGNAL') {
      if (!iface.data || !iface.data.protocol) {
        throw new ProductArchitectureValidationError(
          `Data interface ${iface.interfaceId} must specify data.protocol`,
          'MISSING_DATA_PROTOCOL'
        );
      }
    }
  }

  /**
   * Validates mathematical consistency of system-level parameters.
   */
  public static validateSystemParameters(
    arch: ProductArchitecture,
    componentMap: Map<string, ArchitectureComponent>
  ): void {
    if (!arch.systemParameters) {
      throw new ProductArchitectureValidationError('System parameters must be present', 'MISSING_SYSTEM_PARAMETERS');
    }

    const { massBreakdown, flightMetrics, powerBudget } = arch.systemParameters;

    // Verify total mass equals sum of all components
    let totalComponentMass = 0;
    for (const comp of componentMap.values()) {
      totalComponentMass += comp.physical.massKg * (comp.quantity || 1);
    }

    if (Math.abs(totalComponentMass - massBreakdown.totalMassKg) > 0.05) {
      throw new ProductArchitectureValidationError(
        `System total mass (${massBreakdown.totalMassKg} kg) does not match sum of component masses (${totalComponentMass.toFixed(3)} kg)`,
        'MASS_CONSERVATION_ERROR'
      );
    }

    // Verify flight dynamics metrics if present (applicable for aerial vehicles / multicopters)
    if (
      flightMetrics &&
      (arch.productType === 'INDUSTRIAL_DRONE' || arch.productType === 'DRONE' || arch.productType === 'UAV' || flightMetrics.motorCount > 0)
    ) {
      if (flightMetrics.totalMaxThrustNewtons <= 0) {
        throw new ProductArchitectureValidationError('Total maximum thrust must be > 0 N', 'INVALID_THRUST');
      }

      const expectedHoverThrust = massBreakdown.totalMassKg * 9.80665;
      if (Math.abs(flightMetrics.hoverThrustRequiredNewtons - expectedHoverThrust) > 1.0) {
        throw new ProductArchitectureValidationError(
          `Hover thrust (${flightMetrics.hoverThrustRequiredNewtons} N) does not match weight (${expectedHoverThrust.toFixed(2)} N)`,
          'HOVER_THRUST_INCONSISTENCY'
        );
      }

      const expectedTwr = flightMetrics.totalMaxThrustNewtons / expectedHoverThrust;
      if (Math.abs(flightMetrics.thrustToWeightRatio - expectedTwr) > 0.05) {
        throw new ProductArchitectureValidationError(
          `Thrust-to-weight ratio (${flightMetrics.thrustToWeightRatio}) does not match thrust/weight calculation (${expectedTwr.toFixed(2)})`,
          'TWR_INCONSISTENCY'
        );
      }

      if (flightMetrics.thrustToWeightRatio < 1.0) {
        throw new ProductArchitectureValidationError(
          `Thrust-to-weight ratio ${flightMetrics.thrustToWeightRatio} is < 1.0; vehicle cannot lift off`,
          'INSUFFICIENT_THRUST_FOR_TAKEOFF'
        );
      }
    }

    // Verify battery & power budget consistency for electric systems
    if (
      powerBudget &&
      (arch.productType === 'INDUSTRIAL_DRONE' || arch.productType === 'DRONE' || arch.productType === 'UAV' || powerBudget.totalEnergyCapacityWh > 0)
    ) {
      if (powerBudget.totalEnergyCapacityWh <= 0) {
        throw new ProductArchitectureValidationError('Battery total energy capacity must be > 0 Wh', 'INVALID_ENERGY_CAPACITY');
      }
    }
  }
}
