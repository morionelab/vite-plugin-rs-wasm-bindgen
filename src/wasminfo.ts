import * as fs from "node:fs/promises"
import * as path from "node:path"

export class WasmInfo {
  private fileName: string
  private importModules: Array<string>
  private exportNames: Array<string>

  private constructor(
    fileName: string,
    importModules: Array<string>,
    exportNames: Array<string>,
  ) {
    this.fileName = fileName
    this.importModules = importModules
    this.exportNames = exportNames
  }

  static async create(wasmPath: string): Promise<WasmInfo> {
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

    return new WasmInfo(fileName, importModules, exportNames)
  }

  getFileName(): string {
    return this.fileName
  }

  getImportModules(): Array<string> {
    return this.importModules
  }

  getExportNames(): Array<string> {
    return this.exportNames
  }
}
