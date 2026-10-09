export interface SecpPluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  category: string;
  description: string;
  enabled: boolean;
  iconName: string;
}

export interface SecpPluginTool {
  id: string;
  name: string;
  description: string;
  executionKind?: string; // Links to CoreExecutionAuthority executionKind
  compute: (inputs: Record<string, any>) => Record<string, any>; // Legacy synchronous path
  executeAuthoritative?: (inputs: Record<string, any>) => Promise<any>; // M8 Authoritative path
}

export interface SecpPluginWorkbench {
  manifest: SecpPluginManifest;
  defaultParameters: Record<string, any>;
  tools: SecpPluginTool[];
}

export class SecpPluginRegistry {
  private static plugins: Map<string, SecpPluginWorkbench> = new Map();

  public static registerPlugin(plugin: SecpPluginWorkbench | any): void {
    if (plugin && plugin.manifest && plugin.manifest.id) {
      this.plugins.set(plugin.manifest.id, plugin);
    } else if (plugin && plugin.id) {
      this.plugins.set(plugin.id, {
        manifest: {
          id: plugin.id,
          name: plugin.name || plugin.id,
          version: plugin.version || '1.0.0',
          author: 'SECP Labs',
          category: 'general',
          description: plugin.description || '',
          enabled: true,
          iconName: 'Boxes'
        },
        defaultParameters: plugin.defaultParameters || {},
        tools: plugin.tools || []
      });
    }
  }

  public static getRegisteredPlugins(): SecpPluginWorkbench[] {
    return Array.from(this.plugins.values());
  }

  public static getPlugin(id: string): SecpPluginWorkbench | undefined {
    return this.plugins.get(id);
  }
}

export class SecpPluginSdk {
  public static registerPlugin(name: string, config: any) {
    return { id: `plugin-${Date.now()}`, name, config, status: 'LOADED' };
  }
}
