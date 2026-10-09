/**
 * SECP Industrial OS — EPC-018: Architecture Traceability Bridge
 * Bridges Product Architecture with EPC-002 Requirements, EPC-003 Traceability Graph,
 * EPC-004 Baselines, EPC-005 BOM, and constructs the end-to-end Digital Thread.
 */

import {
  ArchitectureDigitalThreadGraph,
  DigitalThreadNode,
  ProductArchitecture
} from './ProductArchitectureTypes';
import { RequirementTraceabilityGraph } from '../TraceabilityTypes';
import { BOMReference, ComponentReference } from '../ProductConfigurationTypes';

export class ArchitectureTraceabilityBridge {
  /**
   * Generates the end-to-end Digital Thread Node Graph representing:
   * Product → Variant → Revision → Subsystems → Components → Interfaces → Requirements.
   */
  public static buildDigitalThreadGraph(arch: ProductArchitecture): ArchitectureDigitalThreadGraph {
    const nodes: DigitalThreadNode[] = [];

    // 1. Root Product Node
    const productNodeId = `NODE-PROD-${arch.productId}`;
    nodes.push({
      nodeId: productNodeId,
      nodeType: 'PRODUCT',
      name: arch.productName,
      referenceId: arch.productId,
      status: 'ACTIVE',
      parentNodeIds: [],
      childNodeIds: [`NODE-VAR-${arch.variantCode}`],
      metadata: { productType: arch.productType }
    });

    // 2. Variant Node
    const variantNodeId = `NODE-VAR-${arch.variantCode}`;
    const revisionNodeId = `NODE-REV-${arch.revision}`;
    nodes.push({
      nodeId: variantNodeId,
      nodeType: 'VARIANT',
      name: arch.variantName,
      referenceId: arch.variantCode,
      status: 'ACTIVE',
      parentNodeIds: [productNodeId],
      childNodeIds: [revisionNodeId]
    });

    // 3. Revision Node
    const subsystemNodeIds = arch.subsystems.map(s => `NODE-SUB-${s.subsystemId}`);
    nodes.push({
      nodeId: revisionNodeId,
      nodeType: 'REVISION',
      name: `Revision ${arch.revision}`,
      referenceId: arch.revision,
      status: 'RELEASED',
      parentNodeIds: [variantNodeId],
      childNodeIds: subsystemNodeIds,
      metadata: { architectureId: arch.architectureId }
    });

    // 4. Subsystem Nodes
    for (const sub of arch.subsystems) {
      const subNodeId = `NODE-SUB-${sub.subsystemId}`;
      const compNodeIds = sub.components.map(c => `NODE-COMP-${c.componentId}`);

      nodes.push({
        nodeId: subNodeId,
        nodeType: 'SUBSYSTEM',
        name: sub.name,
        referenceId: sub.subsystemId,
        status: 'DEFINED',
        parentNodeIds: [revisionNodeId],
        childNodeIds: compNodeIds,
        metadata: {
          category: sub.category,
          totalMassKg: sub.totalMassKg
        }
      });

      // 5. Component Nodes
      for (const comp of sub.components) {
        const compNodeId = `NODE-COMP-${comp.componentId}`;
        const reqNodeIds = comp.traceableRequirementIds.map(r => `NODE-REQ-${r}`);

        nodes.push({
          nodeId: compNodeId,
          nodeType: 'COMPONENT',
          name: comp.name,
          referenceId: comp.componentId,
          status: 'CONFIGURED',
          parentNodeIds: [subNodeId],
          childNodeIds: reqNodeIds,
          metadata: {
            category: comp.category,
            partNumber: comp.partNumber,
            massKg: comp.physical.massKg,
            quantity: comp.quantity,
            isCritical: comp.isCritical
          }
        });
      }
    }

    // 6. Interface Nodes
    for (const iface of arch.interfaces) {
      const ifaceNodeId = `NODE-INT-${iface.interfaceId}`;
      const sourceCompNodeId = `NODE-COMP-${iface.sourceComponentId}`;
      const targetCompNodeId = `NODE-COMP-${iface.targetComponentId}`;
      const reqNodeIds = iface.linkedRequirementIds.map(r => `NODE-REQ-${r}`);

      nodes.push({
        nodeId: ifaceNodeId,
        nodeType: 'INTERFACE',
        name: iface.name,
        referenceId: iface.interfaceId,
        status: iface.status,
        parentNodeIds: [sourceCompNodeId, targetCompNodeId],
        childNodeIds: reqNodeIds,
        metadata: {
          interfaceType: iface.interfaceType,
          constraints: iface.constraints
        }
      });
    }

    // 7. Requirement Nodes
    const uniqueReqs = new Set<string>();
    for (const link of arch.requirementLinks) {
      uniqueReqs.add(link.requirementId);
    }
    for (const sub of arch.subsystems) {
      for (const comp of sub.components) {
        for (const reqId of comp.traceableRequirementIds) {
          uniqueReqs.add(reqId);
        }
      }
    }

    for (const reqId of uniqueReqs) {
      const reqNodeId = `NODE-REQ-${reqId}`;
      const parentCompNodes: string[] = [];

      for (const sub of arch.subsystems) {
        for (const comp of sub.components) {
          if (comp.traceableRequirementIds.includes(reqId)) {
            parentCompNodes.push(`NODE-COMP-${comp.componentId}`);
          }
        }
      }

      nodes.push({
        nodeId: reqNodeId,
        nodeType: 'REQUIREMENT',
        name: `Requirement ${reqId}`,
        referenceId: reqId,
        status: 'LINKED',
        parentNodeIds: parentCompNodes,
        childNodeIds: []
      });
    }

    const totalCriticalComponents = arch.subsystems
      .flatMap(s => s.components)
      .filter(c => c.isCritical).length;
    const tracedCriticalComponents = arch.subsystems
      .flatMap(s => s.components)
      .filter(c => c.isCritical && c.traceableRequirementIds.length > 0).length;

    const traceabilityCoveragePercentage =
      totalCriticalComponents > 0
        ? Number(((tracedCriticalComponents / totalCriticalComponents) * 100).toFixed(1))
        : 100.0;

    return {
      architectureId: arch.architectureId,
      rootProductId: arch.productId,
      nodes,
      totalNodeCount: nodes.length,
      traceabilityCoveragePercentage
    };
  }

  /**
   * Transforms the ProductArchitecture into an EPC-005 compliant Bill of Materials (BOM).
   */
  public static exportToBOM(arch: ProductArchitecture): BOMReference {
    const bomId = `BOM-${arch.productId}-${arch.variantCode}-REV${arch.revision}`;
    const items: Array<{
      itemNumber: number;
      componentId: string;
      partNumber: string;
      name: string;
      quantity: number;
      unit: string;
      subsystem: string;
      unitMassKg: number;
      totalMassKg: number;
      material?: string;
    }> = [];

    let itemSeq = 1;
    for (const sub of arch.subsystems) {
      for (const comp of sub.components) {
        items.push({
          itemNumber: itemSeq++,
          componentId: comp.componentId,
          partNumber: comp.partNumber,
          name: comp.name,
          quantity: comp.quantity,
          unit: 'EA',
          subsystem: sub.name,
          unitMassKg: comp.physical.massKg,
          totalMassKg: Number((comp.physical.massKg * comp.quantity).toFixed(4)),
          material: comp.physical.materialName
        });
      }
    }

    return {
      bomId,
      assemblyId: `ASSY-${arch.productId}-${arch.variantCode}`,
      revision: arch.revision,
      status: 'RELEASED',
      items
    };
  }

  /**
   * Transforms the ProductArchitecture into an EPC-003 Traceability Graph.
   */
  public static exportToTraceabilityGraph(arch: ProductArchitecture): RequirementTraceabilityGraph {
    const graphId = `GRAPH-${arch.architectureId}`;
    const nodes: any[] = [];
    const edges: any[] = [];

    // Add Architecture Node
    nodes.push({
      nodeId: arch.architectureId,
      type: 'MODEL',
      name: arch.productName,
      status: 'ACTIVE',
      metadata: { variant: arch.variantCode, revision: arch.revision }
    });

    // Add Subsystem and Component nodes + edges
    for (const sub of arch.subsystems) {
      nodes.push({
        nodeId: sub.subsystemId,
        type: 'MODEL',
        name: sub.name,
        status: 'DEFINED'
      });
      edges.push({
        edgeId: `EDGE-${arch.architectureId}-${sub.subsystemId}`,
        sourceNodeId: arch.architectureId,
        targetNodeId: sub.subsystemId,
        relationshipType: 'CONTAINS'
      });

      for (const comp of sub.components) {
        nodes.push({
          nodeId: comp.componentId,
          type: 'DESIGN_FEATURE',
          name: comp.name,
          status: 'CONFIGURED'
        });
        edges.push({
          edgeId: `EDGE-${sub.subsystemId}-${comp.componentId}`,
          sourceNodeId: sub.subsystemId,
          targetNodeId: comp.componentId,
          relationshipType: 'CONTAINS'
        });

        // Link to Requirements
        for (const reqId of comp.traceableRequirementIds) {
          nodes.push({
            nodeId: reqId,
            type: 'REQUIREMENT',
            name: `Requirement ${reqId}`,
            status: 'LINKED'
          });
          edges.push({
            edgeId: `EDGE-${comp.componentId}-${reqId}`,
            sourceNodeId: comp.componentId,
            targetNodeId: reqId,
            relationshipType: 'SATISFIES'
          });
        }
      }
    }

    return {
      graphId,
      nodes,
      edges,
      coverage: {
        totalRequirements: arch.requirementLinks.length,
        satisfiedRequirements: arch.requirementLinks.length,
        coveragePercentage: 100
      }
    };
  }
}
