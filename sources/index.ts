// sources/index.ts
import { pluginManager } from '@/utils/pluginSystem';
import { Source } from '@/utils/sourceModel';

export interface SourceInfo {
  name: string;
  icon: string;
  source: Source;
  pluginId: string;
  manifest: any;
}

class SourceManager {
  private pluginSources: SourceInfo[] = [];

  async initialize(): Promise<void> {
    try {
      await this.loadAllPluginSources();
    } catch (error) {
      console.error('Failed to initialize source manager:', error);
    }
  }

  private async loadAllPluginSources(): Promise<void> {
    try {
      const pluginsArrays = await pluginManager.loadAllPlugins();
      // pluginManager.loadAllPlugins() returns PluginSource[][]
      // We need to flatten the array of arrays
      const allPlugins = pluginsArrays.flat();
      
      this.pluginSources = allPlugins.map(plugin => ({
        name: plugin.name,
        icon: plugin.icon || '',
        source: plugin,
        pluginId: plugin.pluginId,
        manifest: plugin.manifest,
      }));
    } catch (error) {
      console.error('Failed to load plugin sources:', error);
    }
  }

  async installPluginSource(pluginUrl: string, manifestInfo: {
    name: string;
    version: string;
    icon?: string;
  }): Promise<SourceInfo> {
    try {
      const pluginManifest = await pluginManager.installPlugin(pluginUrl, {
        ...manifestInfo, 
        entryPoint: pluginUrl
      });
      
      // Load the plugin - this returns PluginSource[]
      const pluginSources = await pluginManager.loadPlugin(pluginManifest.id);
      if (pluginSources.length === 0) {
        throw new Error('Plugin did not provide any source');
      }
      
      // Take the first (and only) source from the array
      const pluginSource = pluginSources[0];
      
      const sourceInfo: SourceInfo = {
        name: pluginSource.name,
        icon: pluginSource.icon || '',
        source: pluginSource,
        pluginId: pluginSource.pluginId,
        manifest: pluginSource.manifest,
      };
      
      this.pluginSources.push(sourceInfo);
      return sourceInfo;
      
    } catch (error) {
      console.error('Failed to install plugin source:', error);
      throw error;
    }
  }

  async uninstallPluginSource(pluginId: string): Promise<boolean> {
    try {
      const success = await pluginManager.uninstallPlugin(pluginId);
      if (success) {
        this.pluginSources = this.pluginSources.filter(s => s.pluginId !== pluginId);
      }
      return success;
    } catch (error) {
      console.error('Failed to uninstall plugin source:', error);
      return false;
    }
  }

  getAllSources(): SourceInfo[] {
    return this.pluginSources;
  }

  getSourceByName(name: string): SourceInfo | undefined {
    return this.pluginSources.find(s => s.name === name);
  }

  getSourceByPluginId(pluginId: string): SourceInfo | undefined {
    return this.pluginSources.find(s => s.pluginId === pluginId);
  }

  async updatePluginSource(pluginId: string): Promise<SourceInfo> {
    try {
      // updatePlugin returns PluginSource[]
      const updatedPlugins = await pluginManager.updatePlugin(pluginId);
      if (updatedPlugins.length === 0) {
        throw new Error('No source found after update');
      }
      
      // Take the first (and only) source from the array
      const updatedPlugin = updatedPlugins[0];
      
      // Update in our list
      const index = this.pluginSources.findIndex(s => s.pluginId === pluginId);
      if (index !== -1) {
        this.pluginSources[index] = {
          name: updatedPlugin.name,
          icon: updatedPlugin.icon || '',
          source: updatedPlugin,
          pluginId: updatedPlugin.pluginId,
          manifest: updatedPlugin.manifest,
        };
        return this.pluginSources[index];
      }
      
      // If not found, add it
      const sourceInfo: SourceInfo = {
        name: updatedPlugin.name,
        icon: updatedPlugin.icon || '',
        source: updatedPlugin,
        pluginId: updatedPlugin.pluginId,
        manifest: updatedPlugin.manifest,
      };
      this.pluginSources.push(sourceInfo);
      return sourceInfo;
      
    } catch (error) {
      console.error('Failed to update plugin source:', error);
      throw error;
    }
  }
}

export const sourceManager = new SourceManager();
export const placeHolderSource = new Source({
  name: "placeholder",
  baseUrl: "example.com",
  icon: "https://example.com/icon.png",
});

// Initialize when imported
sourceManager.initialize();