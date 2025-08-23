import axios from 'axios';

export interface RepositoryPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  entryPoint: string;
  minAppVersion: string;
}

export interface PluginRepository {
  name: string;
  version: string;
  description: string;
  plugins: RepositoryPlugin[];
}

export class PluginRepositoryService {
  private repositoryUrl = 'https://raw.githubusercontent.com/mohammedFawzy0111/merry-go-plugins/main/manifest.json';

  async getAvailablePlugins(): Promise<RepositoryPlugin[]> {
    try {
      const response = await axios.get<PluginRepository>(this.repositoryUrl, {
        timeout: 60000,
      });
     console.log(response.data) 
      return response.data.plugins || [];
    } catch (error) {
      console.error('Failed to fetch available plugins:', error);
      return [];
    }
  }

  async searchPlugins(query: string): Promise<RepositoryPlugin[]> {
    const plugins = await this.getAvailablePlugins();
    
    return plugins.filter(plugin =>
      plugin.name.toLowerCase().includes(query.toLowerCase()) ||
      plugin.description.toLowerCase().includes(query.toLowerCase())
    );
  }

  async getPluginById(id: string): Promise<RepositoryPlugin | null> {
    const plugins = await this.getAvailablePlugins();
    return plugins.find(plugin => plugin.id === id) || null;
  }

  // Set a different repository URL
  setRepositoryUrl(url: string): void {
    this.repositoryUrl = url;
  }

  // Get current repository URL
  getRepositoryUrl(): string {
    return this.repositoryUrl;
  }
}

export const pluginRepositoryService = new PluginRepositoryService();
