import path from "node:path"
import { type ResolvedConfig, normalizePath } from "vite"

import {
  type Options,
  NormOptions,
  NormTargetOptions,
  normalizeOptions,
} from "./options"
import { WasmInfo } from "./wasminfo"
import { Executor, TargetBuildState } from "./executor"
import { CodeGen } from "./codegen"

type TargetInfo = {
  subId: string
  options: NormTargetOptions
  state: TargetBuildState
}

export class WasmManager {
  private options: NormOptions

  // target states and id maps
  private rawWasmIds: Map<string, TargetInfo>
  private targetBgWasmIds: Map<string, TargetInfo>
  private targetJsIds: Map<string, [TargetInfo, boolean]>

  // tools
  private executor: Executor | null = null
  private codeGen: CodeGen | null = null

  constructor(options: Options) {
    this.options = normalizeOptions(options)

    this.rawWasmIds = new Map()
    this.targetBgWasmIds = new Map()
    this.targetJsIds = new Map()
  }

  applyConfig(config: ResolvedConfig) {
    // tools
    this.executor = new Executor(this.options, config)
    this.codeGen = new CodeGen()
  }

  async buildTargets(manual: boolean) {
    this.rawWasmIds.clear()
    this.targetBgWasmIds.clear()
    this.targetJsIds.clear()

    for (const [subId, targetOptions] of Object.entries(this.options.targets)) {
      const state = await this.executor!.build(subId, targetOptions, manual)
      const info: TargetInfo = {
        subId,
        options: targetOptions,
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
      this.targetBgWasmIds.set(bgWasmId, info)

      const jsId = normalizePath(path.join(outputDir, outputName + ".js"))
      this.targetJsIds.set(jsId + "?init", [info, false])
      this.targetJsIds.set(jsId + "?sync", [info, true])
    }
  }

  listWatchWasmDir(): Array<string> {
    const list = []
    for (const [rawWasmId, info] of this.rawWasmIds.entries()) {
      if (!info.options.noWatchRawWasm) {
        list.push(path.dirname(rawWasmId))
      }
    }
    return list
  }

  async handleRawWasmChange(rawWasmId: string) {
    const info = this.rawWasmIds.get(rawWasmId)
    if (info && !info.options.noWatchRawWasm) {
      this.executor!.update(info.subId, info.options, info.state)
    }
  }

  isInitHelperId(id: string): boolean {
    return this.codeGen!.matchInitHelperId(id)
  }

  isRawWasmId(id: string): boolean {
    return this.rawWasmIds.has(id)
  }

  isTargetBgWasmId(id: string): boolean {
    return this.targetBgWasmIds.has(id)
  }

  isTargetJsId(id: string): boolean {
    return this.targetJsIds.has(id)
  }

  loadInitHelper(): string {
    return this.codeGen!.genInitHelperCode()
  }

  async loadTargetBgWasm(id: string): Promise<string | null> {
    const info = this.targetBgWasmIds.get(id)
    if (!info) {
      return null
    }

    const subId = info?.subId
    const wasm = await WasmInfo.create(id)

    return this.codeGen!.genWasmProxyCode(subId, wasm)
  }

  transformTargetJs(code: string, id: string): string | null {
    const entry = this.targetJsIds.get(id)
    if (!entry) {
      return null
    }
    const [info, useAwait] = entry
    const subId = info.subId

    return this.codeGen!.transformJsCode(code, subId, useAwait)
  }
}
