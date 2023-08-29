import * as fs from "node:fs/promises";
import * as path from "node:path";

export class WasmData {
  private fileName: string;
  private importModules: Array<string>;
  private exportNames: Array<string>;

  private constructor(
    fileName: string,
    importModules: Array<string>,
    exportNames: Array<string>
  ) {
    this.fileName = fileName;
    this.importModules = importModules;
    this.exportNames = exportNames;
  }

  static async create(wasmPath: string): Promise<WasmData> {
    const fileName = path.basename(wasmPath);

    const buffer = await fs.readFile(wasmPath);
    const wasm = await WebAssembly.compile(buffer);

    const importModules = Array.from(new Set(
      WebAssembly.Module.imports(wasm).map(desc => desc.module)
    ).keys());

    const exportNames = Array.from(new Set(
      WebAssembly.Module.exports(wasm).map(desc => desc.name)
    ).keys());

    return new WasmData(fileName, importModules, exportNames)
  }

  generateProxyCode(syncImport: boolean): string {
    const wasmUrlUrl = JSON.stringify("./" + this.fileName + "?url");

    // import statements
    const importStmtLines: Array<string> = [];
    const importObjectItemLines: Array<string> = [];

    this.importModules.forEach((importModule, index) => {
      const importModuleLit = JSON.stringify(importModule);

      importStmtLines.push(
        `import * as m${index} from ${importModuleLit};`
      );
      importObjectItemLines.push(
        `[${importModuleLit}]: m${index},`
      )
    });

    const importStmts = importStmtLines.join("\n");
    const importObjectItems = importObjectItemLines.join("\n");

    // export statements
    const exportStmtLines: Array<string> = [];
    const exportAssignLines: Array<string> = [];

    this.exportNames.forEach((exportName, index) => {
      const nameLit = JSON.stringify(exportName);

      exportStmtLines.push(
        `let x${index} = undefined;`,
        `export {x${index} as ${nameLit}};`
      );

      exportAssignLines.push(
        `x${index} = exports[${nameLit}];`
      );
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
