import path from "node:path"

import { type ResolvedConfig, type Logger } from "vite"

import { type Options, type TargetOptions } from "./options"
import { WasmInfo } from "./wasminfo"
import { execCargoBuildWasm, execCargoMetadata, execWasmBindgen } from "./cmds"
import { CodeGen } from "./codegen"

export class WasmManager {
  // options
  private verbose: boolean
  private suppressError: boolean

  // config
  private logger: Logger | null = null
  private absRoot: string | null = null
  private isProduction: boolean = false

  // targets
  private targets: Array<WasmTarget>
  private targetWasmBgIds: Map<string, WasmTarget>
  private targetJsIds: Map<string, [WasmTarget, boolean]>

  // tools
  private codeGen: CodeGen

  constructor(options: Options) {
    this.verbose = options.verbose ?? false
    this.suppressError = options.suppressError ?? false

    // targets
    this.targets = Object.entries(options.targets ?? {})
      .map(([key, targetOptions]) => new WasmTarget(key, targetOptions))
    this.targetWasmBgIds = new Map<string, WasmTarget>()
    this.targetJsIds = new Map<string, [WasmTarget, boolean]>()

    // tools
    this.codeGen = new CodeGen()
  }

  applyConfig(config: ResolvedConfig) {
    this.logger = config.customLogger ?? config.logger
    this.absRoot = path.resolve(config.root)
    this.isProduction = config.isProduction
  }

  private makeBuildArgs(): WasmTargetBuildArgs {
    return {
      verbose: this.verbose,
      isProduction: this.isProduction,
      logger: this.logger!,
      absRoot: this.absRoot!,
      suppressError: this.suppressError,
    }
  }

  async buildAll() {
    const args = this.makeBuildArgs()

    for (const target of this.targets) {
      await target.build(args)
    }
    this.updateTargetIds()
  }

  private updateTargetIds() {
    this.targetJsIds.clear()
    this.targetWasmBgIds.clear()

    this.targets.forEach((target) => {
      // init id
      const JsInitId = target.getOutputJsInitId()
      if (JsInitId) {
        this.targetJsIds.set(JsInitId, [target, false])
      }

      const JsSyncId = target.getOutputJsSyncId()
      if (JsSyncId) {
        this.targetJsIds.set(JsSyncId, [target, true])
      }

      const bgWasmId = target.getOutputBgWasmId()
      if (bgWasmId) {
        this.targetWasmBgIds.set(bgWasmId, target)
      }
    })
  }

  listWatchWasmDir(): Array<string> {
    const list = []
    for (const target of this.targets) {
      const watchWasmPath = target.getWatchWasmPath()
      if (watchWasmPath != null) {
        list.push(path.dirname(watchWasmPath))
      }
    }
    return list
  }

  async handleWasmChange(watchWasmPath: string) {
    const targets = this.targets.filter(
      (target) => target.getWatchWasmPath() == watchWasmPath,
    )
    if (targets.length == 0) {
      return
    }

    const args = this.makeBuildArgs()

    for (const target of targets) {
      await target.bindgen(args)
    }
    this.updateTargetIds()
  }

  isInitHelperId(id: string): boolean {
    return this.codeGen.matchInitHelperId(id)
  }

  isTargetBgWasmId(id: string): boolean {
    return this.targetWasmBgIds.has(id)
  }

  isTargetJsId(id: string): boolean {
    return this.targetJsIds.has(id)
  }

  loadInitHelper(): string {
    return this.codeGen.genInitHelperCode()
  }

  async loadTargetBgWasm(id: string): Promise<string | null> {
    const target = this.targetWasmBgIds.get(id)
    if (!target) {
      return null
    }

    const key = target.getKey()
    const wasm = await WasmInfo.create(id)

    return this.codeGen.genWasmProxyCode(key, wasm)
  }

  transformTargetJs(code: string, id: string): string | null {
    const entry = this.targetJsIds.get(id)
    if (!entry) {
      return null
    }
    const [target, useAwait] = entry

    const key = target.getKey()

    return this.codeGen.transformJsCode(code, key, useAwait)
  }

}

type WasmTargetBuildArgs = {
  logger: Logger
  verbose: boolean
  isProduction: boolean
  absRoot: string
  suppressError: boolean
}


class WasmTarget {
  private key: string
  private manifestPath: null | string
  private skipBuild: boolean
  private buildProfile: null | string
  private ignoreBuildError: boolean
  private crateName: null | string
  private skipBindgen: boolean
  private watchInputWasm: boolean

  private inputWasmPath: null | string
  private watchWasmPath: null | string
  private outputDir: null | string
  private outputJs: null | string
  private outputBgWasm: null | string

  constructor(key: string, options: string | TargetOptions) {
    if (typeof options === "string") {
      options = { manifestPath: options }
    }

    this.key = key
    this.manifestPath = options.manifestPath ?? null
    this.skipBuild = options.skipBuild ?? false
    this.buildProfile = options.buildProfile ?? null
    this.ignoreBuildError = options.ignoreBuildError ?? false
    this.crateName = options.crateName ?? null
    this.skipBindgen = options.skipBindgen ?? false
    this.watchInputWasm = options.watchInputWasm ?? false
    this.inputWasmPath = options.inputWasmPath ?? null
    this.watchWasmPath = null
    this.outputDir = null
    this.outputJs = null
    this.outputBgWasm = null

    if (this.manifestPath !== null) {
      this.manifestPath = path.resolve(this.manifestPath)
    }
    if (this.inputWasmPath !== null) {
      this.inputWasmPath = path.resolve(this.inputWasmPath)
    }
    this.syncWatchWasmPath()
  }

  async build(args: WasmTargetBuildArgs) {
    if (!(await this.buildInputWasm(args))) {
      return
    }
    if (!(await this.locateInputWasm(args))) {
      return
    }
    if (!(await this.bindgen(args))) {
      return
    }
  }

  private async buildInputWasm(args: WasmTargetBuildArgs): Promise<boolean> {
    const profile = this.buildProfile ?? (args.isProduction ? "release" : "dev")

    return await execCargoBuildWasm({
      key: this.key,
      skipBuild: this.skipBuild,
      manifestPath: this.manifestPath,
      profile,
      ignoreError: this.ignoreBuildError,
      logger: args.logger,
      verbose: args.verbose,
      suppressError: args.suppressError,
    })
  }

  private async locateInputWasm(args: WasmTargetBuildArgs): Promise<boolean> {
    if (this.inputWasmPath !== null) {
      return true
    }

    const profile = this.buildProfile ?? (args.isProduction ? "release" : "dev")

    this.inputWasmPath = await execCargoMetadata({
      key: this.key,
      skipBindgen: this.skipBindgen,
      manifestPath: this.manifestPath,
      crateName: this.crateName,
      profile,
      logger: args.logger,
      verbose: args.verbose,
    })

    if (this.inputWasmPath !== null) {
      this.inputWasmPath = path.resolve(this.inputWasmPath)
    }
    this.syncWatchWasmPath()

    return this.inputWasmPath !== null
  }

  async bindgen(args: WasmTargetBuildArgs): Promise<boolean> {
    if (this.inputWasmPath === null) {
      return false
    }

    const outputPrefix = path.join(args.absRoot, this.key)
    const outputDir = path.dirname(outputPrefix)
    const outputName = path.basename(outputPrefix)

    const ok = await execWasmBindgen({
      key: this.key,
      skipBindgen: this.skipBindgen,
      inputWasmPath: this.inputWasmPath,
      outputDir,
      outputName,
      logger: args.logger,
      verbose: args.verbose,
    })

    if (ok) {
      this.outputDir = outputDir
      this.outputJs = outputName + '.js'
      this.outputBgWasm = outputName + '_bg.wasm'
      return true
    } else {
      return false
    }
  }

  private syncWatchWasmPath() {
    if (this.inputWasmPath == null || !this.watchInputWasm) {
      this.watchWasmPath = null
    } else {
      this.watchWasmPath = normalizePath(path.normalize(this.inputWasmPath))
    }
  }

  getKey(): string {
    return this.key
  }

  getWatchWasmPath(): null | string {
    return this.watchWasmPath
  }

  getOutputJsInitId(): string | null {
    if (this.outputDir !== null && this.outputJs) {
      return normalizePath(path.join(this.outputDir, this.outputJs)) + '?init'
    } else {
      return null
    }
  }

  getOutputJsSyncId(): string | null {
    if (this.outputDir !== null && this.outputJs) {
      return normalizePath(path.join(this.outputDir, this.outputJs)) + '?sync'
    } else {
      return null
    }
  }

  getOutputBgWasmId(): string | null {
    if (this.outputDir !== null && this.outputBgWasm) {
      return normalizePath(path.join(this.outputDir, this.outputBgWasm))
    } else {
      return null
    }
  }
}

function normalizePath(fileName: string): string {
  return fileName.replace(/\\/g, "/")
}