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
      const pluginSource = await pluginManager.installPlugin(pluginUrl, {...manifestInfo, entryPoint:pluginUrl});
      
      const sourceInfo: SourceInfo = {
        name: pluginSource.name,
        icon: pluginSource.icon,
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
      const updatedPlugin = await pluginManager.updatePlugin(pluginId);
      
      // Update in our list
      const index = this.pluginSources.findIndex(s => s.pluginId === pluginId);
      if (index !== -1) {
        this.pluginSources[index] = {
          name: updatedPlugin.name,
          icon: updatedPlugin.icon,
          source: updatedPlugin,
          pluginId: updatedPlugin.pluginId,
          manifest: updatedPlugin.manifest,
        };
      }
      
      return this.pluginSources[index];
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