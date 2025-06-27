import { WasmInfo } from "./wasminfo"

const INIT_HELPER_PREFIX = "\0virtual:rs-wasm-bindgen?init"
const FN_MANUAL_START = "__wbindgen_start"

export class CodeGen {

  constructor() { }

  private makeInitHelperId(key: string): string {
    return INIT_HELPER_PREFIX + '&' + key
  }

  matchInitHelperId(id: string): boolean {
    return id.startsWith(INIT_HELPER_PREFIX)
  }

  genInitHelperCode(): string {
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
    `
  }

  genWasmProxyCode(key: string, wasm: WasmInfo,): string {
    const wasmUrlUrl = JSON.stringify("./" + wasm.getFileName() + "?url")
    const initHelperModule = JSON.stringify(this.makeInitHelperId(key))

    // import statements
    const importStmtLines: Array<string> = []
    const importObjectItemLines: Array<string> = []

    wasm.getImportModules().forEach((importModule, index) => {
      const importModuleLit = JSON.stringify(importModule)

      importStmtLines.push(`import * as m${index} from ${importModuleLit};`)
      importObjectItemLines.push(`[${importModuleLit}]: m${index},`)
    })

    const importStmts = importStmtLines.join("\n")
    const importObjectItems = importObjectItemLines.join("\n")

    // export statements
    const exportStmtLines: Array<string> = []
    const exportAssignLines: Array<string> = []

    let hasManualStart = false
    wasm.getExportNames().forEach((exportName, index) => {
      if (exportName === FN_MANUAL_START) {
        hasManualStart = true
      } else {
        const nameLit = JSON.stringify(exportName)

        exportStmtLines.push(
          `let x${index} = undefined;`,
          `export {x${index} as ${nameLit}};`,
        )

        exportAssignLines.push(`x${index} = exports[${nameLit}];`)
      }
    })

    if (hasManualStart) {
      // add dummy (nop) manual start function
      exportStmtLines.push(`export function ${FN_MANUAL_START}() {}`)
    }

    const exportStmts = exportStmtLines.join("\n")
    const exportAssigns = exportAssignLines.join("\n")

    let callManualStart = ""
    if (hasManualStart) {
      callManualStart = `exports['${FN_MANUAL_START}']();`
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
    `

    // generate proxy code
    return `
    import wasmUrl from ${wasmUrlUrl};
    import { hookInit } from ${initHelperModule};
  
    ${importStmts}
  
    ${exportStmts}
  
    ${hookInit}
    `
  }

  genJsInitCode(key: string): string {
    const initHelperModule = JSON.stringify(this.makeInitHelperId(key))

    return `
    import { init } from ${initHelperModule};
    export default init;
    `
  }

  transformJsCodeUseAwait(code: string, key: string): string {
    const initHelperModule = JSON.stringify(this.makeInitHelperId(key))

    let extLines = `
    import { init } from ${initHelperModule};
    await init();
    `

    return code + extLines
  }
}