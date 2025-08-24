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
      const plugins = await pluginManager.loadAllPlugins();
      this.pluginSources = plugins.map(plugin => ({
        name: plugin.name,
        icon: plugin.icon,
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
      const manifest = await pluginManager.installPlugin(pluginUrl, {
        ...manifestInfo,
        entryPoint: pluginUrl
      });
      
      // Load the plugin to get the source
      const sources = await pluginManager.loadPlugin(manifest.id);
      
      if (sources.length === 0) {
        throw new Error('Plugin did not export any valid source');
      }
      
      const sourceInfo: SourceInfo = {
        name: sources[0].name || manifestInfo.name,
        icon: sources[0].icon || manifestInfo.icon || '',
        source: sources[0],
        pluginId: manifest.id,
        manifest: manifest,
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
      const updatedSources = await pluginManager.updatePlugin(pluginId);
      
      if (updatedSources.length === 0) {
        throw new Error('Plugin update did not return any source');
      }
      
      // Update in our list
      const index = this.pluginSources.findIndex(s => s.pluginId === pluginId);
      if (index !== -1) {
        this.pluginSources[index] = {
          name: updatedSources[0].name,
          icon: updatedSources[0].icon,
          source: updatedSources[0],
          pluginId: updatedSources[0].pluginId,
          manifest: updatedSources[0].manifest,
        };
        return this.pluginSources[index];
      } else {
        // If not found, add it
        const sourceInfo: SourceInfo = {
          name: updatedSources[0].name,
          icon: updatedSources[0].icon,
          source: updatedSources[0],
          pluginId: updatedSources[0].pluginId,
          manifest: updatedSources[0].manifest,
        };
        this.pluginSources.push(sourceInfo);
        return sourceInfo;
      }
      
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