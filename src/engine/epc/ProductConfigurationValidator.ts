/**
 * SECP Industrial OS — EPC-005: Product Configuration Validator
 * Validates domain-neutral Product, Revision, Variant, Configuration, Assembly, and BOM schemas
 * and enforces structural consistency, cycle detection, and revision compatibility rules.
 */

import { ConfigurationBaselineValidator } from './ConfigurationBaselineValidator';
import { ProductConfigurationSerializer } from './ProductConfigurationSerializer';
import {
  AssemblyReference,
  BOMReference,
  ComponentReference,
  ProductConfigurationData,
  ProductConfigurationValidationError,
  ProductData,
  ProductRevisionData,
  ProductVariantData
} from './ProductConfigurationTypes';

export class ProductConfigurationValidator {
  /**
   * Validates a ProductData model.
   */
  public static validateProduct(product: ProductData): void {
    if (!product) {
      throw new ProductConfigurationValidationError('Product data cannot be null or undefined', 'MISSING_PRODUCT');
    }
    if (!product.productId || typeof product.productId !== 'string' || product.productId.trim() === '') {
      throw new ProductConfigurationValidationError('Product must have a non-empty productId', 'INVALID_PRODUCT_ID');
    }
    if (!product.name || typeof product.name !== 'string' || product.name.trim() === '') {
      throw new ProductConfigurationValidationError('Product must have a non-empty name', 'INVALID_PRODUCT_NAME');
    }
    if (!product.productType || typeof product.productType !== 'string' || product.productType.trim() === '') {
      throw new ProductConfigurationValidationError('Product must have a non-empty productType', 'INVALID_PRODUCT_TYPE');
    }
    const validStatuses = ['DRAFT', 'ACTIVE', 'OBSOLETE', 'ARCHIVED'];
    if (!validStatuses.includes(product.lifecycleStatus)) {
      throw new ProductConfigurationValidationError(
        `Invalid product lifecycleStatus: ${product.lifecycleStatus}`,
        'INVALID_LIFECYCLE_STATUS'
      );
    }
  }

  /**
   * Validates a ProductRevisionData model.
   */
  public static validateRevision(revision: ProductRevisionData, product?: ProductData): void {
    if (!revision) {
      throw new ProductConfigurationValidationError('Revision data cannot be null or undefined', 'MISSING_REVISION');
    }
    if (!revision.revisionId || typeof revision.revisionId !== 'string' || revision.revisionId.trim() === '') {
      throw new ProductConfigurationValidationError('Revision must have a non-empty revisionId', 'INVALID_REVISION_ID');
    }
    if (!revision.productId || typeof revision.productId !== 'string' || revision.productId.trim() === '') {
      throw new ProductConfigurationValidationError('Revision must have a non-empty productId', 'INVALID_PRODUCT_ID');
    }
    if (product && revision.productId !== product.productId) {
      throw new ProductConfigurationValidationError(
        `Revision productId (${revision.productId}) does not match Product (${product.productId})`,
        'REVISION_PRODUCT_MISMATCH'
      );
    }
    if (!revision.revisionCode || typeof revision.revisionCode !== 'string' || revision.revisionCode.trim() === '') {
      throw new ProductConfigurationValidationError('Revision must have a non-empty revisionCode', 'INVALID_REVISION_CODE');
    }
    if (typeof revision.revisionNumber !== 'number' || revision.revisionNumber <= 0 || !Number.isInteger(revision.revisionNumber)) {
      throw new ProductConfigurationValidationError('Revision number must be a positive integer', 'INVALID_REVISION_NUMBER');
    }
    const validStatuses = ['DRAFT', 'RELEASED', 'OBSOLETE', 'ARCHIVED'];
    if (!validStatuses.includes(revision.status)) {
      throw new ProductConfigurationValidationError(`Invalid revision status: ${revision.status}`, 'INVALID_REVISION_STATUS');
    }
  }

  /**
   * Validates a ProductVariantData model.
   */
  public static validateVariant(variant: ProductVariantData, product?: ProductData): void {
    if (!variant) {
      throw new ProductConfigurationValidationError('Variant data cannot be null or undefined', 'MISSING_VARIANT');
    }
    if (!variant.variantId || typeof variant.variantId !== 'string' || variant.variantId.trim() === '') {
      throw new ProductConfigurationValidationError('Variant must have a non-empty variantId', 'INVALID_VARIANT_ID');
    }
    if (!variant.productId || typeof variant.productId !== 'string' || variant.productId.trim() === '') {
      throw new ProductConfigurationValidationError('Variant must have a non-empty productId', 'INVALID_PRODUCT_ID');
    }
    if (product && variant.productId !== product.productId) {
      throw new ProductConfigurationValidationError(
        `Variant productId (${variant.productId}) does not match Product (${product.productId})`,
        'VARIANT_PRODUCT_MISMATCH'
      );
    }
    if (!variant.variantCode || typeof variant.variantCode !== 'string' || variant.variantCode.trim() === '') {
      throw new ProductConfigurationValidationError('Variant must have a non-empty variantCode', 'INVALID_VARIANT_CODE');
    }
    const validStatuses = ['ACTIVE', 'DEPRECATED', 'INACTIVE'];
    if (!validStatuses.includes(variant.status)) {
      throw new ProductConfigurationValidationError(`Invalid variant status: ${variant.status}`, 'INVALID_VARIANT_STATUS');
    }
  }

  /**
   * Validates AssemblyReference structural integrity and cycle freedom.
   */
  public static validateAssembly(assembly: AssemblyReference): void {
    if (!assembly) {
      throw new ProductConfigurationValidationError('Assembly reference cannot be null or undefined', 'MISSING_ASSEMBLY');
    }
    if (!assembly.assemblyId || typeof assembly.assemblyId !== 'string' || assembly.assemblyId.trim() === '') {
      throw new ProductConfigurationValidationError('Assembly must have a non-empty assemblyId', 'INVALID_ASSEMBLY_ID');
    }
    if (!assembly.assemblyRevision || typeof assembly.assemblyRevision !== 'string' || assembly.assemblyRevision.trim() === '') {
      throw new ProductConfigurationValidationError('Assembly must have a non-empty assemblyRevision', 'INVALID_ASSEMBLY_REVISION');
    }
    if (!assembly.rootComponentId || typeof assembly.rootComponentId !== 'string' || assembly.rootComponentId.trim() === '') {
      throw new ProductConfigurationValidationError('Assembly must have a non-empty rootComponentId', 'INVALID_ROOT_COMPONENT');
    }
    if (!Array.isArray(assembly.componentReferences) || assembly.componentReferences.length === 0) {
      throw new ProductConfigurationValidationError('Assembly must contain at least one component reference', 'EMPTY_ASSEMBLY_COMPONENTS');
    }

    const componentIds = new Set<string>();
    const parentMap = new Map<string, string[]>();

    for (const comp of assembly.componentReferences) {
      if (!comp.componentId || typeof comp.componentId !== 'string' || comp.componentId.trim() === '') {
        throw new ProductConfigurationValidationError('Component in assembly must have a non-empty componentId', 'INVALID_COMPONENT_ID');
      }
      if (!comp.revision || typeof comp.revision !== 'string' || comp.revision.trim() === '') {
        throw new ProductConfigurationValidationError(
          `Component ${comp.componentId} must specify an explicit revision`,
          'MISSING_COMPONENT_REVISION'
        );
      }
      if (typeof comp.quantity !== 'number' || comp.quantity <= 0) {
        throw new ProductConfigurationValidationError(
          `Component ${comp.componentId} must have a positive quantity (got ${comp.quantity})`,
          'INVALID_COMPONENT_QUANTITY'
        );
      }
      if (componentIds.has(comp.componentId)) {
        throw new ProductConfigurationValidationError(
          `Duplicate component binding detected in assembly: ${comp.componentId}`,
          'DUPLICATE_COMPONENT_BINDING'
        );
      }
      componentIds.add(comp.componentId);

      if (comp.childComponentIds && comp.childComponentIds.length > 0) {
        parentMap.set(comp.componentId, [...comp.childComponentIds]);
      }
    }

    // Ensure root component exists in component references
    if (!componentIds.has(assembly.rootComponentId)) {
      throw new ProductConfigurationValidationError(
        `Root component ${assembly.rootComponentId} is missing from assembly component references`,
        'MISSING_ROOT_COMPONENT'
      );
    }

    // Check for cycles in sub-assembly component references
    for (const [parent, children] of parentMap.entries()) {
      for (const child of children) {
        if (child === parent) {
          throw new ProductConfigurationValidationError(
            `Self-referential cyclic component dependency detected in assembly: ${parent}`,
            'CYCLIC_ASSEMBLY_DEPENDENCY'
          );
        }
        // DFS cycle check
        const visited = new Set<string>([parent]);
        const stack = [child];
        while (stack.length > 0) {
          const curr = stack.pop()!;
          if (visited.has(curr)) {
            throw new ProductConfigurationValidationError(
              `Cyclic component dependency detected in assembly involving component: ${curr}`,
              'CYCLIC_ASSEMBLY_DEPENDENCY'
            );
          }
          visited.add(curr);
          const nextChildren = parentMap.get(curr);
          if (nextChildren) {
            stack.push(...nextChildren);
          }
        }
      }
    }

    // Hash verification if present
    if (assembly.assemblyHash) {
      const expectedHash = ProductConfigurationSerializer.computeAssemblyHash(assembly);
      if (assembly.assemblyHash !== expectedHash) {
        throw new ProductConfigurationValidationError(
          `Assembly hash mismatch. Expected ${expectedHash}, got ${assembly.assemblyHash}`,
          'ASSEMBLY_HASH_MISMATCH'
        );
      }
    }
  }

  /**
   * Validates BOMReference integrity.
   */
  public static validateBOM(bom: BOMReference): void {
    if (!bom) {
      throw new ProductConfigurationValidationError('BOM reference cannot be null or undefined', 'MISSING_BOM');
    }
    if (!bom.bomId || typeof bom.bomId !== 'string' || bom.bomId.trim() === '') {
      throw new ProductConfigurationValidationError('BOM must have a non-empty bomId', 'INVALID_BOM_ID');
    }
    if (!bom.bomRevision || typeof bom.bomRevision !== 'string' || bom.bomRevision.trim() === '') {
      throw new ProductConfigurationValidationError('BOM must have a non-empty bomRevision', 'INVALID_BOM_REVISION');
    }
    if (!Array.isArray(bom.entries) || bom.entries.length === 0) {
      throw new ProductConfigurationValidationError('BOM must contain at least one entry', 'EMPTY_BOM_ENTRIES');
    }

    const entryIds = new Set<string>();
    const componentIds = new Set<string>();

    for (const entry of bom.entries) {
      if (!entry.entryId || typeof entry.entryId !== 'string' || entry.entryId.trim() === '') {
        throw new ProductConfigurationValidationError('BOM entry must have a non-empty entryId', 'INVALID_ENTRY_ID');
      }
      if (entryIds.has(entry.entryId)) {
        throw new ProductConfigurationValidationError(`Duplicate BOM entryId detected: ${entry.entryId}`, 'DUPLICATE_BOM_ENTRY_ID');
      }
      entryIds.add(entry.entryId);

      if (!entry.componentId || typeof entry.componentId !== 'string' || entry.componentId.trim() === '') {
        throw new ProductConfigurationValidationError('BOM entry must have a non-empty componentId', 'INVALID_COMPONENT_ID');
      }
      if (componentIds.has(entry.componentId)) {
        throw new ProductConfigurationValidationError(
          `Duplicate component entry detected in BOM: ${entry.componentId}`,
          'DUPLICATE_BOM_COMPONENT'
        );
      }
      componentIds.add(entry.componentId);

      if (!entry.revision || typeof entry.revision !== 'string' || entry.revision.trim() === '') {
        throw new ProductConfigurationValidationError(
          `BOM entry ${entry.componentId} must specify an explicit revision`,
          'MISSING_BOM_COMPONENT_REVISION'
        );
      }
      if (typeof entry.quantity !== 'number' || entry.quantity <= 0) {
        throw new ProductConfigurationValidationError(
          `BOM entry ${entry.componentId} must have a positive quantity (got ${entry.quantity})`,
          'INVALID_BOM_QUANTITY'
        );
      }
      if (!entry.unit || typeof entry.unit !== 'string' || entry.unit.trim() === '') {
        throw new ProductConfigurationValidationError(
          `BOM entry ${entry.componentId} must specify an explicit unit`,
          'MISSING_BOM_UNIT'
        );
      }
    }

    if (bom.bomHash) {
      const expectedHash = ProductConfigurationSerializer.computeBOMHash(bom);
      if (bom.bomHash !== expectedHash) {
        throw new ProductConfigurationValidationError(
          `BOM hash mismatch. Expected ${expectedHash}, got ${bom.bomHash}`,
          'BOM_HASH_MISMATCH'
        );
      }
    }
  }

  /**
   * Validates structural compatibility between AssemblyReference and BOMReference.
   */
  public static validateAssemblyBOMCompatibility(assembly: AssemblyReference, bom: BOMReference): void {
    const bomMap = new Map<string, { revision: string; quantity: number }>();
    for (const entry of bom.entries) {
      bomMap.set(entry.componentId, { revision: entry.revision, quantity: entry.quantity });
    }

    for (const comp of assembly.componentReferences) {
      const bomItem = bomMap.get(comp.componentId);
      if (!bomItem) {
        throw new ProductConfigurationValidationError(
          `Assembly component ${comp.componentId} is missing from the Bill of Materials (BOM)`,
          'UNMATCHED_ASSEMBLY_COMPONENT_IN_BOM'
        );
      }
      if (comp.revision !== bomItem.revision) {
        throw new ProductConfigurationValidationError(
          `Revision mismatch for component ${comp.componentId}: Assembly specifies ${comp.revision}, but BOM specifies ${bomItem.revision}`,
          'ASSEMBLY_BOM_REVISION_MISMATCH'
        );
      }
    }
  }

  /**
   * Validates complete ProductConfigurationData.
   */
  public static validateConfiguration(
    config: ProductConfigurationData,
    product?: ProductData,
    revision?: ProductRevisionData,
    variant?: ProductVariantData
  ): void {
    if (!config) {
      throw new ProductConfigurationValidationError('Configuration data cannot be null or undefined', 'MISSING_CONFIGURATION');
    }
    if (!config.configurationId || typeof config.configurationId !== 'string' || config.configurationId.trim() === '') {
      throw new ProductConfigurationValidationError('Configuration must have a non-empty configurationId', 'INVALID_CONFIG_ID');
    }
    if (!config.productId || typeof config.productId !== 'string' || config.productId.trim() === '') {
      throw new ProductConfigurationValidationError('Configuration must have a non-empty productId', 'INVALID_PRODUCT_ID');
    }
    if (!config.revisionId || typeof config.revisionId !== 'string' || config.revisionId.trim() === '') {
      throw new ProductConfigurationValidationError('Configuration must have a non-empty revisionId', 'INVALID_REVISION_ID');
    }
    if (!config.variantId || typeof config.variantId !== 'string' || config.variantId.trim() === '') {
      throw new ProductConfigurationValidationError('Configuration must have a non-empty variantId', 'INVALID_VARIANT_ID');
    }
    if (!config.configurationCode || typeof config.configurationCode !== 'string' || config.configurationCode.trim() === '') {
      throw new ProductConfigurationValidationError('Configuration must have a non-empty configurationCode', 'INVALID_CONFIG_CODE');
    }

    if (product && config.productId !== product.productId) {
      throw new ProductConfigurationValidationError(
        `Configuration productId (${config.productId}) does not match Product (${product.productId})`,
        'CONFIG_PRODUCT_MISMATCH'
      );
    }
    if (revision && config.revisionId !== revision.revisionId) {
      throw new ProductConfigurationValidationError(
        `Configuration revisionId (${config.revisionId}) does not match ProductRevision (${revision.revisionId})`,
        'CONFIG_REVISION_MISMATCH'
      );
    }
    if (variant && config.variantId !== variant.variantId) {
      throw new ProductConfigurationValidationError(
        `Configuration variantId (${config.variantId}) does not match ProductVariant (${variant.variantId})`,
        'CONFIG_VARIANT_MISMATCH'
      );
    }

    const validStatuses = ['DRAFT', 'QUALIFIED', 'SUPERSEDED', 'REJECTED'];
    if (!validStatuses.includes(config.status)) {
      throw new ProductConfigurationValidationError(`Invalid configuration status: ${config.status}`, 'INVALID_CONFIG_STATUS');
    }

    if (config.effectiveFrom && config.effectiveTo) {
      const fromTime = new Date(config.effectiveFrom).getTime();
      const toTime = new Date(config.effectiveTo).getTime();
      if (isNaN(fromTime) || isNaN(toTime)) {
        throw new ProductConfigurationValidationError('Invalid effective date format', 'INVALID_EFFECTIVITY_DATE');
      }
      if (fromTime > toTime) {
        throw new ProductConfigurationValidationError(
          `effectiveFrom (${config.effectiveFrom}) cannot be after effectiveTo (${config.effectiveTo})`,
          'INVALID_EFFECTIVITY_RANGE'
        );
      }
    }

    // Validate assembly & BOM
    this.validateAssembly(config.assembly);
    this.validateBOM(config.bom);
    this.validateAssemblyBOMCompatibility(config.assembly, config.bom);

    // Validate EPC-004 baseline if attached
    if (config.baseline) {
      ConfigurationBaselineValidator.validate(config.baseline);
      if (config.baselineId && config.baseline.baselineId !== config.baselineId) {
        throw new ProductConfigurationValidationError(
          `Configuration baselineId (${config.baselineId}) does not match attached Baseline (${config.baseline.baselineId})`,
          'BASELINE_ID_MISMATCH'
        );
      }
    }

    // If QUALIFIED or isFrozen, ensure contentHash is set and valid
    if (config.status === 'QUALIFIED' || config.isFrozen) {
      if (!config.isFrozen) {
        throw new ProductConfigurationValidationError(
          'Qualified configuration must be frozen (isFrozen = true)',
          'UNFROZEN_QUALIFIED_CONFIG'
        );
      }
      if (!config.contentHash || typeof config.contentHash !== 'string' || config.contentHash.length !== 64) {
        throw new ProductConfigurationValidationError(
          'Qualified configuration must have a valid 64-character SHA-256 contentHash',
          'MISSING_CONTENT_HASH'
        );
      }

      const expectedHash = ProductConfigurationSerializer.computeConfigurationHash(config);
      if (config.contentHash !== expectedHash) {
        throw new ProductConfigurationValidationError(
          `Configuration contentHash mismatch (tampering detected). Expected ${expectedHash}, got ${config.contentHash}`,
          'CONTENT_HASH_MISMATCH'
        );
      }
    }
  }
}
