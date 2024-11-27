'use strict';

var path = require('node:path');
var fs = require('node:fs/promises');
var node_util = require('node:util');
var node_child_process = require('node:child_process');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var path__namespace = /*#__PURE__*/_interopNamespaceDefault(path);
var fs__namespace = /*#__PURE__*/_interopNamespaceDefault(fs);

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

class WasmInfo {
    constructor(fileName, importModules, exportNames) {
        this.fileName = fileName;
        this.importModules = importModules;
        this.exportNames = exportNames;
    }
    static create(wasmPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileName = path__namespace.basename(wasmPath);
            const buffer = yield fs__namespace.readFile(wasmPath);
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

function execCargoBuildWasm(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = args.key;
        const skipBuild = args.skipBuild;
        const manifestPath = args.manifestPath;
        const profile = args.profile;
        const ignoreError = args.ignoreError;
        const logger = args.logger;
        const verbose = args.verbose;
        const suppressError = args.suppressError;
        let skipReason = null;
        if (skipBuild) {
            skipReason = "skipBuild";
        }
        else if (manifestPath === null) {
            skipReason = "no manifestPath";
        }
        if (skipReason !== null) {
            if (verbose) {
                logger.info(`skip building source wasm of ${key} (${skipReason})`);
            }
            return true;
        }
        const command = "cargo";
        const commandArgs = [];
        commandArgs.push("build", "--lib");
        commandArgs.push("--manifest-path", manifestPath);
        commandArgs.push("--target", "wasm32-unknown-unknown");
        if (profile == "release") {
            commandArgs.push("--release");
        }
        else if (profile != "dev") {
            commandArgs.push("--profile");
            commandArgs.push(profile);
        }
        try {
            if (verbose) {
                const joinedArgs = commandArgs.join(" ");
                logger.info(`building source wasm of ${key}: ${command} ${joinedArgs}`);
            }
            yield node_util.promisify(node_child_process.execFile)(command, commandArgs);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (error) {
            const ignored = ignoreError ? " (ignored)" : "";
            logger.error(`building source wasm of ${key} failed${ignored}`);
            if (!suppressError) {
                process.stderr.write(error.stderr);
            }
            return ignoreError;
        }
        return true;
    });
}
function execCargoMetadata(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = args.key;
        const skipBindgen = args.skipBindgen;
        const manifestPath = args.manifestPath;
        const givenCrateName = args.crateName;
        const profile = args.profile;
        const logger = args.logger;
        const verbose = args.verbose;
        let skipReason = null;
        if (skipBindgen) {
            skipReason = "skipBindgen";
        }
        else if (manifestPath === null) {
            skipReason = "no manifestPath";
        }
        if (skipReason !== null) {
            if (verbose) {
                console.info(`skip locating source wasm of ${key} (${skipReason})`);
            }
            return null;
        }
        const command = "cargo";
        const commandArgs = [];
        commandArgs.push("metadata", "--no-deps");
        commandArgs.push("--manifest-path", manifestPath);
        commandArgs.push("--format-version", "1");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let metadata = null;
        try {
            if (verbose) {
                console.info(`resloving input wasm of ${key}`);
            }
            const { stdout } = yield node_util.promisify(node_child_process.execFile)(command, commandArgs);
            metadata = JSON.parse(stdout);
        }
        catch (error) {
            logger.error(`reading cargo metadata of ${key} failed`);
            return null;
        }
        const targetDirectory = metadata["target_directory"];
        const packages = metadata["packages"];
        let mainCrateName = null;
        for (const package_ of packages) {
            if (package_["manifest_path"] === manifestPath) {
                mainCrateName = package_["name"];
            }
        }
        const crateName = givenCrateName !== null && givenCrateName !== void 0 ? givenCrateName : mainCrateName;
        if (targetDirectory === null) {
            logger.error(`target directory of ${key} is missing`);
            return null;
        }
        else if (crateName === null) {
            logger.error(`failed in resolving package name of ${key} (explicit crateName is required)`);
            return null;
        }
        let profileDirectory;
        if (profile == "dev" || profile == "test") {
            profileDirectory = "debug";
        }
        else if (profile == "bench") {
            profileDirectory = "release";
        }
        else {
            // as-is (including release)
            profileDirectory = profile;
        }
        const inputWasmPath = path.join(targetDirectory, "wasm32-unknown-unknown", profileDirectory, crateName.replace(/-/g, "_") + ".wasm");
        if (verbose) {
            logger.info(` => ${inputWasmPath}`);
        }
        return inputWasmPath;
    });
}
function execWasmBindgen(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = args.key;
        const skipBindgen = args.skipBindgen;
        const inputWasmPath = args.inputWasmPath;
        const outputDir = args.outputDir;
        const outputName = args.outputName;
        const logger = args.logger;
        const verbose = args.verbose;
        let skipReason = null;
        if (skipBindgen) {
            skipReason = "skipBindgen";
        }
        if (skipReason !== null) {
            if (verbose) {
                logger.info(`skip wasm-bindgen of ${key} (${skipReason})`);
            }
            return true;
        }
        const command = "wasm-bindgen";
        const commandArgs = [];
        commandArgs.push("--out-dir", outputDir);
        commandArgs.push("--out-name", outputName);
        commandArgs.push("--target", "bundler");
        commandArgs.push(inputWasmPath);
        try {
            if (verbose) {
                const joinedArgs = commandArgs.join(" ");
                logger.info(`bindgen ${key}: ${command} ${joinedArgs}`);
            }
            yield node_util.promisify(node_child_process.execFile)(command, commandArgs);
        }
        catch (error) {
            logger.error(`bindgen ${key} failed`);
            return false;
        }
        return true;
    });
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
        var _a, _b, _c;
        // config
        this.logger = null;
        this.absRoot = null;
        this.isProduction = false;
        this.verbose = (_a = options.verbose) !== null && _a !== void 0 ? _a : false;
        this.suppressError = (_b = options.suppressError) !== null && _b !== void 0 ? _b : false;
        // targets
        this.targets = Object.entries((_c = options.targets) !== null && _c !== void 0 ? _c : {})
            .map(([key, targetOptions]) => new WasmTarget(key, targetOptions));
        this.targetWasmBgIds = new Map();
        this.targetJsIds = new Map();
        // tools
        this.codeGen = new CodeGen();
    }
    applyConfig(config) {
        var _a;
        this.logger = (_a = config.customLogger) !== null && _a !== void 0 ? _a : config.logger;
        this.absRoot = path.resolve(config.root);
        this.isProduction = config.isProduction;
    }
    makeBuildArgs() {
        return {
            verbose: this.verbose,
            isProduction: this.isProduction,
            logger: this.logger,
            absRoot: this.absRoot,
            suppressError: this.suppressError,
        };
    }
    buildAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const args = this.makeBuildArgs();
            for (const target of this.targets) {
                yield target.build(args);
            }
            this.updateTargetIds();
        });
    }
    updateTargetIds() {
        this.targetJsIds.clear();
        this.targetWasmBgIds.clear();
        this.targets.forEach((target) => {
            // init id
            const JsInitId = target.getOutputJsInitId();
            if (JsInitId) {
                this.targetJsIds.set(JsInitId, [target, false]);
            }
            const JsSyncId = target.getOutputJsSyncId();
            if (JsSyncId) {
                this.targetJsIds.set(JsSyncId, [target, true]);
            }
            const bgWasmId = target.getOutputBgWasmId();
            if (bgWasmId) {
                this.targetWasmBgIds.set(bgWasmId, target);
            }
        });
    }
    listWatchWasmDir() {
        const list = [];
        for (const target of this.targets) {
            const watchWasmPath = target.getWatchWasmPath();
            if (watchWasmPath != null) {
                list.push(path.dirname(watchWasmPath));
            }
        }
        return list;
    }
    handleWasmChange(watchWasmPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const targets = this.targets.filter((target) => target.getWatchWasmPath() == watchWasmPath);
            if (targets.length == 0) {
                return;
            }
            const args = this.makeBuildArgs();
            for (const target of targets) {
                yield target.bindgen(args);
            }
            this.updateTargetIds();
        });
    }
    isInitHelperId(id) {
        return this.codeGen.matchInitHelperId(id);
    }
    isTargetBgWasmId(id) {
        return this.targetWasmBgIds.has(id);
    }
    isTargetJsId(id) {
        return this.targetJsIds.has(id);
    }
    loadInitHelper() {
        return this.codeGen.genInitHelperCode();
    }
    loadTargetBgWasm(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const target = this.targetWasmBgIds.get(id);
            if (!target) {
                return null;
            }
            const key = target.getKey();
            const wasm = yield WasmInfo.create(id);
            return this.codeGen.genWasmProxyCode(key, wasm);
        });
    }
    transformTargetJs(code, id) {
        const entry = this.targetJsIds.get(id);
        if (!entry) {
            return null;
        }
        const [target, useAwait] = entry;
        const key = target.getKey();
        return this.codeGen.transformJsCode(code, key, useAwait);
    }
}
class WasmTarget {
    constructor(key, options) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (typeof options === "string") {
            options = { manifestPath: options };
        }
        this.key = key;
        this.manifestPath = (_a = options.manifestPath) !== null && _a !== void 0 ? _a : null;
        this.skipBuild = (_b = options.skipBuild) !== null && _b !== void 0 ? _b : false;
        this.buildProfile = (_c = options.buildProfile) !== null && _c !== void 0 ? _c : null;
        this.ignoreBuildError = (_d = options.ignoreBuildError) !== null && _d !== void 0 ? _d : false;
        this.crateName = (_e = options.crateName) !== null && _e !== void 0 ? _e : null;
        this.skipBindgen = (_f = options.skipBindgen) !== null && _f !== void 0 ? _f : false;
        this.watchInputWasm = (_g = options.watchInputWasm) !== null && _g !== void 0 ? _g : false;
        this.inputWasmPath = (_h = options.inputWasmPath) !== null && _h !== void 0 ? _h : null;
        this.watchWasmPath = null;
        this.outputDir = null;
        this.outputJs = null;
        this.outputBgWasm = null;
        if (this.manifestPath !== null) {
            this.manifestPath = path.resolve(this.manifestPath);
        }
        if (this.inputWasmPath !== null) {
            this.inputWasmPath = path.resolve(this.inputWasmPath);
        }
        this.syncWatchWasmPath();
    }
    build(args) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.buildInputWasm(args))) {
                return;
            }
            if (!(yield this.locateInputWasm(args))) {
                return;
            }
            if (!(yield this.bindgen(args))) {
                return;
            }
        });
    }
    buildInputWasm(args) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const profile = (_a = this.buildProfile) !== null && _a !== void 0 ? _a : (args.isProduction ? "release" : "dev");
            return yield execCargoBuildWasm({
                key: this.key,
                skipBuild: this.skipBuild,
                manifestPath: this.manifestPath,
                profile,
                ignoreError: this.ignoreBuildError,
                logger: args.logger,
                verbose: args.verbose,
                suppressError: args.suppressError,
            });
        });
    }
    locateInputWasm(args) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.inputWasmPath !== null) {
                return true;
            }
            const profile = (_a = this.buildProfile) !== null && _a !== void 0 ? _a : (args.isProduction ? "release" : "dev");
            this.inputWasmPath = yield execCargoMetadata({
                key: this.key,
                skipBindgen: this.skipBindgen,
                manifestPath: this.manifestPath,
                crateName: this.crateName,
                profile,
                logger: args.logger,
                verbose: args.verbose,
            });
            if (this.inputWasmPath !== null) {
                this.inputWasmPath = path.resolve(this.inputWasmPath);
            }
            this.syncWatchWasmPath();
            return this.inputWasmPath !== null;
        });
    }
    bindgen(args) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.inputWasmPath === null) {
                return false;
            }
            const outputPrefix = path.join(args.absRoot, this.key);
            const outputDir = path.dirname(outputPrefix);
            const outputName = path.basename(outputPrefix);
            const ok = yield execWasmBindgen({
                key: this.key,
                skipBindgen: this.skipBindgen,
                inputWasmPath: this.inputWasmPath,
                outputDir,
                outputName,
                logger: args.logger,
                verbose: args.verbose,
            });
            if (ok) {
                this.outputDir = outputDir;
                this.outputJs = outputName + '.js';
                this.outputBgWasm = outputName + '_bg.wasm';
                return true;
            }
            else {
                return false;
            }
        });
    }
    syncWatchWasmPath() {
        if (this.inputWasmPath == null || !this.watchInputWasm) {
            this.watchWasmPath = null;
        }
        else {
            this.watchWasmPath = normalizePath(path.normalize(this.inputWasmPath));
        }
    }
    getKey() {
        return this.key;
    }
    getWatchWasmPath() {
        return this.watchWasmPath;
    }
    getOutputJsInitId() {
        if (this.outputDir !== null && this.outputJs) {
            return normalizePath(path.join(this.outputDir, this.outputJs)) + '?init';
        }
        else {
            return null;
        }
    }
    getOutputJsSyncId() {
        if (this.outputDir !== null && this.outputJs) {
            return normalizePath(path.join(this.outputDir, this.outputJs)) + '?sync';
        }
        else {
            return null;
        }
    }
    getOutputBgWasmId() {
        if (this.outputDir !== null && this.outputBgWasm) {
            return normalizePath(path.join(this.outputDir, this.outputBgWasm));
        }
        else {
            return null;
        }
    }
}
function normalizePath(fileName) {
    return fileName.replace(/\\/g, "/");
}

const PLUGIN_NAME = "rs-wasm-bindgen";
function rsWasmBindgen(options) {
    const wasmManager = new WasmManager(options !== null && options !== void 0 ? options : {});
    return {
        name: PLUGIN_NAME,
        configResolved(config) {
            wasmManager.applyConfig(config);
        },
        buildStart(_inputOptions) {
            return __awaiter(this, void 0, void 0, function* () {
                yield wasmManager.buildAll();
                for (const watchWasmDir of wasmManager.listWatchWasmDir()) {
                    this.addWatchFile(watchWasmDir);
                }
            });
        },
        resolveId(source, _importer, _options) {
            if (wasmManager.isInitHelperId(source)) {
                return source;
            }
            else {
                return null;
            }
        },
        load(id) {
            return __awaiter(this, void 0, void 0, function* () {
                if (wasmManager.isInitHelperId(id)) {
                    return wasmManager.loadInitHelper();
                }
                else if (wasmManager.isTargetBgWasmId(id)) {
                    this.addWatchFile(id);
                    return wasmManager.loadTargetBgWasm(id);
                }
                else {
                    return null;
                }
            });
        },
        transform(code, id) {
            if (wasmManager.isTargetJsId(id)) {
                return wasmManager.transformTargetJs(code, id);
            }
            else {
                return null;
            }
        },
        watchChange(id, change) {
            return __awaiter(this, void 0, void 0, function* () {
                if (/\.wasm$/i.test(id) && change.event != "delete") {
                    yield wasmManager.handleWasmChange(id);
                }
            });
        },
    };
}

module.exports = rsWasmBindgen;
