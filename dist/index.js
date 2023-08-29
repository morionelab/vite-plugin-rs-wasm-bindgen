import * as path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';

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

function execCargoBuildWasm(context, meta, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        let verbose = opts.verbose;
        let skipReason = null;
        if (meta.skipBuild) {
            skipReason = "skipBuild";
        }
        else if (meta.manifestPath === null) {
            skipReason = "no manifestPath";
        }
        if (skipReason !== null) {
            if (verbose) {
                console.info(`skip building ${meta.rawId} (${skipReason})`);
            }
            return;
        }
        let manifestPath = meta.manifestPath;
        let release = opts.release;
        let command = "cargo";
        let args = [];
        args.push("build", "--lib");
        args.push("--manifest-path", manifestPath);
        args.push("--target", "wasm32-unknown-unknown");
        if (release) {
            args.push("--release");
        }
        const joinedArgs = args.join(" ");
        try {
            if (verbose) {
                console.info(`building ${meta.rawId}: ${command} ${joinedArgs}`);
            }
            yield promisify(execFile)(command, args);
        }
        catch (error) {
            context.warn(`building ${meta.rawId} failed: ${command} ${joinedArgs}`);
        }
    });
}
function execCargoMetadata(context, meta, opts) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let verbose = opts.verbose;
        let skipReason = null;
        if (meta.skipBindgen) {
            skipReason = "skipBindgen";
        }
        else if (meta.inputWasmPath !== null) {
            skipReason = "inputWasmPath is set";
        }
        else if (meta.manifestPath === null) {
            skipReason = "no manifestPath";
        }
        if (skipReason !== null) {
            if (verbose) {
                console.info(`skip resolving input wasm of ${meta.rawId} (${skipReason})`);
            }
            return;
        }
        let manifestPath = meta.manifestPath;
        let release = opts.release;
        let command = "cargo";
        let args = [];
        args.push("metadata", "--no-deps");
        args.push("--manifest-path", manifestPath);
        args.push("--format-version", "1");
        try {
            if (verbose) {
                console.info(`resolving input wasm of ${meta.rawId}`);
            }
            let { stdout } = yield promisify(execFile)(command, args);
            let metadata = JSON.parse(stdout);
            let targetDirectory = metadata["target_directory"];
            let name = null;
            for (let package_ of metadata["packages"]) {
                for (let target of package_["targets"]) {
                    if (target["crate_types"].includes("cdylib")) {
                        if (name === null) {
                            name = target["name"];
                        }
                        else {
                            throw "multiple cdylib targets";
                        }
                    }
                }
            }
            if (name === null) {
                throw "no cdylib target";
            }
            let buildProfile = (_a = meta.buildProfile) !== null && _a !== void 0 ? _a : null;
            if (buildProfile === null) {
                buildProfile = release ? "release" : "debug";
            }
            meta.inputWasmPath = path.join(targetDirectory, "wasm32-unknown-unknown", buildProfile, name.replace(/-/g, '_') + ".wasm");
            if (verbose) {
                console.info(`resolved input wasm of ${meta.rawId}: ${meta.inputWasmPath}`);
            }
        }
        catch (error) {
            context.warn(`resolving input wasm of ${meta.rawId} failed: ${error}`);
        }
    });
}
function execWasmBindgen(context, meta, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        let verbose = opts.verbose;
        let skipReason = null;
        if (meta.skipBindgen) {
            skipReason = "skipBindgen";
        }
        else if (meta.inputWasmPath === null) {
            skipReason = "no inputWasmPath";
        }
        if (skipReason !== null) {
            if (verbose) {
                console.info(`skip wasm-bindgen of ${meta.rawId} (${skipReason})`);
            }
            return;
        }
        let inputWasmPath = meta.inputWasmPath;
        let command = "wasm-bindgen";
        let args = [];
        args.push("--out-dir", meta.bindgenDir);
        args.push("--out-name", meta.bindgenName);
        args.push("--target", "bundler");
        args.push(inputWasmPath);
        const joinedArgs = args.join(" ");
        try {
            if (verbose) {
                console.info(`bindgen ${meta.rawId}: ${command} ${joinedArgs}`);
            }
            yield promisify(execFile)(command, args);
        }
        catch (error) {
            context.warn(`bindgen ${meta.rawId} failed: ${command} ${joinedArgs}`);
        }
    });
}

function createWasmMetaFromOptions(root, id, options) {
    var _a, _b, _c, _d, _e;
    const rawId = id;
    if (typeof options === "string") {
        options = { manifestPath: options };
    }
    const bindgenPath = path.join(root, id);
    const bindgenDir = path.dirname(bindgenPath);
    const bindgenName = path.basename(bindgenPath);
    path.join();
    const skipBuild = (_a = options.skipBuild) !== null && _a !== void 0 ? _a : false;
    const manifestPath = (_b = options.manifestPath) !== null && _b !== void 0 ? _b : null;
    const buildProfile = (_c = options.buildProfile) !== null && _c !== void 0 ? _c : null;
    const skipBindgen = (_d = options.skipBindgen) !== null && _d !== void 0 ? _d : false;
    const inputWasmPath = (_e = options.inputWasmPath) !== null && _e !== void 0 ? _e : null;
    return {
        rawId,
        manifestPath,
        inputWasmPath,
        skipBuild,
        buildProfile,
        skipBindgen,
        bindgenDir,
        bindgenName,
    };
}

class WasmData {
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
            const importModules = Array.from(new Set(WebAssembly.Module.imports(wasm).map(desc => desc.module)).keys());
            const exportNames = Array.from(new Set(WebAssembly.Module.exports(wasm).map(desc => desc.name)).keys());
            return new WasmData(fileName, importModules, exportNames);
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
        const exportStmts = exportStmtLines.join("\n");
        const exportAssigns = exportAssignLines.join("\n");
        // init function
        const initProxyFuncDef = `
    async function initProxy() {
      const source = fetch(wasmUrl);

      const imports = {
        ${importObjectItems}
      };

      const { instance } = await WebAssembly.instantiateStreaming(source, imports);

      const exports = instance.exports;
      ${exportAssigns};
    }
    `;
        const initProxyCallOrExport = syncImport ?
            `await initProxy();` :
            `export default initProxy`;
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

const PLUGIN_NAME = "rs-wasm-bindgen";
function rsWasmBindgen(options) {
    var _a, _b, _c;
    options = options !== null && options !== void 0 ? options : {};
    let verbose = (_a = options.verbose) !== null && _a !== void 0 ? _a : false;
    let syncImport = (_b = options.syncImport) !== null && _b !== void 0 ? _b : false;
    let wasmMetaOptionsMap = (_c = options.wasmMeta) !== null && _c !== void 0 ? _c : {};
    let root = null;
    let release = false;
    let wasmMetaList = [];
    return {
        name: PLUGIN_NAME,
        configResolved(config) {
            console.log(config.configFile);
            root = config.root;
            release = config.isProduction;
            for (let id in wasmMetaOptionsMap) {
                const wasmMetaOptions = wasmMetaOptionsMap[id];
                const wasmMeta = createWasmMetaFromOptions(root, id, wasmMetaOptions);
                wasmMetaList.push(wasmMeta);
            }
        },
        buildStart(_inputOptions) {
            return __awaiter(this, void 0, void 0, function* () {
                let context = this;
                let opts = { verbose, release };
                for (let wasmMeta of wasmMetaList) {
                    yield execCargoBuildWasm(context, wasmMeta, opts);
                    yield execCargoMetadata(context, wasmMeta, opts);
                    yield execWasmBindgen(context, wasmMeta, opts);
                }
            });
        },
        load(id) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!/\.wasm$/i.test(id)) {
                    return null;
                }
                const wasmData = yield WasmData.create(id);
                return wasmData.generateProxyCode(syncImport);
            });
        },
    };
}

export { rsWasmBindgen as default };
