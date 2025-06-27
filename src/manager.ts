import path from "node:path"
import { type ResolvedConfig, normalizePath } from "vite"

import {
  type Options,
  NormOptions,
  NormModuleOptions,
  normalizeOptions,
} from "./options"
import { WasmInfo } from "./wasminfo"
import { Executor, ModuleState } from "./executor"
import { CodeGen } from "./codegen"

type ModuleInfo = {
  subId: string
  options: NormModuleOptions
  state: ModuleState
}

export class WasmManager {
  private options: NormOptions

  // module states and id maps
  private rawWasmIds: Map<string, ModuleInfo>
  private moduleBgWasmIds: Map<string, ModuleInfo>
  private moduleJsIds: Map<string, ModuleInfo>
  private moduleJsInitIds: Map<string, ModuleInfo>

  // tools
  private executor: Executor | null = null
  private codeGen: CodeGen | null = null

  constructor(options: Options) {
    this.options = normalizeOptions(options)

    this.rawWasmIds = new Map()
    this.moduleBgWasmIds = new Map()
    this.moduleJsIds = new Map()
    this.moduleJsInitIds = new Map()
  }

  applyConfig(config: ResolvedConfig) {
    // tools
    this.executor = new Executor(this.options, config)
    this.codeGen = new CodeGen()
  }

  async buildModules(manual: boolean) {
    this.rawWasmIds.clear()
    this.moduleBgWasmIds.clear()
    this.moduleJsIds.clear()
    this.moduleJsInitIds.clear()

    for (const [subId, moduleOptions] of Object.entries(this.options.modules)) {
      const state = await this.executor!.build(subId, moduleOptions, manual)
      const info: ModuleInfo = {
        subId,
        options: moduleOptions,
        state,
      }

      const rawWasmPath = info.state.rawWasmPath
      const outputDir = info.state.outputDir
      const outputName = info.state.outputName

      if (rawWasmPath) {
        const rawWasmId = normalizePath(rawWasmPath)
        this.rawWasmIds.set(rawWasmId, info)
      }

      const bgWasmId = normalizePath(
        path.join(outputDir, outputName + "_bg.wasm"),
      )
      this.moduleBgWasmIds.set(bgWasmId, info)

      const jsId = normalizePath(path.join(outputDir, outputName + ".js"))
      this.moduleJsIds.set(jsId, info)

      if (!info.options.useAwait) {
        const jsInitId = jsId + "?init"
        this.moduleJsInitIds.set(jsInitId, info)
      }
    }
  }

  listWatchWasmDir(): Array<string> {
    const list = []
    for (const [rawWasmId, info] of this.rawWasmIds.entries()) {
      if (info.options.watchRawWasm) {
        list.push(path.dirname(rawWasmId))
      }
    }
    return list
  }

  async handleRawWasmChange(rawWasmId: string) {
    const info = this.rawWasmIds.get(rawWasmId)
    if (info && info.options.watchRawWasm) {
      this.executor!.update(info.subId, info.options, info.state)
    }
  }

  isInitHelperId(id: string): boolean {
    return this.codeGen!.matchInitHelperId(id)
  }

  isRawWasmId(id: string): boolean {
    return this.rawWasmIds.has(id)
  }

  isModuleBgWasmId(id: string): boolean {
    return this.moduleBgWasmIds.has(id)
  }

  isModuleJsId(id: string): boolean {
    return this.moduleJsIds.has(id)
  }

  isModuleJsInitId(id: string): boolean {
    return this.moduleJsInitIds.has(id)
  }

  loadInitHelper(): string {
    return this.codeGen!.genInitHelperCode()
  }

  async loadModuleBgWasm(id: string): Promise<string | null> {
    const info = this.moduleBgWasmIds.get(id)
    if (!info) {
      return null
    }

    const subId = info.subId
    const wasm = await WasmInfo.create(id)

    return this.codeGen!.genWasmProxyCode(subId, wasm)
  }

  loadModuleJsInit(id: string): string | null {
    const info = this.moduleJsInitIds.get(id)
    if (!info) {
      return null
    }

    const subId = info.subId
    return this.codeGen!.genJsInitCode(subId)
  }

  transformModuleJs(code: string, id: string): string | null {
    const info = this.moduleJsIds.get(id)
    if (!info || !info.options.useAwait) {
      return null
    }
    const subId = info.subId
    return this.codeGen!.transformJsCodeUseAwait(code, subId)
  }
}
