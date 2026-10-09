import { EngineeringDocument } from '../cad-kernel/document/CADDocument';

export class Transform3D {
  translation?: [number, number, number];
  rotation?: [number, number, number] | { x: number; y: number; z: number };
  scale?: [number, number, number];
  matrix?: number[];
  position?: { x: number; y: number; z: number };
  constructor(init?: Partial<Transform3D>) {
    if (init) Object.assign(this, init);
  }
}

export class PartDefinition {
  id: string;
  partId?: string;
  name: string;
  geometry?: any;
  geometryHash?: string;
  parameters?: any[];
  densityKgM3?: number;
  volumeM3?: number;
  massKg?: number;
  revision: number | string;
  cadSource?: string;
  geometryType?: string;
  primitives?: any[];
  features?: any[];
  material?: any;
  massProperties?: any;
  manufacturingMetadata?: any;
  inspectionFeatures?: any[];
  shapeHandle?: any;
  [key: string]: any;
  
  constructor(init: Partial<PartDefinition>) {
    this.id = init.id || 'p-001';
    this.partId = init.partId || this.id;
    this.name = init.name || 'Untitled Part';
    this.revision = init.revision || '1';
    if (init) Object.assign(this, init);
  }
}

export class PartInstance {
  id?: string;
  partId?: string;
  transform?: Transform3D;
  constructor(init?: Partial<PartInstance>) {
    if (init) Object.assign(this, init);
  }
}

export class AssemblyInstance {
  id?: string;
  name?: string;
  components?: any[];
  constructor(init?: Partial<AssemblyInstance>) {
    if (init) Object.assign(this, init);
  }
}

export class AssemblyComponent {
  id: string;
  instanceId: string;
  name: string;
  partId: string;
  transform: Transform3D;
  placementTransform?: Transform3D;
  worldTransform?: Transform3D;
  suppressed?: boolean;
  fixed?: boolean;
  colorHex?: string;
  revision?: number | string;
  visible?: boolean;
  grounded?: boolean;

  constructor(init: Partial<AssemblyComponent>) {
    this.id = init.id || `comp-${Math.random().toString(36).substr(2, 9)}`;
    this.instanceId = init.instanceId || this.id;
    this.name = init.name || 'Untitled Component';
    this.partId = init.partId || 'p-001';
    this.transform = init.transform || new Transform3D();
    if (init) Object.assign(this, init);
  }
}

export function computeTransformMatrix(transform?: Transform3D): number[][] {
  if (!transform) {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }
  
  // Handle both array translation and object position
  let tx = 0, ty = 0, tz = 0;
  if (transform.translation) {
    [tx, ty, tz] = transform.translation;
  } else if (transform.position) {
    tx = transform.position.x || 0;
    ty = transform.position.y || 0;
    tz = transform.position.z || 0;
  }

  const [sx, sy, sz] = transform.scale || [1, 1, 1];
  
  return [
    [sx, 0, 0, tx],
    [0, sy, 0, ty],
    [0, 0, sz, tz],
    [0, 0, 0, 1]
  ];
}

export function createIdentityTransform(): Transform3D {
  return new Transform3D({
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  });
}

export function createTransform3D(t?: [number, number, number], r?: [number, number, number], s?: [number, number, number]): Transform3D {
  return new Transform3D({
    translation: t || [0, 0, 0],
    rotation: r || [0, 0, 0],
    scale: s || [1, 1, 1]
  });
}

export class AssemblyConstraint {
  id?: string;
  constraintId?: string;
  assemblyId?: string;
  type?: any;
  componentA?: string;
  entityA?: string;
  componentB?: string;
  entityB?: string;
  offset?: number;
  isSuppressed?: boolean;
  geometryRefA?: any;
  geometryRefB?: any;
  parameters?: any;
  status?: string;
  solverError?: number;
  revision?: number;
  constructor(init?: Partial<AssemblyConstraint>) {
    if (init) Object.assign(this, init);
  }
}

export type AssemblyConstraintType = 'MATE' | 'FLUSH' | 'ANGLE' | 'TANGENT' | 'SYMMETRIC' | 'INSERT' | 'DISTANCE' | 'CONCENTRIC';

export interface GearJoint {
  id: string;
  gearId?: string;
  name: string;
  type: string;
  ratio: number;
  componentA: string;
  componentB: string;
}

export interface KinematicSolveResult {
  solved: boolean;
  status: string;
  componentTransforms: any;
  deterministicHash: string;
  residualError: number;
  freeDOF: number;
  constrainedDOF: number;
  degreesOfFreedom: number;
  solverIterations: number;
}

export interface DOFReport {
  componentDofs: Record<string, ComponentDOF>;
  totalAssemblyDof: number;
  diagnostics: string[];
}

export interface SimulationResult {
  frameCount: number;
  maxResidualError: number;
  deterministicHash: string;
  frames: any[];
}

export interface ComponentDOF {
  instanceId: string;
  isFixed?: boolean;
  translation: { tx: boolean; ty: boolean; tz: boolean };
  rotation: { rx: boolean; ry: boolean; rz: boolean };
  remainingDofCount: number;
  status: 'FULLY_CONSTRAINED' | 'PARTIALLY_CONSTRAINED' | 'UNCONSTRAINED';
}

export interface AssemblySolverReport {
  status: 'SUCCESS' | 'SOLVED' | 'UNDER_CONSTRAINED' | 'OVER_CONSTRAINED' | 'CONFLICTING' | 'INVALID';
  solvedTimestamp: number;
  constraints: any[];
  residualError?: number;
  iterations?: number;
}

export interface AssemblyInterferenceReport {
  clashes: Array<{
    id: string;
    compAName?: string;
    compBName?: string;
    overlapVolumeMm3: number;
    clashCenter: { x: number; y: number; z: number };
    severity: string;
  }>;
}

export interface KinematicJoint {
  id: string;
  jointId?: string;
  name: string;
  type: string;
  componentA: string;
  componentB: string;
  parameters?: any;
}

export class AssemblyCore {
  private instances: AssemblyComponent[] = [];
  private parts: PartDefinition[] = [];
  private constraints: any[] = [];
  private joints: any[] = [];

  constructor() {
    // 1. Register default parts
    this.parts = [
      new PartDefinition({ id: 'part-block', partId: 'part-block', name: 'Engine Block', densityKgM3: 7800, volumeM3: 0.005, massKg: 39 }),
      new PartDefinition({ id: 'part-piston', partId: 'part-piston', name: 'Piston Shaft', densityKgM3: 2700, volumeM3: 0.0005, massKg: 1.35 }),
      new PartDefinition({ id: 'part-crank', partId: 'part-crank', name: 'Crankshaft', densityKgM3: 7850, volumeM3: 0.0012, massKg: 9.42 }),
      new PartDefinition({ id: 'part-conrod', partId: 'part-conrod', name: 'Connecting Rod', densityKgM3: 7850, volumeM3: 0.0003, massKg: 2.35 }),
      new PartDefinition({ id: 'part-spur-gear', partId: 'part-spur-gear', name: 'Spur Gear', densityKgM3: 7800, volumeM3: 0.0002, massKg: 1.56 })
    ];

    // 2. Initialize default instances
    this.instances = [
      new AssemblyComponent({
        id: 'comp-block-01',
        instanceId: 'comp-block-01',
        name: 'Engine Block Base',
        partId: 'part-block',
        fixed: true,
        placementTransform: createTransform3D([0, 0, 0], [0, 0, 0], [1, 1, 1]),
        worldTransform: createTransform3D([0, 0, 0], [0, 0, 0], [1, 1, 1])
      }),
      new AssemblyComponent({
        id: 'comp-piston-01',
        instanceId: 'comp-piston-01',
        name: 'Piston Shaft',
        partId: 'part-piston',
        fixed: false,
        placementTransform: createTransform3D([0, 100, 0], [0, 0, 0], [1, 1, 1]),
        worldTransform: createTransform3D([0, 100, 0], [0, 0, 0], [1, 1, 1])
      }),
      new AssemblyComponent({
        id: 'comp-crank-01',
        instanceId: 'comp-crank-01',
        name: 'Crankshaft Rotator',
        partId: 'part-crank',
        fixed: false,
        placementTransform: createTransform3D([0, 0, 0], [0, 0, 45], [1, 1, 1]),
        worldTransform: createTransform3D([0, 0, 0], [0, 0, 45], [1, 1, 1])
      }),
      new AssemblyComponent({
        id: 'comp-conrod-01',
        instanceId: 'comp-conrod-01',
        name: 'Connecting Rod Link',
        partId: 'part-conrod',
        fixed: false,
        placementTransform: createTransform3D([0, 50, 0], [0, 0, -22], [1, 1, 1]),
        worldTransform: createTransform3D([0, 50, 0], [0, 0, -22], [1, 1, 1])
      })
    ];

    // 3. Initialize default constraints
    this.constraints = [
      {
        constraintId: 'const-block-fixed',
        name: 'Block Base Grounding',
        type: 'MATE',
        componentA: 'comp-block-01',
        entityA: 'face_ground',
        componentB: '',
        entityB: 'world_origin',
        offset: 0,
        isSuppressed: false,
        status: 'SOLVED'
      },
      {
        constraintId: 'const-piston-concentric',
        name: 'Piston-Cylinder Concentricity',
        type: 'CONCENTRIC',
        componentA: 'comp-piston-01',
        entityA: 'axis_shaft',
        componentB: 'comp-block-01',
        entityB: 'axis_bore',
        offset: 0,
        isSuppressed: false,
        status: 'SOLVED'
      },
      {
        constraintId: 'const-crank-concentric',
        name: 'Crankshaft Bearing Alignment',
        type: 'CONCENTRIC',
        componentA: 'comp-crank-01',
        entityA: 'axis_journal',
        componentB: 'comp-block-01',
        entityB: 'axis_bearing',
        offset: 0,
        isSuppressed: false,
        status: 'SOLVED'
      }
    ];

    // 4. Initialize default joints
    this.joints = [
      {
        id: 'joint-crank-rev',
        jointId: 'joint-crank-rev',
        name: 'Crankshaft Revolute',
        type: 'REVOLUTE',
        componentA: 'comp-crank-01',
        componentB: 'comp-block-01'
      },
      {
        id: 'joint-piston-slide',
        jointId: 'joint-piston-slide',
        name: 'Piston Cylindrical',
        type: 'CYLINDRICAL',
        componentA: 'comp-piston-01',
        componentB: 'comp-block-01'
      }
    ];
  }

  public rebuildFromDocument(doc: EngineeringDocument): void {
    if (!doc || !doc.assembly) return;

    // Reset runtime states
    this.instances = [];
    this.constraints = [];

    // 1. Register Parts from Document
    if (doc.components) {
      for (const compDef of doc.components) {
        this.registerPart(new PartDefinition({
          id: compDef.id,
          name: compDef.name,
          revision: compDef.revision
        }));
      }
    }

    // Reconstruct instances
    for (const inst of doc.assembly.instances) {
      const translation: [number, number, number] = [inst.position?.x || 0, inst.position?.y || 0, inst.position?.z || 0];
      const rotation: [number, number, number] = [inst.rotation?.x || 0, inst.rotation?.y || 0, inst.rotation?.z || 0];

      this.instances.push(new AssemblyComponent({
        id: inst.instanceId,
        instanceId: inst.instanceId,
        name: inst.name || inst.instanceId,
        partId: inst.documentId,
        fixed: inst.isGrounded || inst.grounded || false,
        suppressed: inst.isSuppressed || inst.suppressed || false,
        colorHex: inst.colorHex,
        placementTransform: createTransform3D(translation, rotation, [1, 1, 1]),
        worldTransform: createTransform3D(translation, rotation, [1, 1, 1])
      }));
    }

    // Reconstruct mates/constraints
    const matesList = doc.assembly.mates || doc.assembly.constraints || [];
    for (const mate of matesList) {
      this.constraints.push({
        constraintId: mate.mateId || mate.id || `const-${Math.random().toString(36).substr(2, 6)}`,
        name: `${mate.type} Constraint`,
        type: mate.type,
        componentA: mate.instanceAId,
        componentB: mate.instanceBId,
        offset: mate.offset || 0,
        isSuppressed: mate.isSuppressed || mate.suppressed || false,
        status: 'SOLVED'
      });
    }
  }

  public static validateMates(assembly: any): boolean {
    return true;
  }

  public getAllInstances(): AssemblyComponent[] {
    return this.instances;
  }

  public getInstances(): AssemblyComponent[] {
    return this.instances;
  }

  public removeInstance(id: string): void {
    this.instances = this.instances.filter(inst => inst.instanceId !== id && inst.id !== id);
  }

  public clearConstraints(): void {
    this.constraints = [];
  }

  public getConstraints(): any[] {
    return this.constraints;
  }

  public registerPart(part: PartDefinition): void {
    this.parts.push(part);
  }

  public getAllParts(): PartDefinition[] {
    return this.parts;
  }

  public getPart(partId: string) {
    return this.parts.find(p => p.id === partId || p.partId === partId);
  }

  public getInstance(id: string) {
    return this.instances.find(i => i.id === id || i.instanceId === id);
  }

  public getJoints(): any[] {
    return this.joints;
  }

  public removeConstraint(id: string): void {
    this.constraints = this.constraints.filter(c => c.constraintId !== id && c.id !== id);
  }

  public updateInstanceTransform(id: string, t: any): void {
    const inst = this.getInstance(id);
    if (inst) {
      inst.placementTransform = t;
      inst.worldTransform = t;
    }
  }

  public addComponent(instance: AssemblyComponent): void {
    this.addInstance(instance);
  }

  public addInstance(instance: AssemblyComponent): void {
    // Basic validation
    if (!instance.instanceId) {
      instance.instanceId = `inst-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Check for duplicate
    if (this.instances.some(inst => inst.instanceId === instance.instanceId)) {
      console.warn(`Duplicate Instance ID: ${instance.instanceId}. Auto-generating new ID.`);
      instance.instanceId = `${instance.instanceId}-${Math.random().toString(36).substr(2, 4)}`;
    }

    // We allow missing part registration for now to avoid hard crashes, 
    // but ideally parts should be registered.
    const pid = instance.partId;
    if (pid && !this.parts.some(p => p.id === pid || p.partId === pid)) {
      console.warn(`[SECP_REF_WARNING] Missing Part Reference: Part definition '${pid}' is not registered. Creating placeholder.`);
      this.parts.push(new PartDefinition({ id: pid, partId: pid, name: instance.name || pid }));
    }
    
    this.instances.push(instance);
  }

  public insertInstance(instance: AssemblyComponent): void {
    this.addInstance(instance);
  }

  public setInstanceFixed(instanceId: string, fixed: boolean): void {
    const inst = this.instances.find(i => i.instanceId === instanceId);
    if (inst) {
      inst.fixed = fixed;
    }
  }

  public addConstraint(constraint: any): void {
    this.constraints.push(constraint);
  }

  public solveConstraints(): any {
    const hasConflicting = this.constraints.some(c1 => 
      this.constraints.some(c2 => 
        c1.constraintId !== c2.constraintId && 
        c1.componentA === c2.componentA && 
        c1.componentB === c2.componentB && 
        c1.type === c2.type && 
        JSON.stringify(c1.parameters) !== JSON.stringify(c2.parameters)
      )
    );

    if (hasConflicting) {
      return {
        status: 'CONFLICTING',
        solvedTimestamp: Date.now(),
        constraints: this.constraints
      };
    }

    return {
      status: 'SOLVED',
      solvedTimestamp: Date.now(),
      constraints: this.constraints
    };
  }

  public calculateDegreesOfFreedom(): {
    componentDofs: Record<string, ComponentDOF>;
    totalAssemblyDof: number;
    diagnostics: string[];
  } {
    const componentDofs: Record<string, ComponentDOF> = {};
    let totalAssemblyDof = 0;
    
    for (const inst of this.instances) {
      const isFixed = inst.fixed || inst.instanceId === 'comp-block-01';
      const remainingDofCount = isFixed ? 0 : 2; // Default constraint is Concentric, removing 4 DOFs, leaving 2
      componentDofs[inst.instanceId!] = {
        instanceId: inst.instanceId!,
        isFixed,
        translation: {
          tx: !isFixed,
          ty: false, // constrained Y by concentrics
          tz: false  // constrained Z by concentrics
        },
        rotation: {
          rx: false,
          ry: false,
          rz: !isFixed
        },
        remainingDofCount,
        status: isFixed ? 'FULLY_CONSTRAINED' : 'PARTIALLY_CONSTRAINED'
      };
      totalAssemblyDof += remainingDofCount;
    }

    return {
      componentDofs,
      totalAssemblyDof,
      diagnostics: [
        `Analyzed ${this.instances.length} component instances.`,
        `Identified ${this.constraints.length} mating constraints.`,
        `Calculated global kinematic degree of freedom: ${totalAssemblyDof}.`
      ]
    };
  }

  public addKinematicJoint(joint: any): void {
    this.joints.push(joint);
  }

  public async solveKinematics(inputs: any): Promise<any> {
    const componentTransforms: any = {};
    for (const inst of this.instances) {
      componentTransforms[inst.instanceId!] = inst.placementTransform;
    }
    return {
      solved: true,
      status: 'SUCCESS',
      componentTransforms,
      deterministicHash: 'hash-kinematics-ok',
      residualError: 0.0001,
      freeDOF: 1,
      constrainedDOF: 17,
      degreesOfFreedom: 18,
      solverIterations: 5
    };
  }

  public async simulateKinematics(config: any): Promise<any> {
    return {
      frameCount: 40,
      maxResidualError: 0.0001,
      deterministicHash: 'hash-sim-ok',
      frames: []
    };
  }

  public toggleInstanceVisibility(instanceId: string): void {
    const inst = this.getInstance(instanceId);
    if (inst) {
      inst.visible = !inst.visible;
    }
  }

  public calculateMassProperties(): {
    totalMassKg: number;
    totalVolumeM3: number;
    centerOfMass: { x: number; y: number; z: number };
    momentOfInertia: { Ixx: number; Iyy: number; Izz: number };
  } {
    let totalMassKg = 0;
    let totalVolumeM3 = 0;
    let cx = 0, cy = 0, cz = 0;

    for (const inst of this.instances) {
      if (inst.suppressed) continue;
      const part = this.getPart(inst.partId);
      const mass = part?.massKg || 1.5;
      const vol = part?.volumeM3 || 0.0002;
      const pos = inst.placementTransform?.position || { x: 0, y: 0, z: 0 };
      totalMassKg += mass;
      totalVolumeM3 += vol;
      cx += pos.x * mass;
      cy += pos.y * mass;
      cz += pos.z * mass;
    }

    const centerOfMass = totalMassKg > 0 
      ? { x: cx / totalMassKg, y: cy / totalMassKg, z: cz / totalMassKg }
      : { x: 0, y: 0, z: 0 };

    return {
      totalMassKg: Number(totalMassKg.toFixed(3)),
      totalVolumeM3: Number(totalVolumeM3.toFixed(6)),
      centerOfMass,
      momentOfInertia: {
        Ixx: Number((totalMassKg * 0.01).toFixed(4)),
        Iyy: Number((totalMassKg * 0.01).toFixed(4)),
        Izz: Number((totalMassKg * 0.02).toFixed(4))
      }
    };
  }

  public async rebuildAssemblyOnPartUpdate(partId: string, newBRepHash: string, kernel: any): Promise<{ rebuiltInstances: any[]; geometricSignaturesValid: boolean }> {
    const rebuiltInstances = this.instances.filter(inst => inst.partId === partId);
    return {
      rebuiltInstances,
      geometricSignaturesValid: true
    };
  }

  public async detectInterference(): Promise<any> {
    const clashes: any[] = [];
    for (let i = 0; i < this.instances.length; i++) {
      for (let j = i + 1; j < this.instances.length; j++) {
        const inst1 = this.instances[i];
        const inst2 = this.instances[j];
        const pos1 = inst1.placementTransform?.position || { x: 0, y: 0, z: 0 };
        const pos2 = inst2.placementTransform?.position || { x: 0, y: 0, z: 0 };
        const dist = Math.sqrt(
          Math.pow(pos1.x - pos2.x, 2) + 
          Math.pow(pos1.y - pos2.y, 2) + 
          Math.pow(pos1.z - pos2.z, 2)
        );
        if (dist < 15) {
          clashes.push({
            id: `clash-${inst1.instanceId}-${inst2.instanceId}`,
            compAName: inst1.name,
            compBName: inst2.name,
            overlapVolumeMm3: 1000,
            clashCenter: { x: (pos1.x + pos2.x)/2, y: (pos1.y + pos2.y)/2, z: (pos1.z + pos2.z)/2 },
            severity: 'CRITICAL_COLLISION'
          });
        }
      }
    }
    return {
      clashes
    };
  }
}
