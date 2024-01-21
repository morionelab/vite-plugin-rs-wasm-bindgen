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
/* global Reflect, Promise, SuppressedError, Symbol */


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

const MANUAL_START_FUNC = "__wbindgen_start";
class WasmData {
    constructor(fileName, importModules, exportNames, manualStart) {
        this.fileName = fileName;
        this.importModules = importModules;
        this.exportNames = exportNames;
        this.manualStart = manualStart;
    }
    static create(wasmPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileName = path__namespace.basename(wasmPath);
            const buffer = yield fs__namespace.readFile(wasmPath);
            const wasm = yield WebAssembly.compile(buffer);
            const importModules = Array.from(new Set(WebAssembly.Module.imports(wasm).map((desc) => desc.module)).keys());
            const exportNames = Array.from(new Set(WebAssembly.Module.exports(wasm).map((desc) => desc.name)).keys());
            // remove '__wbindgen_start' from the export names if exists
            const manualStartIndex = exportNames.findIndex((value) => value == MANUAL_START_FUNC);
            const manualStart = manualStartIndex != -1;
            if (manualStart) {
                exportNames.splice(manualStartIndex, 1);
            }
            return new WasmData(fileName, importModules, exportNames, manualStart);
        });
    }
    generateProxyCode(syncImport) {
        const wasmUrlUrl = JSON.stringify("./" + this.fileName + "?url");
        // import statements
        const importStmtLines = [];
        const importObjectItemLines = [];
        this.importModules.forEach((importModule, index) => {
            const importModuleLit = JSON.stringify(importModule);
            importStmtLines.push(`import * as m${index} from ${importModuleLit};`);
            importObjectItemLines.push(`[${importModuleLit}]: m${index},`);
        });
        const importStmts = importStmtLines.join("\n");
        const importObjectItems = importObjectItemLines.join("\n");
        // export statements
        const exportStmtLines = [];
        const exportAssignLines = [];
        this.exportNames.forEach((exportName, index) => {
            const nameLit = JSON.stringify(exportName);
            exportStmtLines.push(`let x${index} = undefined;`, `export {x${index} as ${nameLit}};`);
            exportAssignLines.push(`x${index} = exports[${nameLit}];`);
        });
        if (this.manualStart) {
            // add dummy (nop) manual start function
            exportStmtLines.push(`export function ${MANUAL_START_FUNC}() {}`);
        }
        const exportStmts = exportStmtLines.join("\n");
        const exportAssigns = exportAssignLines.join("\n");
        let callManualStart = "";
        if (this.manualStart) {
            callManualStart = `instance.exports['${MANUAL_START_FUNC}']();`;
        }
        // init function
        const initProxyFuncDef = `
    async function initProxy() {
      const source = fetch(wasmUrl);

      const imports = {
        ${importObjectItems}
      };

      const { instance } = await WebAssembly.instantiateStreaming(source, imports);

      const exports = instance.exports;

      ${exportAssigns}

      ${callManualStart}
    }
    `;
        const initProxyCallOrExport = syncImport
            ? `await initProxy();`
            : `export default initProxy`;
        // generate proxy code
        return `
    import wasmUrl from ${wasmUrlUrl};

    ${importStmts}

    ${exportStmts}

    ${initProxyFuncDef}

    ${initProxyCallOrExport}
    `;
    }
}

function execCargoBuildWasm(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const logger = args.logger;
        const verbose = args.verbose;
        const suppressError = args.suppressError;
        const profile = args.profile;
        const targetId = args.targetId;
        const manifestPath = args.manifestPath;
        const skipBuild = args.skipBuild;
        const ignoreError = args.ignoreError;
        let skipReason = null;
        if (skipBuild) {
            skipReason = "skipBuild";
        }
        else if (manifestPath === null) {
            skipReason = "no manifestPath";
        }
        if (skipReason !== null) {
            if (verbose) {
                logger.info(`skip building source wasm of ${targetId} (${skipReason})`);
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
                logger.info(`building source wasm of ${targetId}: ${command} ${joinedArgs}`);
            }
            yield node_util.promisify(node_child_process.execFile)(command, commandArgs);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (error) {
            const ignored = ignoreError ? " (ignored)" : "";
            logger.error(`building source wasm of ${targetId} failed${ignored}`);
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
        const targetId = args.targetId;
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
                console.info(`skip locating source wasm of ${targetId} (${skipReason})`);
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
                console.info(`resloving input wasm of ${targetId}`);
            }
            const { stdout } = yield node_util.promisify(node_child_process.execFile)(command, commandArgs);
            metadata = JSON.parse(stdout);
        }
        catch (error) {
            logger.error(`reading cargo metadata of ${targetId} failed`);
            return null;
        }
        const targetDirectory = metadata["target_directory"];
        const packages = metadata["packages"];
        let crateName = null;
        if (givenCrateName !== null) {
            crateName = givenCrateName;
        }
        else if (packages && packages.length == 1) {
            const package_ = packages[0];
            crateName = package_.name;
        }
        else {
            logger.error(`packages in cargo metadata of ${targetId} is not unique (explicit crateName is required)`);
            return null;
        }
        if (targetDirectory === null || crateName === null) {
            logger.error(`target directory or crate name of ${targetId} is missing`);
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
        const inputWasmPath = path__namespace.join(targetDirectory, "wasm32-unknown-unknown", profileDirectory, crateName.replace(/-/g, "_") + ".wasm");
        if (verbose) {
            logger.info(` => ${inputWasmPath}`);
        }
        return inputWasmPath;
    });
}
function execWasmBindgen(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const targetId = args.targetId;
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
                logger.info(`skip wasm-bindgen of ${targetId} (${skipReason})`);
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
                logger.info(`bindgen ${targetId}: ${command} ${joinedArgs}`);
            }
            yield node_util.promisify(node_child_process.execFile)(command, commandArgs);
        }
        catch (error) {
            logger.error(`bindgen ${targetId} failed`);
            return false;
        }
        return true;
    });
}

class WasmManager {
    constructor(options) {
        var _a, _b, _c, _d;
        this.suppressError = false;
        // config
        this.logger = null;
        this.root = null;
        this.isProduction = false;
        this.verbose = (_a = options.verbose) !== null && _a !== void 0 ? _a : false;
        this.suppressError = (_b = options.suppressError) !== null && _b !== void 0 ? _b : false;
        this.syncImport = (_c = options.syncImport) !== null && _c !== void 0 ? _c : false;
        // targets
        const targetOptions = (_d = options.targets) !== null && _d !== void 0 ? _d : {};
        this.targets = [];
        for (const targetId in targetOptions) {
            const target = new WasmTarget(targetId, targetOptions[targetId]);
            this.targets.push(target);
        }
    }
    applyConfig(config) {
        var _a;
        this.logger = (_a = config.customLogger) !== null && _a !== void 0 ? _a : config.logger;
        this.root = config.root;
        this.isProduction = config.isProduction;
    }
    makeBuildArgs() {
        return {
            verbose: this.verbose,
            isProduction: this.isProduction,
            logger: this.logger,
            root: this.root,
            suppressError: this.suppressError,
        };
    }
    buildAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const args = this.makeBuildArgs();
            for (const target of this.targets) {
                yield target.build(args);
            }
        });
    }
    listWatchWasmDir() {
        const list = [];
        for (const target of this.targets) {
            const watchWasmPath = target.getWatchWasmPath();
            if (watchWasmPath != null) {
                list.push(path__namespace.dirname(watchWasmPath));
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
        });
    }
    isTargetWasmId(id) {
        if (/\.wasm$/i.test(id)) {
            const dir = path__namespace.dirname(id);
            const file = path__namespace.basename(id);
            return this.targets.some((target) => target.match(dir, file));
        }
        return false;
    }
    loadWasmAsProxyCode(wasmPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const wasmData = yield WasmData.create(wasmPath);
            return wasmData.generateProxyCode(this.syncImport);
        });
    }
}
class WasmTarget {
    constructor(id, options) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (typeof options === "string") {
            options = { manifestPath: options };
        }
        this.id = id;
        this.manifestPath = (_a = options.manifestPath) !== null && _a !== void 0 ? _a : null;
        this.skipBuild = (_b = options.skipBuild) !== null && _b !== void 0 ? _b : false;
        this.buildProfile = (_c = options.buildProfile) !== null && _c !== void 0 ? _c : null;
        this.ignoreBuildError = (_d = options.ignoreBuildError) !== null && _d !== void 0 ? _d : false;
        this.crateName = (_e = options.crateName) !== null && _e !== void 0 ? _e : null;
        this.skipBindgen = (_f = options.skipBindgen) !== null && _f !== void 0 ? _f : false;
        this.watchInputWasm = (_g = options.watchInputWasm) !== null && _g !== void 0 ? _g : false;
        this.inputWasmPath = (_h = options.inputWasmPath) !== null && _h !== void 0 ? _h : null;
        this.watchWasmPath = null;
        this.syncWatchWasmPath();
        this.outputDir = null;
        this.outputName = null;
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
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const profile = (_a = this.buildProfile) !== null && _a !== void 0 ? _a : (args.isProduction ? "release" : "dev");
            return yield execCargoBuildWasm({
                targetId: this.id,
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
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.inputWasmPath !== null) {
                return true;
            }
            const profile = (_a = this.buildProfile) !== null && _a !== void 0 ? _a : (args.isProduction ? "release" : "dev");
            this.inputWasmPath = yield execCargoMetadata({
                targetId: this.id,
                skipBindgen: this.skipBindgen,
                manifestPath: this.manifestPath,
                crateName: this.crateName,
                profile,
                logger: args.logger,
                verbose: args.verbose,
            });
            this.syncWatchWasmPath();
            return this.inputWasmPath !== null;
        });
    }
    bindgen(args) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.inputWasmPath === null) {
                return false;
            }
            const targetPathPrefix = path__namespace.join(args.root, this.id);
            const outputDir = path__namespace.dirname(targetPathPrefix);
            const outputName = path__namespace.basename(targetPathPrefix);
            const ok = yield execWasmBindgen({
                targetId: this.id,
                skipBindgen: this.skipBindgen,
                inputWasmPath: this.inputWasmPath,
                outputDir,
                outputName,
                logger: args.logger,
                verbose: args.verbose,
            });
            if (ok) {
                this.outputDir = outputDir;
                this.outputName = outputName;
                return true;
            }
            else {
                return false;
            }
        });
    }
    match(dir, name) {
        if (this.outputDir === null || this.outputName === null) {
            return false;
        }
        return (path__namespace.relative(this.outputDir, dir) == "" &&
            name.startsWith(this.outputName));
    }
    syncWatchWasmPath() {
        if (this.inputWasmPath == null || !this.watchInputWasm) {
            this.watchWasmPath = null;
        }
        else {
            const components = path__namespace.normalize(this.inputWasmPath).split(path__namespace.sep);
            this.watchWasmPath = components.join("/");
        }
    }
    getWatchWasmPath() {
        return this.watchWasmPath;
    }
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
        load(id) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!wasmManager.isTargetWasmId(id)) {
                    return null;
                }
                this.addWatchFile(id);
                return wasmManager.loadWasmAsProxyCode(id);
            });
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
