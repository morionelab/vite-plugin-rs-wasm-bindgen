import * as fs from "node:fs/promises"
import * as path from "node:path"

const MANUAL_START_FUNC = "__wbindgen_start"

export class WasmData {
  private fileName: string
  private importModules: Array<string>
  private exportNames: Array<string>
  private manualStart: boolean

  private constructor(
    fileName: string,
    importModules: Array<string>,
    exportNames: Array<string>,
    manualStart: boolean,
  ) {
    this.fileName = fileName
    this.importModules = importModules
    this.exportNames = exportNames
    this.manualStart = manualStart
  }

  static async create(wasmPath: string): Promise<WasmData> {
    const fileName = path.basename(wasmPath)

    const buffer = await fs.readFile(wasmPath)
    const wasm = await WebAssembly.compile(buffer)

    const importModules = Array.from(
      new Set(
        WebAssembly.Module.imports(wasm).map((desc) => desc.module),
      ).keys(),
    )

    const exportNames = Array.from(
      new Set(WebAssembly.Module.exports(wasm).map((desc) => desc.name)).keys(),
    )

    // remove '__wbindgen_start' from the export names if exists
    const manualStartIndex = exportNames.findIndex(
      (value) => value == MANUAL_START_FUNC,
    )
    const manualStart = manualStartIndex != -1
    if (manualStart) {
      exportNames.splice(manualStartIndex, 1)
    }

    return new WasmData(fileName, importModules, exportNames, manualStart)
  }

  generateProxyCode(syncImport: boolean): string {
    const wasmUrlUrl = JSON.stringify("./" + this.fileName + "?url")

    // import statements
    const importStmtLines: Array<string> = []
    const importObjectItemLines: Array<string> = []

    this.importModules.forEach((importModule, index) => {
      const importModuleLit = JSON.stringify(importModule)

      importStmtLines.push(`import * as m${index} from ${importModuleLit};`)
      importObjectItemLines.push(`[${importModuleLit}]: m${index},`)
    })

    const importStmts = importStmtLines.join("\n")
    const importObjectItems = importObjectItemLines.join("\n")

    // export statements
    const exportStmtLines: Array<string> = []
    const exportAssignLines: Array<string> = []

    this.exportNames.forEach((exportName, index) => {
      const nameLit = JSON.stringify(exportName)

      exportStmtLines.push(
        `let x${index} = undefined;`,
        `export {x${index} as ${nameLit}};`,
      )

      exportAssignLines.push(`x${index} = exports[${nameLit}];`)
    })

    if (this.manualStart) {
      // add dummy (nop) manual start function
      exportStmtLines.push(`export function ${MANUAL_START_FUNC}() {}`)
    }

    const exportStmts = exportStmtLines.join("\n")
    const exportAssigns = exportAssignLines.join("\n")

    let callManualStart = ""
    if (this.manualStart) {
      callManualStart = `exports['${MANUAL_START_FUNC}']();`
    }

    // init function
    const initPromise = `
    const init = (() => {
      const imports = {
        ${importObjectItems}
      };
      const source = fetch(wasmUrl);

      return WebAssembly.instantiateStreaming(source, imports).then((result) => {
        const { instance } = result;

        const exports = instance.exports;
        ${exportAssigns}
        ${callManualStart}  
      });
    })();
    `

    const initPromiseWaitOrExport = syncImport
      ? `await init;`
      : `export default init;`

    // generate proxy code
    return `
    import wasmUrl from ${wasmUrlUrl};

    ${importStmts}

    ${exportStmts}

    ${initPromise}

    ${initPromiseWaitOrExport}
    `
  }
}
