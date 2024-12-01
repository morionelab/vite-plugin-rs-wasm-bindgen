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
    var _a, _b, _c;
    const anyAsBool = (value) => !!value;
    const anyAsOptStr = (value) => (typeof value === "string" ? value : null);
    const anyAsAutoOrBool = (value) => value === "auto" ? "auto" : anyAsBool(value);
    const verbose = anyAsBool(options.verbose);
    const skipBindgen = anyAsAutoOrBool(options.skipBindgen);
    const redirectStderr = anyAsBool(options.redirectStderr);
    const useDebugBuild = anyAsBool(options.useDebugBuild);
    const rawTargets = (_a = options.targets) !== null && _a !== void 0 ? _a : {};
    const targets = {};
    for (const [subId, target] of Object.entries(rawTargets)) {
        if (typeof target === "object") {
            targets[subId] = {
                skipBindgen: anyAsAutoOrBool((_b = target.skipBindgen) !== null && _b !== void 0 ? _b : skipBindgen),
                skipBuild: anyAsBool(target.skipBuild),
                manifestPath: anyAsOptStr(target.manifestPath),
                useDebugBuild: anyAsBool((_c = target.useDebugBuild) !== null && _c !== void 0 ? _c : useDebugBuild),
                rawWasmPath: anyAsOptStr(target.rawWasmPath),
                noWatchRawWasm: anyAsBool(target.noWatchRawWasm),
            };
        }
        else {
            targets[subId] = {
                skipBindgen, // use top-level value
                skipBuild: false,
                manifestPath: anyAsOptStr(target),
                useDebugBuild, // use top-level value
                rawWasmPath: null,
                noWatchRawWasm: false,
            };
        }
    }
    return {
        verbose,
        redirectStderr,
        targets,
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
        this.logger = createLogger(options.verbose ? "info" : "warn", {
            prefix: "rs-wasm",
            allowClearScreen: config.clearScreen,
            customLogger: config.customLogger,
        });
    }
    build(subId, targetOptions, manual) {
        return __awaiter(this, void 0, void 0, function* () {
            const outputPath = path__default.resolve(this.absRoot, subId);
            if (path__default.extname(outputPath)) {
                this.logWarn(`target key "${subId}" has extension`);
            }
            let rawWasmPath = targetOptions.rawWasmPath;
            if (rawWasmPath) {
                rawWasmPath = path__default.resolve(this.absRoot, rawWasmPath);
            }
            const state = {
                debugBuild: false,
                rawWasmPath,
                outputDir: path__default.dirname(outputPath),
                outputName: path__default.basename(outputPath),
            };
            if ((targetOptions.skipBindgen === "auto" && !manual) ||
                targetOptions.skipBindgen // true
            ) {
                this.logInfo(`skip build and bindgen "${subId}"`);
            }
            else {
                yield this.cargoBuild(subId, targetOptions, state);
                yield this.resolveRawWasmPath(subId, targetOptions, state);
                yield this.wasmBindgen(subId, targetOptions, state);
            }
            return state;
        });
    }
    update(subId, targetOptions, state) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.wasmBindgen(subId, targetOptions, state);
        });
    }
    cargoBuild(subId, options, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const subError = new Error("cargo build failed");
            const operation = `building "${subId}" raw-wasm`;
            if (options.skipBuild) {
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
    wasmBindgen(subId, _options, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const subError = new Error("wasm-bindgen failed");
            const operation = `generating "${subId}" module`;
            if (state.rawWasmPath === null) {
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
  
          return {
            instance,
            memory: exports["memory"],
          };
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
    transformJsCode(code, key, useAwait) {
        const initHelperModule = JSON.stringify(this.makeInitHelperId(key));
        let extLines = `
    import { init } from ${initHelperModule};
    `;
        if (useAwait) {
            extLines += `const initValues = await init();
      export default initValues;
      `;
        }
        else {
            extLines += `export default init;`;
        }
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
        this.targetBgWasmIds = new Map();
        this.targetJsIds = new Map();
    }
    applyConfig(config) {
        // tools
        this.executor = new Executor(this.options, config);
        this.codeGen = new CodeGen();
    }
    buildTargets(manual) {
        return __awaiter(this, void 0, void 0, function* () {
            this.rawWasmIds.clear();
            this.targetBgWasmIds.clear();
            this.targetJsIds.clear();
            for (const [subId, targetOptions] of Object.entries(this.options.targets)) {
                const state = yield this.executor.build(subId, targetOptions, manual);
                const info = {
                    subId,
                    options: targetOptions,
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
                this.targetBgWasmIds.set(bgWasmId, info);
                const jsId = normalizePath(path__default.join(outputDir, outputName + ".js"));
                this.targetJsIds.set(jsId + "?init", [info, false]);
                this.targetJsIds.set(jsId + "?sync", [info, true]);
            }
        });
    }
    listWatchWasmDir() {
        const list = [];
        for (const [rawWasmId, info] of this.rawWasmIds.entries()) {
            if (!info.options.noWatchRawWasm) {
                list.push(path__default.dirname(rawWasmId));
            }
        }
        return list;
    }
    handleRawWasmChange(rawWasmId) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = this.rawWasmIds.get(rawWasmId);
            if (info && !info.options.noWatchRawWasm) {
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
    isTargetBgWasmId(id) {
        return this.targetBgWasmIds.has(id);
    }
    isTargetJsId(id) {
        return this.targetJsIds.has(id);
    }
    loadInitHelper() {
        return this.codeGen.genInitHelperCode();
    }
    loadTargetBgWasm(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = this.targetBgWasmIds.get(id);
            if (!info) {
                return null;
            }
            const subId = info === null || info === void 0 ? void 0 : info.subId;
            const wasm = yield WasmInfo.create(id);
            return this.codeGen.genWasmProxyCode(subId, wasm);
        });
    }
    transformTargetJs(code, id) {
        const entry = this.targetJsIds.get(id);
        if (!entry) {
            return null;
        }
        const [info, useAwait] = entry;
        const subId = info.subId;
        return this.codeGen.transformJsCode(code, subId, useAwait);
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
                yield manager.buildTargets(false);
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
                else if (manager.isTargetBgWasmId(id)) {
                    this.addWatchFile(id);
                    return manager.loadTargetBgWasm(id);
                }
                else {
                    return null;
                }
            });
        },
        transform(code, id) {
            if (manager.isTargetJsId(id)) {
                return manager.transformTargetJs(code, id);
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
