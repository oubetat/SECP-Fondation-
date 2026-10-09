import { MachineComponentNode, MachineHierarchy } from "./types";

export class MachineComponentRegistryEngine {
  private hierarchy: MachineHierarchy;

  constructor() {
    this.hierarchy = {
      rootComponentId: "COMP_BASE_01",
      components: {}
    };
    this.initializeStandard5AxisComponents();
  }

  private initializeStandard5AxisComponents(): void {
    const components: MachineComponentNode[] = [
      {
        componentId: "COMP_BASE_01",
        componentType: "BASE",
        name: "Mineral Cast Machine Bed",
        geometryId: "GEO_BASE_CASTING",
        kinematicNodeId: "NODE_BASE",
        configurationRevision: 1,
        status: "ACTIVE"
      },
      {
        componentId: "COMP_COLUMN_01",
        componentType: "COLUMN",
        name: "Y-Axis Moving Column",
        parentId: "COMP_BASE_01",
        geometryId: "GEO_COLUMN_Y",
        kinematicNodeId: "NODE_Y_AXIS",
        configurationRevision: 1,
        status: "ACTIVE"
      },
      {
        componentId: "COMP_HEAD_01",
        componentType: "HEAD",
        name: "Z-Axis Spindle Headstock",
        parentId: "COMP_COLUMN_01",
        geometryId: "GEO_HEAD_Z",
        kinematicNodeId: "NODE_Z_AXIS",
        configurationRevision: 1,
        status: "ACTIVE"
      },
      {
        componentId: "COMP_SPINDLE_01",
        componentType: "SPINDLE",
        name: "HSK-A63 20,000 RPM Motor Spindle",
        parentId: "COMP_HEAD_01",
        geometryId: "GEO_SPINDLE_MOTOR",
        kinematicNodeId: "NODE_SPINDLE",
        configurationRevision: 1,
        status: "ACTIVE"
      },
      {
        componentId: "COMP_TABLE_01",
        componentType: "TABLE",
        name: "X-Axis Machine Table",
        parentId: "COMP_BASE_01",
        geometryId: "GEO_TABLE_X",
        kinematicNodeId: "NODE_X_AXIS",
        configurationRevision: 1,
        status: "ACTIVE"
      },
      {
        componentId: "COMP_TRUNNION_A_01",
        componentType: "ROTARY_TABLE",
        name: "A-Axis Swivel Trunnion (+/- 115 deg)",
        parentId: "COMP_TABLE_01",
        geometryId: "GEO_TRUNNION_A",
        kinematicNodeId: "NODE_A_AXIS",
        configurationRevision: 1,
        status: "ACTIVE"
      },
      {
        componentId: "COMP_ROTARY_C_01",
        componentType: "ROTARY_TABLE",
        name: "C-Axis Rotary Platter (360 deg)",
        parentId: "COMP_TRUNNION_A_01",
        geometryId: "GEO_PLATTER_C",
        kinematicNodeId: "NODE_C_AXIS",
        configurationRevision: 1,
        status: "ACTIVE"
      },
      {
        componentId: "COMP_ATC_01",
        componentType: "TOOL_CHANGER",
        name: "30-Pocket Chain Tool Magazine",
        parentId: "COMP_BASE_01",
        geometryId: "GEO_ATC_MAGAZINE",
        configurationRevision: 1,
        status: "ACTIVE"
      },
      {
        componentId: "COMP_SENSOR_TEMP_01",
        componentType: "SENSOR",
        name: "Spindle Bearing PT100 Temp Sensor",
        parentId: "COMP_SPINDLE_01",
        geometryId: "GEO_SENSOR_PT100",
        configurationRevision: 1,
        status: "ACTIVE"
      },
      {
        componentId: "COMP_SENSOR_VIB_01",
        componentType: "SENSOR",
        name: "Triaxial Spindle Accelerometer",
        parentId: "COMP_SPINDLE_01",
        geometryId: "GEO_SENSOR_ACCEL",
        configurationRevision: 1,
        status: "ACTIVE"
      }
    ];

    for (const comp of components) {
      this.hierarchy.components[comp.componentId] = comp;
    }
  }

  public registerComponent(component: MachineComponentNode): void {
    this.hierarchy.components[component.componentId] = component;
  }

  public getComponent(componentId: string): MachineComponentNode | undefined {
    return this.hierarchy.components[componentId];
  }

  public getAllComponents(): MachineComponentNode[] {
    return Object.values(this.hierarchy.components);
  }

  public getChildren(parentId: string): MachineComponentNode[] {
    return Object.values(this.hierarchy.components).filter(c => c.parentId === parentId);
  }

  public getHierarchy(): MachineHierarchy {
    return { ...this.hierarchy };
  }

  public validateHierarchyIntegrity(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const compMap = this.hierarchy.components;

    if (!compMap[this.hierarchy.rootComponentId]) {
      errors.push(`Root component ${this.hierarchy.rootComponentId} does not exist in registry.`);
    }

    for (const comp of Object.values(compMap)) {
      if (comp.parentId && !compMap[comp.parentId]) {
        errors.push(`Component ${comp.componentId} references non-existent parent ${comp.parentId}`);
      }
    }

    // Check for cycles
    for (const comp of Object.values(compMap)) {
      const visited = new Set<string>();
      let curr: MachineComponentNode | undefined = comp;
      while (curr && curr.parentId) {
        if (visited.has(curr.componentId)) {
          errors.push(`Cyclic parent relationship detected at component ${curr.componentId}`);
          break;
        }
        visited.add(curr.componentId);
        curr = compMap[curr.parentId];
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
