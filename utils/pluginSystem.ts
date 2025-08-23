import { Chapter, Manga, Source } from "@/utils/sourceModel";
import axios from "axios";
import * as FileSystem from 'expo-file-system';

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    icon?: string;
    entryPoint: string;
    installedAt: string;
    updatedAt?: string;
}

export interface PluginSandbox {
    http: {
        get: (url: string, config: any) => Promise<any>;
    };
    // Model classes
    Manga: typeof Manga;
    Chapter: typeof Chapter;
    Source: typeof Source;

    console: {
        log: (...args:any[]) => void;
        warn: (...args:any[]) => void;
        error: (...args:any[]) => void;
    }

    // utitlity functions
    utils: {
        createManga: (params: ConstructorParameters<typeof Manga>[0]) => Manga;
        createChapter: (params: ConstructorParameters<typeof Chapter>[0]) => Chapter;
        createSource: (params: ConstructorParameters<typeof Source>[0]) => Source;
    };
}

export interface PluginSource extends Source {
    pluginId: string;
    manifest: PluginManifest;
}

export class PluginManager {
    private plugins: Map<string, PluginSource> = new Map();
    private pluginsDir: string;
    private manifestPath: string;

    constructor(){
        this.pluginsDir =`${FileSystem.documentDirectory}plugins/`;
        this.manifestPath = `${this.pluginsDir}manifest.json`;
        this.ensurePluginsDirectory();
    }

    private async ensurePluginsDirectory(): Promise<void> {
        try {
            const dirInfo = await FileSystem.getInfoAsync(this.pluginsDir);
            if(!dirInfo.exists){
                await FileSystem.makeDirectoryAsync(this.pluginsDir, { intermediates: true });
            }

            // Initialize manifest if it doesn't exist
            const manifestInfo = await FileSystem.getInfoAsync(this.manifestPath);
            if(!manifestInfo.exists){
                await FileSystem.writeAsStringAsync(this.manifestPath, JSON.stringify([]));
            }
        } catch (error) {
            console.error('Failed to create plugins directory:', error);
        }
    }

    private createSandbox(): PluginSandbox {
        return{
            http: {
                get: async(url:string, config?:any) => {
                    //validate URL
                    if(!this.isValidUrl(url)){
                        throw new Error(`Invalid URL: ${url}`);
                    }

                    try{
                        const response = await axios.get(url, {
                            ...config,
                            timeout: 30000,
                            maxContentLength: 10 * 1024 * 1024, // 10MB limit
                        });
                        return{
                            data: response.data,
                            status: response.status,
                            headers: response.headers,
                        };
                    } catch (error){
                        console.error('HTTP request failed:', error);
                        throw error;
                    }
                }
            },
            Manga,
            Chapter,
            Source,
            console: {
                log: (...args) => console.log('[PLUGIN]', ...args),
                warn: (...args) => console.warn('[PLUGIN]', ...args),
                error: (...args) => console.error('[PLUGIN]', ...args),
            },
            utils: {
                createManga: (params) => new Manga(params),
                createChapter: (params) => new Chapter(params),
                createSource: (params) => new Source(params),
            }
        };
    }

    private isValidUrl(url:string): boolean {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch{
            return false;
        }
    }

    private async readManifest(): Promise<PluginManifest[]> {
        try {
            const manifestContent = await FileSystem.readAsStringAsync(this.manifestPath);
            return JSON.parse(manifestContent);
        } catch (error) {
            console.error('Failed to read manifest:', error);
            return [];
        }
    }

    private async writeManifest(manifests: PluginManifest[]): Promise<void> {
        try {
            await FileSystem.writeAsStringAsync(this.manifestPath, JSON.stringify(manifests, null, 2));
        } catch (error) {
            console.error('Failed to write manifest:', error);
            throw error;
        }
    }

    private async downloadPluginCode(url:string): Promise<string> {
        try {
            const response = await axios.get(url, {
                responseType: 'text',
            });
            return response.data;
        } catch (error) {
            console.error('Failed to download plugin:', error);
            throw new Error(`Failed to download plugin: ${error}`);
        }
    }

    private async savePluginLocally(pluginId: string, code: string): Promise<string> {
        const pluginPath = `${this.pluginsDir}${pluginId}.js`;
        await FileSystem.writeAsStringAsync(pluginPath, code);
        return pluginPath
    }

    private async loadPluginCode(pluginId: string): Promise<string> {
        const pluginPath = `${this.pluginsDir}${pluginId}.js`;
        try {
            return await FileSystem.readAsStringAsync(pluginPath);
        } catch (error) {
            console.error('Failed to load plugin code:', error);
            throw new Error(`Plugin ${pluginId} not found`);
        }
    }

    async installPlugin(
        pluginUrl: string,
        manifest: Omit<PluginManifest, 'id' | 'installedAt' | 'updatedAt'>
    ): Promise<PluginSource>{
        try {
            // download the code
            const pluginCode = await this.downloadPluginCode(pluginUrl);
            // generate unique id
            const pluginId = `plugin_${Date.now}_${Math.random().toString(36).substring(2, 9)}`;

            await this.savePluginLocally(pluginId, pluginCode);

            const fullManifest: PluginManifest = {
                ...manifest,
                id: pluginId,
                installedAt: new Date().toISOString(),
                entryPoint: pluginUrl,
            }

            const manifests = await this.readManifest();
            manifests.push(fullManifest);
            await this.writeManifest(manifests);

            return await this.loadPlugin(pluginId);
        } catch (error) {
            console.error('Failed to install plugin:', error);
            throw new Error(`Plugin installation failed: ${error}`);
        }
    }

    async loadPlugin(pluginId: string): Promise<PluginSource> {
        try {
            if(this.plugins.has(pluginId)){
                return this.plugins.get(pluginId)!;
            }

            const pluginCode = await this.loadPluginCode(pluginId);
            const manifests = await this.readManifest();
            const manifest = manifests.find(m => m.id === pluginId);

            if(!manifest){
                throw new Error(`Plugin ${pluginId} not found in manifest`);
            }

            const sandbox = this.createSandbox();
            const pluginExports = {};
            const pluginModule = { exports: pluginExports };

            const pluginFunction = new Function(
                'sandbox',
                'module',
                'exports',
                `
                with (sandbox) {
                    ${pluginCode}
                }
                `
            );

            pluginFunction(sandbox, pluginModule, pluginExports);

            const source = pluginModule.exports;
            if(!(source instanceof Source)){
                throw new Error('Plugin must export a Source instance');
            }

            const pluginSource: PluginSource = {
                ...source,
                pluginId,
                manifest,
            };

            this.plugins.set(pluginId, pluginSource);
            return pluginSource;
        } catch (error) {
            console.error(`Failed to load plugin ${pluginId}:`, error);
            throw new Error(`Plugin loading failed: ${error}`);
        }
    }

    async loadAllPlugins(): Promise<PluginSource[]> {
        try {
            const manifests = await this.readManifest();
            const loadedPlugins: PluginSource[] = [];

            for(const manifest of manifests){
                try {
                    const plugin = await this.loadPlugin(manifest.id);
                    loadedPlugins.push(plugin);
                } catch (error) {
                    console.error(`Failed to load plugin ${manifest.id}:`, error);
                }
            }

            return loadedPlugins;
        } catch (error) {
            console.error('Failed to load all plugins:', error);
            return [];
        }
    }

    async uninstallPlugin(pluginId:string) : Promise<boolean> {
        try {
            this.plugins.delete(pluginId);

            const manifests = await this.readManifest();
            const filteredManifests = manifests.filter(m => m.id !== pluginId);
            await this.writeManifest(filteredManifests);

            const pluginPath = `${this.pluginsDir}${pluginId}.js`;
            await FileSystem.deleteAsync(pluginPath, { idempotent: true });

            return true;
        } catch (error) {
            console.error(`Failed to uninstall plugin ${pluginId}:`, error);
            return false;
        }
    }

    async getInstalledPlugins(): Promise<PluginManifest[]> {
        return await this.readManifest();
    }

    getLoadedPlugin(pluginId:string): PluginSource | undefined {
        return this.plugins.get(pluginId);
    }

    getAllLoadedPlugins(): PluginSource[] {
        return Array.from(this.plugins.values());
    }

    async updatePlugin(pluginId: string): Promise<PluginSource> {
        try {
        const manifests = await this.readManifest();
        const manifest = manifests.find(m => m.id === pluginId);
        
        if (!manifest) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        // Download updated code
        const updatedCode = await this.downloadPluginCode(manifest.entryPoint);
        
        // Save updated code
        await this.savePluginLocally(pluginId, updatedCode);
        
        // Update manifest timestamp
        manifest.updatedAt = new Date().toISOString();
        await this.writeManifest(manifests);
        
        // Reload plugin
        this.plugins.delete(pluginId); // Remove old version
        return await this.loadPlugin(pluginId);
        
        } catch (error) {
        console.error(`Failed to update plugin ${pluginId}:`, error);
        throw new Error(`Plugin update failed: ${error}`);
        }
    }
}

export const pluginManager = new PluginManager();