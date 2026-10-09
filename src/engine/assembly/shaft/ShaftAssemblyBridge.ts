import { ShaftDefinition } from './ShaftTypes';

export class ShaftAssemblyBridge {
  private static registeredShafts = new Map<string, ShaftDefinition>();

  public static registerDefinition(def: ShaftDefinition): void {
    this.registeredShafts.set(def.shaftId, def);
  }

  public static getDefinition(id: string): ShaftDefinition | undefined {
    return this.registeredShafts.get(id);
  }
}
