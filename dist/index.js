import * as path from 'node:path';
import path__default from 'node:path';
import { createLogger, normalizePath } from 'vite';
import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

function normalizeOptions(options) {
    var _a, _b, _c, _d, _e;
    const anyAsBool = (value) => !!value;
    const anyAsOptStr = (value) => (typeof value === "string" ? value : null);
    const anyAsAutoOrBool = (value) => value === "auto" ? "auto" : anyAsBool(value);
    const verbose = anyAsBool(options.verbose);
    const skipBindgen = anyAsAutoOrBool(options.skipBindgen);
    const redirectStderr = anyAsBool(options.redirectStderr);
    const useDebugBuild = anyAsBool(options.useDebugBuild);
    const skipBuild = anyAsAutoOrBool(options.skipBuild);
    anyAsBool(options.watchRawWasm);
    const useAwait = anyAsBool(options.useAwait);
    const rawModules = (_a = options.modules) !== null && _a !== void 0 ? _a : {};
    const modules = {};
    for (const [subId, module] of Object.entries(rawModules)) {
        if (typeof module === "object") {
            modules[subId] = {
                skipBindgen: anyAsAutoOrBool((_b = module.skipBindgen) !== null && _b !== void 0 ? _b : skipBindgen),
                skipBuild: anyAsAutoOrBool((_c = module.skipBuild) !== null && _c !== void 0 ? _c : skipBuild),
                manifestPath: anyAsOptStr(module.manifestPath),
                useDebugBuild: anyAsBool((_d = module.useDebugBuild) !== null && _d !== void 0 ? _d : useDebugBuild),
                rawWasmPath: anyAsOptStr(module.rawWasmPath),
                watchRawWasm: anyAsBool(module.watchRawWasm),
                useAwait: anyAsBool((_e = module.useAwait) !== null && _e !== void 0 ? _e : useAwait),
            };
        }
        else {
            modules[subId] = {
                skipBindgen, // use top-level value
                skipBuild, // use top-level value
                manifestPath: anyAsOptStr(module),
                useDebugBuild, // use top-level value
                rawWasmPath: null,
                watchRawWasm: false,
                useAwait: useAwait, // use top-level value
            };
        }
    }
    return {
        verbose,
        redirectStderr,
        modules,
    };
}

class WasmInfo {
    constructor(fileName, importModules, exportNames) {
        this.fileName = fileName;
        this.importModules = importModules;
        this.exportNames = exportNames;
    }
    static create(wasmPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileName = path.basename(wasmPath);
            const buffer = yield fs.readFile(wasmPath);
            const wasm = yield WebAssembly.compile(buffer);
            const importModules = Array.from(new Set(WebAssembly.Module.imports(wasm).map((desc) => desc.module)).keys());
            const exportNames = Array.from(new Set(WebAssembly.Module.exports(wasm).map((desc) => desc.name)).keys());
            return new WasmInfo(fileName, importModules, exportNames);
        });
    }
    getFileName() {
        return this.fileName;
    }
    getImportModules() {
        return this.importModules;
    }
    getExportNames() {
        return this.exportNames;
    }
}

class Executor {
    constructor(options, config) {
        this.absRoot = path__default.resolve(config.root);
        this.redirectStderr = options.redirectStderr;
        this.logger = createLogger(options.verbose ? "info" : "error", {
            prefix: "rs-wasm",
            allowClearScreen: config.clearScreen,
            customLogger: config.customLogger,
        });
    }
    build(subId, moduleOptions, manual) {
        return __awaiter(this, void 0, void 0, function* () {
            const outputPath = path__default.resolve(this.absRoot, subId);
            if (path__default.extname(outputPath)) {
                this.logWarn(`module key "${subId}" has extension`);
            }
            let rawWasmPath = moduleOptions.rawWasmPath;
            if (rawWasmPath) {
                rawWasmPath = path__default.resolve(this.absRoot, rawWasmPath);
            }
            const state = {
                debugBuild: false,
                rawWasmPath,
                outputDir: path__default.dirname(outputPath),
                outputName: path__default.basename(outputPath),
            };
            if (moduleOptions.skipBindgen &&
                !(moduleOptions.skipBindgen === "auto" && manual)) {
                this.logInfo(`skip build and bindgen "${subId}"`);
            }
            else {
                yield this.cargoBuild(subId, moduleOptions, manual, state);
                yield this.resolveRawWasmPath(subId, moduleOptions, state);
                yield this.wasmBindgen(subId, moduleOptions, manual, state);
            }
            return state;
        });
    }
    update(subId, moduleOptions, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const manual = false;
            if (moduleOptions.skipBindgen) ;
            else {
                yield this.wasmBindgen(subId, moduleOptions, manual, state);
            }
        });
    }
    cargoBuild(subId, options, manual, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const subError = new Error("cargo build failed");
            const operation = `building "${subId}" raw-wasm`;
            if (options.skipBuild && !(options.skipBuild === "auto" && manual)) {
                this.logInfo(`skip ${operation}`);
                return;
            }
            else if (options.manifestPath === null) {
                this.logError(`FAILED ${operation}: no manifest path`);
                throw subError;
            }
            const absManifestPath = path__default.resolve(this.absRoot, options.manifestPath);
            const command = "cargo";
            const commandArgs = [];
            commandArgs.push("build", "--lib");
            commandArgs.push("--manifest-path", absManifestPath);
            commandArgs.push("--target", "wasm32-unknown-unknown");
            if (!options.useDebugBuild) {
                commandArgs.push("--release");
            }
            try {
                this.logInfo(`${operation}: ${command} ${commandArgs.join(" ")}`);
                const result = yield promisify(execFile)(command, commandArgs);
                if (this.redirectStderr) {
                    this.printStderr(result);
                }
            }
            catch (error) {
                if (this.redirectStderr) {
                    this.printStderr(error);
                }
                this.logError(`FAILED ${operation}`);
                throw subError;
            }
            state.debugBuild = options.useDebugBuild;
        });
    }
    resolveRawWasmPath(subId, options, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const subError = new Error("cargo metadata failed");
            const operation = `resolving "${subId}" raw-wasm path`;
            if (state.rawWasmPath) {
                return;
            }
            else if (options.manifestPath === null) {
                this.logError(`FAILED ${operation}: no manifest path`);
                throw subError;
            }
            const absManifestPath = path__default.resolve(this.absRoot, options.manifestPath);
            const command = "cargo";
            const commandArgs = [];
            commandArgs.push("metadata");
            commandArgs.push("--no-deps");
            commandArgs.push("--manifest-path", absManifestPath);
            commandArgs.push("--format-version", "1");
            let output = "";
            try {
                this.logInfo(`${operation}: ${command} ${commandArgs.join(" ")}`);
                const result = yield promisify(execFile)(command, commandArgs);
                if (this.redirectStderr) {
                    this.printStderr(result);
                }
                output = result.stdout;
            }
            catch (error) {
                this.logError(`FAILED ${operation}`);
                if (this.redirectStderr) {
                    this.printStderr(error);
                }
                throw subError;
            }
            try {
                let metadata = JSON.parse(output);
                state.rawWasmPath = this.extractRawWasmPath(metadata, state.debugBuild);
                this.logInfo(`resolved => ${state.rawWasmPath}`);
            }
            catch (error) {
                if (typeof error === "string") {
                    this.logError(`FAILED ${operation}: ${error}`);
                }
                throw subError;
            }
        });
    }
    extractRawWasmPath(metadata, debugBuild) {
        const targetDir = metadata["target_directory"];
        const packages = metadata["packages"];
        if (packages.length > 1) {
            throw "multiple packages";
        }
        const targets = packages[0].targets;
        let libName = null;
        for (const target of targets) {
            const kind = target.kind;
            if (kind.includes("cdylib")) {
                libName = target.name;
                break;
            }
        }
        if (libName === null) {
            throw "no cdylib target";
        }
        const wasmName = libName.replace(/-/g, "_") + ".wasm";
        const profileDir = debugBuild ? "debug" : "release";
        return path__default.join(targetDir, "wasm32-unknown-unknown", profileDir, wasmName);
    }
    wasmBindgen(subId, options, manual, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const subError = new Error("wasm-bindgen failed");
            const operation = `generating "${subId}" module`;
            if (options.skipBindgen && !(options.skipBindgen === "auto" && manual)) {
                this.logInfo(`skip ${operation}`);
                return;
            }
            else if (state.rawWasmPath === null) {
                this.logError(`FAILED ${operation}: no raw wasm path`);
                throw subError;
            }
            const command = "wasm-bindgen";
            const commandArgs = [];
            commandArgs.push("--out-dir", state.outputDir);
            commandArgs.push("--out-name", state.outputName);
            commandArgs.push("--target", "bundler");
            commandArgs.push(state.rawWasmPath);
            try {
                this.logInfo(`${operation}: ${command} ${commandArgs.join(" ")}`);
                const result = yield promisify(execFile)(command, commandArgs);
                if (this.redirectStderr) {
                    this.printStderr(result);
                }
            }
            catch (error) {
                this.logError(`FAILED ${operation}`);
                if (this.redirectStderr) {
                    this.printStderr(error);
                }
                throw subError;
            }
        });
    }
    printStderr(obj) {
        if (obj &&
            typeof obj === "object" &&
            "stderr" in obj &&
            (typeof obj.stderr === "string" || obj.stderr instanceof Uint8Array)) {
            process.stderr.write(obj.stderr);
        }
    }
    logInfo(msg) {
        this.logger.info(msg, { timestamp: true });
    }
    logWarn(msg) {
        this.logger.warn(msg, { timestamp: true });
    }
    logError(msg) {
        this.logger.error(msg, { timestamp: true });
    }
}

const INIT_HELPER_PREFIX = "\0virtual:rs-wasm-bindgen?init";
const FN_MANUAL_START = "__wbindgen_start";
class CodeGen {
    constructor() { }
    makeInitHelperId(key) {
        return INIT_HELPER_PREFIX + '&' + key;
    }
    matchInitHelperId(id) {
        return id.startsWith(INIT_HELPER_PREFIX);
    }
    genInitHelperCode() {
        return `
    let initPromise = null;
    let initSub = null;
  
    export function hookInit(fn) {
      initSub = fn;
    }
  
    export function init() {
      if (!initPromise && initSub) {
        initPromise = initSub();
        initSub = null;
      }
        return initPromise;
    }
    `;
    }
    genWasmProxyCode(key, wasm) {
        const wasmUrlUrl = JSON.stringify("./" + wasm.getFileName() + "?url");
        const initHelperModule = JSON.stringify(this.makeInitHelperId(key));
        // import statements
        const importStmtLines = [];
        const importObjectItemLines = [];
        wasm.getImportModules().forEach((importModule, index) => {
            const importModuleLit = JSON.stringify(importModule);
            importStmtLines.push(`import * as m${index} from ${importModuleLit};`);
            importObjectItemLines.push(`[${importModuleLit}]: m${index},`);
        });
        const importStmts = importStmtLines.join("\n");
        const importObjectItems = importObjectItemLines.join("\n");
        // export statements
        const exportStmtLines = [];
        const exportAssignLines = [];
        let hasManualStart = false;
        wasm.getExportNames().forEach((exportName, index) => {
            if (exportName === FN_MANUAL_START) {
                hasManualStart = true;
            }
            else {
                const nameLit = JSON.stringify(exportName);
                exportStmtLines.push(`let x${index} = undefined;`, `export {x${index} as ${nameLit}};`);
                exportAssignLines.push(`x${index} = exports[${nameLit}];`);
            }
        });
        if (hasManualStart) {
            // add dummy (nop) manual start function
            exportStmtLines.push(`export function ${FN_MANUAL_START}() {}`);
        }
        const exportStmts = exportStmtLines.join("\n");
        const exportAssigns = exportAssignLines.join("\n");
        let callManualStart = "";
        if (hasManualStart) {
            callManualStart = `exports['${FN_MANUAL_START}']();`;
        }
        // init function
        const hookInit = `
    hookInit(() => {
      const imports = {
        ${importObjectItems}
      };
      const source = fetch(wasmUrl);
      return WebAssembly.instantiateStreaming(source, imports)
        .then((result) => {
          const { instance } = result;
  
          const exports = instance.exports;
          ${exportAssigns}
          ${callManualStart}

          return instance;
        });  
    });
    `;
        // generate proxy code
        return `
    import wasmUrl from ${wasmUrlUrl};
    import { hookInit } from ${initHelperModule};
  
    ${importStmts}
  
    ${exportStmts}
  
    ${hookInit}
    `;
    }
    genJsInitCode(key) {
        const initHelperModule = JSON.stringify(this.makeInitHelperId(key));
        return `
    import { init } from ${initHelperModule};
    export default init;
    `;
    }
    transformJsCodeUseAwait(code, key) {
        const initHelperModule = JSON.stringify(this.makeInitHelperId(key));
        let extLines = `
    import { init } from ${initHelperModule};
    await init();
    `;
        return code + extLines;
    }
}

class WasmManager {
    constructor(options) {
        // tools
        this.executor = null;
        this.codeGen = null;
        this.options = normalizeOptions(options);
        this.rawWasmIds = new Map();
        this.moduleBgWasmIds = new Map();
        this.moduleJsIds = new Map();
        this.moduleJsInitIds = new Map();
    }
    applyConfig(config) {
        // tools
        this.executor = new Executor(this.options, config);
        this.codeGen = new CodeGen();
    }
    buildModules(manual) {
        return __awaiter(this, void 0, void 0, function* () {
            this.rawWasmIds.clear();
            this.moduleBgWasmIds.clear();
            this.moduleJsIds.clear();
            this.moduleJsInitIds.clear();
            for (const [subId, moduleOptions] of Object.entries(this.options.modules)) {
                const state = yield this.executor.build(subId, moduleOptions, manual);
                const info = {
                    subId,
                    options: moduleOptions,
                    state,
                };
                const rawWasmPath = info.state.rawWasmPath;
                const outputDir = info.state.outputDir;
                const outputName = info.state.outputName;
                if (rawWasmPath) {
                    const rawWasmId = normalizePath(rawWasmPath);
                    this.rawWasmIds.set(rawWasmId, info);
                }
                const bgWasmId = normalizePath(path__default.join(outputDir, outputName + "_bg.wasm"));
                this.moduleBgWasmIds.set(bgWasmId, info);
                const jsId = normalizePath(path__default.join(outputDir, outputName + ".js"));
                this.moduleJsIds.set(jsId, info);
                if (!info.options.useAwait) {
                    const jsInitId = jsId + "?init";
                    this.moduleJsInitIds.set(jsInitId, info);
                }
            }
        });
    }
    listWatchWasmDir() {
        const list = [];
        for (const [rawWasmId, info] of this.rawWasmIds.entries()) {
            if (info.options.watchRawWasm) {
                list.push(path__default.dirname(rawWasmId));
            }
        }
        return list;
    }
    handleRawWasmChange(rawWasmId) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = this.rawWasmIds.get(rawWasmId);
            if (info && info.options.watchRawWasm) {
                this.executor.update(info.subId, info.options, info.state);
            }
        });
    }
    isInitHelperId(id) {
        return this.codeGen.matchInitHelperId(id);
    }
    isRawWasmId(id) {
        return this.rawWasmIds.has(id);
    }
    isModuleBgWasmId(id) {
        return this.moduleBgWasmIds.has(id);
    }
    isModuleJsId(id) {
        return this.moduleJsIds.has(id);
    }
    isModuleJsInitId(id) {
        return this.moduleJsInitIds.has(id);
    }
    loadInitHelper() {
        return this.codeGen.genInitHelperCode();
    }
    loadModuleBgWasm(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = this.moduleBgWasmIds.get(id);
            if (!info) {
                return null;
            }
            const subId = info.subId;
            const wasm = yield WasmInfo.create(id);
            return this.codeGen.genWasmProxyCode(subId, wasm);
        });
    }
    loadModuleJsInit(id) {
        const info = this.moduleJsInitIds.get(id);
        if (!info) {
            return null;
        }
        const subId = info.subId;
        return this.codeGen.genJsInitCode(subId);
    }
    transformModuleJs(code, id) {
        const info = this.moduleJsIds.get(id);
        if (!info || !info.options.useAwait) {
            return null;
        }
        const subId = info.subId;
        return this.codeGen.transformJsCodeUseAwait(code, subId);
    }
}

const PLUGIN_NAME = "rs-wasm-bindgen";
function rsWasmBindgen(options) {
    const manager = new WasmManager(options !== null && options !== void 0 ? options : {});
    return {
        name: PLUGIN_NAME,
        api: manager,
        configResolved(config) {
            manager.applyConfig(config);
        },
        buildStart(_inputOptions) {
            return __awaiter(this, void 0, void 0, function* () {
                yield manager.buildModules(false);
                for (const watchWasmDir of manager.listWatchWasmDir()) {
                    this.addWatchFile(watchWasmDir);
                }
            });
        },
        resolveId(source, _importer, _options) {
            if (manager.isInitHelperId(source)) {
                return source;
            }
            else {
                return null;
            }
        },
        load(id) {
            return __awaiter(this, void 0, void 0, function* () {
                if (manager.isInitHelperId(id)) {
                    return manager.loadInitHelper();
                }
                else if (manager.isModuleBgWasmId(id)) {
                    this.addWatchFile(id);
                    return manager.loadModuleBgWasm(id);
                }
                else if (manager.isModuleJsInitId(id)) {
                    return manager.loadModuleJsInit(id);
                }
                else {
                    return null;
                }
            });
        },
        transform(code, id) {
            if (manager.isModuleJsId(id)) {
                return manager.transformModuleJs(code, id);
            }
            else {
                return null;
            }
        },
        watchChange(id, change) {
            return __awaiter(this, void 0, void 0, function* () {
                if (manager.isRawWasmId(id) && change.event !== "delete") {
                    yield manager.handleRawWasmChange(id);
                }
            });
        },
    };
}

export { rsWasmBindgen as default };
