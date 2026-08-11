export interface SecpPluginManifest {
  id: string; // e.g. 'secp-plugin-automotive'
  name: string; // e.g. 'Automotive Engineering Workbench'
  version: string; // e.g. '1.0.0'
  author: string;
  category: 'automotive' | 'aerospace' | 'marine' | 'energy' | 'robotics' | 'oil-gas';
  description: string;
  enabled: boolean;
  iconName: string;
}

export interface SecpCalculationTool {
  id: string;
  name: string;
  description: string;
  compute: (inputs: Record<string, number>) => Record<string, number | string>;
}

export interface SecpPluginWorkbench {
  manifest: SecpPluginManifest;
  tools: SecpCalculationTool[];
  defaultParameters: Record<string, number>;
  onInit?: () => void;
  onCadUpdate?: (cadEntityName: string) => void;
}

export class SecpPluginRegistry {
  private static plugins: Map<string, SecpPluginWorkbench> = new Map();

  public static registerPlugin(plugin: SecpPluginWorkbench): void {
    this.plugins.set(plugin.manifest.id, plugin);
    if (plugin.onInit) {
      plugin.onInit();
    }
  }

  public static getRegisteredPlugins(): SecpPluginWorkbench[] {
    return Array.from(this.plugins.values());
  }

  public static getPluginById(id: string): SecpPluginWorkbench | undefined {
    return this.plugins.get(id);
  }

  public static togglePlugin(id: string, enabled: boolean): void {
    const plugin = this.plugins.get(id);
    if (plugin) {
      plugin.manifest.enabled = enabled;
    }
  }

  public static executeCadUpdateHook(cadName: string): void {
    this.plugins.forEach(p => {
      if (p.manifest.enabled && p.onCadUpdate) {
        p.onCadUpdate(cadName);
      }
    });
  }
}
