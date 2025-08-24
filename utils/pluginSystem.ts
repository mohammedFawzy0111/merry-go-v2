// utils/pluginSystem.ts
import { Chapter, Manga, Source } from "@/utils/sourceModel";
import axios from "axios";
import * as FileSystem from "expo-file-system";
import "ses"; // SES runtime

lockdown(); // hardens global objects for secure compartments

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
    get: (url: string, config?: any) => Promise<any>;
  };
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
  private normalizeRawGitHubUrl(url: string) {
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
    const normalized = this.normalizeRawGitHubUrl(url);
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

  private validatePluginCode(code: string) {
    const blacklist = ["process.", "global.", "window.", "document.", "localStorage", "XMLHttpRequest", "WebSocket"];
    const violations = blacklist.filter(tok => code.includes(tok));
    if (violations.length) {
      throw new Error("Plugin contains prohibited tokens: " + violations.join(", "));
    }
  }

  private runWithTimeout<T>(fn: () => Promise<T>, ms = DEFAULT_EXEC_TIMEOUT): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          reject(new Error("Plugin execution timed out"));
        }
      }, ms);
      fn()
        .then(res => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            resolve(res);
          }
        })
        .catch(err => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  }

<<<<<<< HEAD
<<<<<<< HEAD
  private validateSingleSource(pluginId: string, sources: any[]): void {
    if (sources.length > 1) {
      throw new Error(`Plugin ${pluginId} attempted to register multiple sources. Only one source per plugin is allowed.`);
    }
  }

  // ---- NEW: SES-based execution ----
  private async executePluginSafely(code: string, sandbox: PluginSandbox, moduleObj: any, exportsObj: any): Promise<any> {
    const compartment = new Compartment({
      http: sandbox.http,
      Manga: sandbox.Manga,
      Chapter: sandbox.Chapter,
      Source: sandbox.Source,
      console: sandbox.console,
      utils: sandbox.utils,
      registerSource: sandbox.registerSource,
      module: moduleObj,
      exports: exportsObj,
    });

    const exec = async () => {
      try {
        // Wrap plugin in async IIFE so top-level await works
        return compartment.evaluate(`
          (async () => {
            ${code}
            if (module && Object.keys(module.exports).length) return module.exports;
            if (exports && exports.default !== undefined) return exports.default;
            return undefined;
          })()
        `);
      } catch (err) {
        sandbox.console.error("Plugin runtime error:", err);
        throw err;
=======
=======
>>>>>>> parent of 742dd0a (fix plugin loading)
  // ---- execution (safer new Function usage) ----
  /**
   * Execute plugin code inside a light sandbox.
   * plugin code can:
   *  - assign to module.exports
   *  - assign exports.default
   *  - call registerSource(...) which we inject into sandbox
   *
   * returns the object from module.exports (if any) or exports.default or undefined.
   */
  private async executePluginSafely(
    code: string,
    sandbox: PluginSandbox,
    moduleObj: any,
    exportsObj: any
  ): Promise<any> {
    // Do not mutate plugin code; we will execute it within an async IIFE so plugin may use top-level await
    const wrapped = `
      return (async function(sandbox, module, exports) {
        // Shadow dangerous globals
        const globalThis = undefined, window = undefined, self = undefined;
        // make constructor inaccessible
        const Function = undefined, eval = undefined;
        // expose sandbox variables to local scope
        const { http, Manga, Chapter, Source, console: pluginConsole, utils, registerSource } = sandbox;

        // Freeze prototypes so plugin cannot easily mutate constructors
        try {
          Object.freeze(Manga && Manga.prototype);
          Object.freeze(Chapter && Chapter.prototype);
          Object.freeze(Source && Source.prototype);
        } catch(e) {}

        try {
          ${code}
        } catch (err) {
          // forward plugin errors
          pluginConsole && pluginConsole.error && pluginConsole.error('Plugin runtime error:', err);
          throw err;
        }

        // Return module.exports if provided, else exports.default if provided
        if (module && module.exports && Object.keys(module.exports).length) return module.exports;
        if (exports && (exports.default !== undefined)) return exports.default;
        return undefined;
      })(sandbox, module, exports);
    `;

    // create function and execute with timeout
    const fn = new Function("sandbox", "module", "exports", wrapped);
    const exec = () => Promise.resolve(fn(sandbox, moduleObj, exportsObj));
    const result = await this.runWithTimeout(exec, DEFAULT_EXEC_TIMEOUT);
    return result;
  }

  // ---- load plugin (core) ----
  async loadPlugin(pluginId: string): Promise<PluginSource[]> {
    try {
      // already loaded?
      if (Array.from(this.plugins.keys()).some(k => k.startsWith(pluginId + ":"))) {
        // return loaded plugin sources for this plugin
        return Array.from(this.plugins.values()).filter(p => p.pluginId === pluginId);
<<<<<<< HEAD
>>>>>>> parent of 742dd0a (fix plugin loading)
=======
>>>>>>> parent of 742dd0a (fix plugin loading)
      }
    };

<<<<<<< HEAD
    return this.runWithTimeout(exec, DEFAULT_EXEC_TIMEOUT);
=======
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
      // 1) If plugin used registerSource(), we have collected them
      // 2) Else, check module.exports or exports.default for a Source or array of Source
      const discoveredSources: any[] = [];

      if (registeredSources.length > 0) {
        discoveredSources.push(...registeredSources);
      } else {
        const candidate = execResult || pluginModule.exports || pluginExports.default || pluginExports;
        if (candidate) {
          // accept single source or array
          if (Array.isArray(candidate)) discoveredSources.push(...candidate);
          else discoveredSources.push(candidate);
        }
      }

      // Normalize and register discovered sources
      const registered: PluginSource[] = [];

      for (let i = 0; i < discoveredSources.length; i++) {
        const s = discoveredSources[i];

        // If plugin returned something that looks like a Source object (duck-typing),
        // try to create a proper Source instance if it's plain object (optional).
        let sourceObj: any = s;
        if (!(s instanceof Source) && typeof s === "object") {
          // try to create Source instance if available fields exist
          try {
            sourceObj = new Source(s);
            // copy over methods if plugin provided functions separately
            Object.assign(sourceObj, s);
          } catch (err) {
            // fallback: keep the object as is and hope it matches Source interface
            sourceObj = s;
          }
        }

        // ensure it has id
        const sourceId = (sourceObj && sourceObj.id) || `source_${pluginId}_${i}`;

        // plugin-scoped map key to allow multiple sources per plugin
        const mapKey = `${pluginId}:${sourceId}`;

        const pluginSource: PluginSource = {
          ...sourceObj,
          id: sourceId,
          pluginId,
          manifest,
        };

        this.plugins.set(mapKey, pluginSource);
        registered.push(pluginSource);
      }

      return registered;
    } catch (err) {
      console.error(`Failed to load plugin ${pluginId}:`, err);
      throw err;
    }
>>>>>>> parent of 742dd0a (fix plugin loading)
  }

  private createSandboxForExecution(collector: any[]): PluginSandbox {
    return {
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
        collector.push(s);
      },
    };
  }

  // ---- load plugin (core) ----
  async loadPlugin(pluginId: string): Promise<PluginSource[]> {
    try {
      if (this.plugins.has(pluginId)) {
        return [this.plugins.get(pluginId)!];
      }
      const code = await this.loadPluginCode(pluginId);
      const manifests = await this.readManifest();
      const manifest = manifests.find(m => m.id === pluginId);
      if (!manifest) throw new Error(`Manifest for ${pluginId} not found`);

      this.validatePluginCode(code);

      const registeredSources: any[] = [];
      const sandbox = this.createSandboxForExecution(registeredSources);

      const pluginModule: any = { exports: {} };
      const pluginExports: any = {};

      const execResult = await this.executePluginSafely(code, sandbox, pluginModule, pluginExports);

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

      this.validateSingleSource(pluginId, discoveredSources);

      if (discoveredSources.length === 0) {
        throw new Error(`Plugin ${pluginId} did not export any source`);
      }

      let sourceObj: any = discoveredSources[0];
      if (typeof sourceObj === "function" && sourceObj.prototype instanceof Source) {
        try {
          sourceObj = new sourceObj();
        } catch (err) {
          console.error("Failed to instantiate Source class:", err);
          throw new Error(`Plugin ${pluginId} exported a Source class but failed to instantiate it`);
        }
      }
      if (!(sourceObj instanceof Source) && typeof sourceObj === "object") {
        try {
          sourceObj = new Source(sourceObj);
          Object.assign(sourceObj, discoveredSources[0]);
        } catch {
          sourceObj = discoveredSources[0];
        }
      }
      const sourceId = (sourceObj && sourceObj.id) || pluginId;
      const pluginSource: PluginSource = { ...sourceObj, id: sourceId, pluginId, manifest };

      this.plugins.set(pluginId, pluginSource);
      return [pluginSource];
    } catch (err) {
      console.error(`Failed to load plugin ${pluginId}:`, err);
      throw err;
    }
  }

  // ---- install/uninstall/update remain unchanged ----
  async installPlugin(pluginUrl: string, manifestPart: Omit<PluginManifest, "id" | "installedAt" | "updatedAt">): Promise<PluginManifest> {
    try {
      const code = await this.downloadPluginCode(pluginUrl);
      this.validatePluginCode(code);
      const pluginId = `plugin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await this.savePluginLocally(pluginId, code);
      const fullManifest: PluginManifest = { ...manifestPart, id: pluginId, installedAt: new Date().toISOString(), entryPoint: pluginUrl };
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
<<<<<<< HEAD
<<<<<<< HEAD
      this.plugins.delete(pluginId);
=======
=======
>>>>>>> parent of 742dd0a (fix plugin loading)
      // remove loaded plugin entries (all keys that start with pluginId:)
      const keys = Array.from(this.plugins.keys()).filter(k => k.startsWith(`${pluginId}:`));
      for (const k of keys) this.plugins.delete(k);

>>>>>>> parent of 742dd0a (fix plugin loading)
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

  getLoadedPlugin(pluginKey: string): PluginSource | undefined {
    // pluginKey is pluginId:sourceId
    return this.plugins.get(pluginKey);
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
<<<<<<< HEAD
<<<<<<< HEAD
    this.plugins.delete(pluginId);
=======
=======
>>>>>>> parent of 742dd0a (fix plugin loading)
    // reload
    // remove old entries
    const oldKeys = Array.from(this.plugins.keys()).filter(k => k.startsWith(`${pluginId}:`));
    for (const k of oldKeys) this.plugins.delete(k);
<<<<<<< HEAD
>>>>>>> parent of 742dd0a (fix plugin loading)
=======
>>>>>>> parent of 742dd0a (fix plugin loading)
    return await this.loadPlugin(pluginId);
  }
}

export const pluginManager = new PluginManager();
