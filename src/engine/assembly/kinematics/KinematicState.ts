import { KinematicBody } from './KinematicBody';
import { KinematicJoint } from './KinematicJointModel';
import { KinematicConfiguration } from './KinematicConfiguration';

export class KinematicState {
  public assemblyId: string;
  public revisionId: string;
  private bodies: Map<string, KinematicBody> = new Map();
  private joints: Map<string, KinematicJoint> = new Map();
  private currentConfiguration?: KinematicConfiguration;
  private groundBodyId?: string;

  constructor(assemblyId: string, revisionId: string = 'REV-0') {
    this.assemblyId = assemblyId;
    this.revisionId = revisionId;
  }

  public addBody(body: KinematicBody): void {
    if (body.grounded) {
      if (this.groundBodyId && this.groundBodyId !== body.bodyId) {
        throw new Error(`Contradictory grounding: Body ${this.groundBodyId} is already grounded`);
      }
      this.groundBodyId = body.bodyId;
    }
    this.bodies.set(body.bodyId, JSON.parse(JSON.stringify(body)));
  }

  public removeBody(bodyId: string): void {
    this.bodies.delete(bodyId);
    if (this.groundBodyId === bodyId) {
      this.groundBodyId = undefined;
    }
  }

  public getBody(bodyId: string): KinematicBody | undefined {
    return this.bodies.get(bodyId);
  }

  public getBodies(): KinematicBody[] {
    return Array.from(this.bodies.values());
  }

  public addJoint(joint: KinematicJoint): void {
    this.joints.set(joint.jointId, JSON.parse(JSON.stringify(joint)));
  }

  public removeJoint(jointId: string): void {
    this.joints.delete(jointId);
  }

  public getJoint(jointId: string): KinematicJoint | undefined {
    return this.joints.get(jointId);
  }

  public getJoints(): KinematicJoint[] {
    return Array.from(this.joints.values());
  }

  public setGroundBody(bodyId: string): void {
    const target = this.bodies.get(bodyId);
    if (!target) {
      throw new Error(`Body ${bodyId} does not exist in assembly`);
    }

    // Clear previous ground flags
    for (const b of this.bodies.values()) {
      b.grounded = false;
    }

    target.grounded = true;
    this.groundBodyId = bodyId;
  }

  public getGroundBody(): KinematicBody | undefined {
    if (!this.groundBodyId) {
      return undefined;
    }
    return this.bodies.get(this.groundBodyId);
  }

  public setConfiguration(config: KinematicConfiguration): void {
    this.currentConfiguration = JSON.parse(JSON.stringify(config));
  }

  public getConfiguration(): KinematicConfiguration | undefined {
    return this.currentConfiguration;
  }

  public snapshot(): KinematicState {
    const copy = new KinematicState(this.assemblyId, this.revisionId);
    copy.groundBodyId = this.groundBodyId;
    for (const b of this.bodies.values()) {
      copy.bodies.set(b.bodyId, JSON.parse(JSON.stringify(b)));
    }
    for (const j of this.joints.values()) {
      copy.joints.set(j.jointId, JSON.parse(JSON.stringify(j)));
    }
    if (this.currentConfiguration) {
      copy.currentConfiguration = JSON.parse(JSON.stringify(this.currentConfiguration));
    }
    return copy;
  }

  public restore(snapshot: KinematicState): void {
    this.assemblyId = snapshot.assemblyId;
    this.revisionId = snapshot.revisionId;
    this.groundBodyId = snapshot.groundBodyId;
    this.bodies.clear();
    for (const b of snapshot.bodies.values()) {
      this.bodies.set(b.bodyId, JSON.parse(JSON.stringify(b)));
    }
    this.joints.clear();
    for (const j of snapshot.joints.values()) {
      this.joints.set(j.jointId, JSON.parse(JSON.stringify(j)));
    }
    this.currentConfiguration = snapshot.currentConfiguration
      ? JSON.parse(JSON.stringify(snapshot.currentConfiguration))
      : undefined;
  }
}
