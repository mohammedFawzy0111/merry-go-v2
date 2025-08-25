// utils/pluginSystem.ts
import { Chapter, Manga, Source } from "@/utils/sourceModel";
import axios from "axios";
import * as FileSystem from "expo-file-system";

const REPOSITORY_BASE_URL = "https://raw.githubusercontent.com/mohammedFawzy0111/merry-go-plugins/main/";
const REMOTE_MANIFEST_URL = `${REPOSITORY_BASE_URL}manifest.json`;

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  icon?: string;
  entryPoint: string;
  installedAt: string;
  updatedAt?: string;
}

export interface RepositoryPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  entryPoint: string;
  minAppVersion?: string;
  language?: string;
}

export interface PluginRepository {
  plugins: RepositoryPlugin[];
}

export interface PluginSandbox {
  http: {
    get: (url: string, config?: any) => Promise<any>;
  };
  // Model classes
  Manga: typeof Manga;
  Chapter: typeof Chapter;
  Source: typeof Source;

  console: {
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };

  utils: {
    createManga: (params: ConstructorParameters<typeof Manga>[0]) => Manga;
    createChapter: (params: ConstructorParameters<typeof Chapter>[0]) => Chapter;
    createSource: (params: ConstructorParameters<typeof Source>[0]) => Source;
  };

  // plugin can call this to register sources
  registerSource?: (s: any) => void;
}

export interface PluginSource extends Source {
  pluginId: string;
  manifest: PluginManifest;
}

const DEFAULT_EXEC_TIMEOUT = 5000; // ms

export class PluginManager {
  private plugins: Map<string, PluginSource> = new Map();
  private pluginsDir: string;
  private manifestPath: string;

  constructor() {
    this.pluginsDir = `${FileSystem.documentDirectory}plugins/`;
    this.manifestPath = `${this.pluginsDir}manifest.json`;
    this.ensurePluginsDirectory();
  }

  private async ensurePluginsDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.pluginsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.pluginsDir, { intermediates: true });
      }

      const manifestInfo = await FileSystem.getInfoAsync(this.manifestPath);
      if (!manifestInfo.exists) {
        await FileSystem.writeAsStringAsync(this.manifestPath, JSON.stringify([]));
      }
    } catch (error) {
      console.error("Failed to create plugins directory:", error);
    }
  }

  // ---- URL helpers ----
  private normalizePluginUrl(url: string): string {
    // Handle relative URLs from repository
    if (url.startsWith('/')) {
      return `${REPOSITORY_BASE_URL}${url.substring(1)}`;
    }
    
    // Handle GitHub blob URLs
    if (url.includes("github.com") && url.includes("/blob/")) {
      return url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
    }
    
    return url;
  }

  private isValidUrl(url: string) {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  // ---- fetch / save plugin code ----
  private async downloadPluginCode(url: string): Promise<string> {
    const normalized = this.normalizePluginUrl(url);
    if (!this.isValidUrl(normalized)) {
      throw new Error("Invalid plugin URL");
    }

    try {
      const res = await axios.get(normalized, { responseType: "text", timeout: 30000 });
      return res.data as string;
    } catch (err) {
      console.error("Failed to download plugin:", err);
      throw err;
    }
  }

  private async savePluginLocally(pluginId: string, code: string): Promise<string> {
    const pluginPath = `${this.pluginsDir}${pluginId}.js`;
    await FileSystem.writeAsStringAsync(pluginPath, code);
    return pluginPath;
  }

  private async loadPluginCode(pluginId: string): Promise<string> {
    const pluginPath = `${this.pluginsDir}${pluginId}.js`;
    try {
      return await FileSystem.readAsStringAsync(pluginPath);
    } catch (error) {
      console.error("Failed to load plugin code:", error);
      throw new Error(`Plugin ${pluginId} not found`);
    }
  }

  // ---- manifest helpers ----
  private async readManifest(): Promise<PluginManifest[]> {
    try {
      const manifestContent = await FileSystem.readAsStringAsync(this.manifestPath);
      return JSON.parse(manifestContent || "[]") as PluginManifest[];
    } catch (error) {
      console.error("Failed to read manifest:", error);
      return [];
    }
  }

  private async writeManifest(manifests: PluginManifest[]): Promise<void> {
    try {
      await FileSystem.writeAsStringAsync(this.manifestPath, JSON.stringify(manifests, null, 2));
    } catch (error) {
      console.error("Failed to write manifest:", error);
      throw error;
    }
  }

  // ---- code validation (light) ----
  private validatePluginCode(code: string) {
    // Only detect obvious disallowed tokens. Do not destructively replace tokens.
    const blacklist = ["process.", "global.", "window.", "document.", "localStorage", "XMLHttpRequest", "WebSocket"];
    const violations = blacklist.filter(tok => code.includes(tok));
    if (violations.length) {
      throw new Error("Plugin contains prohibited tokens: " + violations.join(", "));
    }
  }

  // ---- timeout wrapper ----
  private async runWithTimeout<T>(fn: () => Promise<T>, ms = DEFAULT_EXEC_TIMEOUT): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Plugin execution timed out"));
      }, ms);

      try {
        const result = await fn();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  // ---- validation for single source ----
  private validateSingleSource(pluginId: string, sources: any[]): void {
    if (sources.length > 1) {
      throw new Error(`Plugin ${pluginId} attempted to register multiple sources. Only one source per plugin is allowed.`);
    }
  }

  // ---- execution (safer new Function usage) ----
  private async executePluginSafely(
    code: string,
    sandbox: PluginSandbox,
    moduleObj: any,
    exportsObj: any
  ): Promise<any> {
    const wrapped = `
      const { http, Manga, Chapter, Source, console: pluginConsole, utils, registerSource } = sandbox;
      try {
        Object.freeze(Manga?.prototype);
        Object.freeze(Chapter?.prototype);
        Object.freeze(Source?.prototype);
      } catch(e) {}

      try {
        ${code}
      } catch (err) {
        pluginConsole?.error?.('Plugin runtime error:', err);
        throw err;
      }

      if (module?.exports && Object.keys(module.exports).length) return module.exports;
      if (exports?.default !== undefined) return exports.default;
      return undefined;
    `;


    try {
      const fn = new Function("sandbox", "module", "exports", wrapped);
      const exec = () => fn(sandbox, moduleObj, exportsObj);
      const result = this.runWithTimeout(exec, DEFAULT_EXEC_TIMEOUT);
      return result;
    } catch (error) {
      console.error("Plugin execution failed:", error);
      throw error;
    }
  }

  // ---- load plugin (core) ----
  async loadPlugin(pluginId: string): Promise<PluginSource[]> {
    try {
      // already loaded?
      if (this.plugins.has(pluginId)) {
        return [this.plugins.get(pluginId)!];
      }

      const code = await this.loadPluginCode(pluginId);
      const manifests = await this.readManifest();
      const manifest = manifests.find(m => m.id === pluginId);
      if (!manifest) throw new Error(`Manifest for ${pluginId} not found`);

      // validate (light)
      this.validatePluginCode(code);

      // prepare sandbox & collector
      const registeredSources: any[] = [];

      const sandbox = this.createSandboxForExecution(registeredSources);

      // prepare module/exports objects (CommonJS-like)
      const pluginModule: any = { exports: {} };
      const pluginExports: any = {};

      // execute plugin code
      const execResult = await this.executePluginSafely(code, sandbox, pluginModule, pluginExports);

      // Determine sources that plugin produced:
      let discoveredSources: any[] = [];

      if (registeredSources.length > 0) {
        discoveredSources.push(...registeredSources);
      } else {
        const candidate = execResult || pluginModule.exports || pluginExports.default || pluginExports;
        if (candidate) {
          if (Array.isArray(candidate)) discoveredSources.push(...candidate);
          else discoveredSources.push(candidate);
        }
      }

      // Validate that only one source is provided
      this.validateSingleSource(pluginId, discoveredSources);

      if (discoveredSources.length === 0) {
        throw new Error(`Plugin ${pluginId} did not export any source`);
      }

      // If we have exactly one source, process it
      let sourceObj: any = discoveredSources[0];

      // Handle class constructors
      if (typeof sourceObj === 'function' && sourceObj.prototype instanceof Source) {
        try {
          sourceObj = new sourceObj();
        } catch (err) {
          console.error("Failed to instantiate Source class:", err);
          throw new Error(`Plugin ${pluginId} exported a Source class but failed to instantiate it`);
        }
      }

      // Convert plain object to Source instance if needed
      if (!(sourceObj instanceof Source) && typeof sourceObj === "object") {
        try {
          sourceObj = new Source(sourceObj);
          Object.assign(sourceObj, discoveredSources[0]);
        } catch (err) {
          sourceObj = discoveredSources[0];
        }
      }

      // ensure it has id
      const sourceId = (sourceObj && sourceObj.id) || pluginId;

      const pluginSource: PluginSource = {
        ...sourceObj,
        id: sourceId,
        pluginId,
        manifest,
      };

      this.plugins.set(pluginId, pluginSource);
      return [pluginSource];
    } catch (err) {
      console.error(`Failed to load plugin ${pluginId}:`, err);
      throw err;
    }
  }

  private createSandboxForExecution(collector: any[]): PluginSandbox {
    const sandbox: PluginSandbox = {
      http: {
        get: async (url: string, config?: any) => {
          if (!this.isValidUrl(url)) throw new Error("Invalid URL");
          const response = await axios.get(url, { ...config, timeout: 30000 });
          return { data: response.data, status: response.status, headers: response.headers };
        },
      },
      Manga,
      Chapter,
      Source,
      console: {
        log: (...args: any[]) => console.log("[PLUGIN]", ...args),
        warn: (...args: any[]) => console.warn("[PLUGIN]", ...args),
        error: (...args: any[]) => console.error("[PLUGIN]", ...args),
      },
      utils: {
        createManga: (params: any) => new Manga(params),
        createChapter: (params: any) => new Chapter(params),
        createSource: (params: any) => new Source(params),
      },
      registerSource: (s: any) => {
        if (collector.length > 0) {
          throw new Error("Only one source can be registered per plugin");
        }
        collector.push(s);
      },
    };

    // Return a Proxy to block additions/overrides
    const proxy = new Proxy(sandbox, {
      has: (target, prop) => prop in target,
      get: (target, prop) => {
        if (prop in target) {
          const val = (target as any)[prop];
          return typeof val === "function" ? val.bind(target) : val;
        }
        throw new Error(`Access to '${String(prop)}' is not allowed in plugin sandbox`);
      },
      set: () => {
        throw new Error("Modifying the sandbox is not allowed");
      },
    });

    return proxy as unknown as PluginSandbox;
  }

  // ---- install plugin: download + save + write manifest ----
  async installPlugin(
    pluginUrl: string,
    manifestPart: Omit<PluginManifest, "id" | "installedAt" | "updatedAt">
  ): Promise<PluginManifest> {
    try {
      const code = await this.downloadPluginCode(pluginUrl);
      this.validatePluginCode(code);

      const pluginId = `plugin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await this.savePluginLocally(pluginId, code);

      const fullManifest: PluginManifest = {
        ...manifestPart,
        id: pluginId,
        installedAt: new Date().toISOString(),
        entryPoint: pluginUrl,
      };

      const manifests = await this.readManifest();
      manifests.push(fullManifest);
      await this.writeManifest(manifests);

      return fullManifest;
    } catch (err) {
      console.error("installPlugin failed:", err);
      throw err;
    }
  }

  async uninstallPlugin(pluginId: string): Promise<boolean> {
    try {
      this.plugins.delete(pluginId);
      const manifests = await this.readManifest();
      const filtered = manifests.filter(m => m.id !== pluginId);
      await this.writeManifest(filtered);
      const pluginPath = `${this.pluginsDir}${pluginId}.js`;
      await FileSystem.deleteAsync(pluginPath, { idempotent: true });
      return true;
    } catch (err) {
      console.error("uninstallPlugin failed:", err);
      return false;
    }
  }

  async loadAllPlugins(): Promise<PluginSource[]> {
    const manifests = await this.readManifest();
    const loaded: PluginSource[] = [];
    for (const m of manifests) {
      try {
        const list = await this.loadPlugin(m.id);
        loaded.push(...list);
      } catch (err) {
        console.error("loadAllPlugins: failed to load", m.id, err);
      }
    }
    return loaded;
  }

  getInstalledPlugins(): Promise<PluginManifest[]> {
    return this.readManifest();
  }

  getLoadedPlugin(pluginId: string): PluginSource | undefined {
    return this.plugins.get(pluginId);
  }

  getAllLoadedPlugins(): PluginSource[] {
    return Array.from(this.plugins.values());
  }

  async updatePlugin(pluginId: string): Promise<PluginSource[]> {
    const manifests = await this.readManifest();
    const manifest = manifests.find(m => m.id === pluginId);
    if (!manifest) throw new Error("manifest not found");
    const code = await this.downloadPluginCode(manifest.entryPoint);
    this.validatePluginCode(code);
    await this.savePluginLocally(pluginId, code);
    manifest.updatedAt = new Date().toISOString();
    await this.writeManifest(manifests);
    this.plugins.delete(pluginId);
    return await this.loadPlugin(pluginId);
  }

  // ---- Repository integration methods ----
  
  async getAvailablePlugins(): Promise<RepositoryPlugin[]> {
    try {
      const response = await axios.get<PluginRepository>(REMOTE_MANIFEST_URL, {
        timeout: 60000,
      });
      
      if (response.data && Array.isArray(response.data.plugins)) {
        return response.data.plugins;
      }
      
      console.warn('Invalid repository format:', response.data);
      return [];
    } catch (error) {
      console.error('Failed to fetch available plugins:', error);
      return [];
    }
  }

  async searchAvailablePlugins(query: string): Promise<RepositoryPlugin[]> {
    const plugins = await this.getAvailablePlugins();
    
    return plugins.filter(plugin =>
      plugin.name.toLowerCase().includes(query.toLowerCase()) ||
      (plugin.description && plugin.description.toLowerCase().includes(query.toLowerCase()))
    );
  }

  async getPluginFromRepository(pluginId: string): Promise<RepositoryPlugin | null> {
    const plugins = await this.getAvailablePlugins();
    return plugins.find(plugin => plugin.id === pluginId) || null;
  }

  async installPluginFromRepository(pluginId: string): Promise<PluginManifest> {
    const plugin = await this.getPluginFromRepository(pluginId);
    
    if (!plugin) {
      throw new Error(`Plugin with ID ${pluginId} not found in repository`);
    }

    return this.installPlugin(plugin.entryPoint, {
      name: plugin.name,
      version: plugin.version,
      icon: plugin.icon,
      entryPoint: plugin.entryPoint
    });
  }

  async installPluginsFromRepository(pluginIds: string[]): Promise<PluginManifest[]> {
    const results: PluginManifest[] = [];
    
    for (const pluginId of pluginIds) {
      try {
        const manifest = await this.installPluginFromRepository(pluginId);
        results.push(manifest);
      } catch (error) {
        console.error(`Failed to install plugin ${pluginId}:`, error);
      }
    }
    
    return results;
  }

  async checkForUpdates(): Promise<{pluginId: string, currentVersion: string, availableVersion: string}[]> {
    const installedPlugins = await this.getInstalledPlugins();
    const availablePlugins = await this.getAvailablePlugins();
    
    const updates: {pluginId: string, currentVersion: string, availableVersion: string}[] = [];
    
    for (const installed of installedPlugins) {
      const available = availablePlugins.find(p => p.name === installed.name);
      
      if (available && this.isNewerVersion(available.version, installed.version)) {
        updates.push({
          pluginId: installed.id,
          currentVersion: installed.version,
          availableVersion: available.version
        });
      }
    }
    
    return updates;
  }

  private isNewerVersion(available: string, current: string): boolean {
    const availableParts = available.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < Math.max(availableParts.length, currentParts.length); i++) {
      const availablePart = availableParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      
      if (availablePart > currentPart) return true;
      if (availablePart < currentPart) return false;
    }
    
    return false;
  }

  async updateAllPlugins(): Promise<PluginSource[]> {
    const updates = await this.checkForUpdates();
    const updated: PluginSource[] = [];
    
    for (const update of updates) {
      try {
        await this.uninstallPlugin(update.pluginId);
        await this.installPluginFromRepository(update.pluginId);
        const sources = await this.loadPlugin(update.pluginId);
        updated.push(...sources);
        console.log(`✅ Updated ${update.pluginId} from ${update.currentVersion} to ${update.availableVersion}`);
      } catch (error) {
        console.error(`❌ Failed to update ${update.pluginId}:`, error);
      }
    }
    
    return updated;
  }
}

export const pluginManager = new PluginManager();