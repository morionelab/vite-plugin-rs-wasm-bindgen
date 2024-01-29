import { type ResolvedConfig, type Logger } from "vite"
import * as path from "node:path"

import { type Options, type TargetOptions } from "./options"
import { WasmData } from "./wasmlib"
import { execCargoBuildWasm, execCargoMetadata, execWasmBindgen } from "./cmds"

export class WasmManager {
  // options
  private verbose: boolean
  private suppressError: boolean = false
  private syncImport: boolean
  private targets: Array<WasmTarget>

  // config
  private logger: Logger | null = null
  private root: string | null = null
  private isProduction: boolean = false

  constructor(options: Options) {
    this.verbose = options.verbose ?? false
    this.suppressError = options.suppressError ?? false
    this.syncImport = options.syncImport ?? false

    // targets
    const targetOptions = options.targets ?? {}
    this.targets = []
    for (const targetId in targetOptions) {
      const target = new WasmTarget(targetId, targetOptions[targetId])
      this.targets.push(target)
    }
  }

  applyConfig(config: ResolvedConfig) {
    this.logger = config.customLogger ?? config.logger
    this.root = config.root
    this.isProduction = config.isProduction
  }

  private makeBuildArgs(): WasmTargetBuildArgs {
    return {
      verbose: this.verbose,
      isProduction: this.isProduction,
      logger: this.logger!,
      root: this.root!,
      suppressError: this.suppressError,
    }
  }

  async buildAll() {
    const args = this.makeBuildArgs()

    for (const target of this.targets) {
      await target.build(args)
    }
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
  }

  isTargetWasmId(id: string): boolean {
    if (/\.wasm$/i.test(id)) {
      const dir = path.dirname(id)
      const file = path.basename(id)

      return this.targets.some((target) => target.match(dir, file))
    }

    return false
  }

  async loadWasmAsProxyCode(wasmPath: string): Promise<string> {
    const wasmData = await WasmData.create(wasmPath)
    return wasmData.generateProxyCode(this.syncImport)
  }
}

type WasmTargetBuildArgs = {
  logger: Logger
  verbose: boolean
  isProduction: boolean
  root: string
  suppressError: boolean
}

class WasmTarget {
  private id: string
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
  private outputName: null | string

  constructor(id: string, options: TargetOptions) {
    if (typeof options === "string") {
      options = { manifestPath: options }
    }

    this.id = id
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
    this.outputName = null

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
      targetId: this.id,
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
      targetId: this.id,
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

    const targetPathPrefix = path.join(args.root, this.id)
    const outputDir = path.dirname(targetPathPrefix)
    const outputName = path.basename(targetPathPrefix)

    const ok = await execWasmBindgen({
      targetId: this.id,
      skipBindgen: this.skipBindgen,
      inputWasmPath: this.inputWasmPath,
      outputDir,
      outputName,
      logger: args.logger,
      verbose: args.verbose,
    })

    if (ok) {
      this.outputDir = outputDir
      this.outputName = outputName
      return true
    } else {
      return false
    }
  }

  match(dir: string, name: string): boolean {
    if (this.outputDir === null || this.outputName === null) {
      return false
    }
    return (
      path.relative(this.outputDir, dir) == "" &&
      name.startsWith(this.outputName)
    )
  }

  private syncWatchWasmPath() {
    if (this.inputWasmPath == null || !this.watchInputWasm) {
      this.watchWasmPath = null
    } else {
      const components = path.normalize(this.inputWasmPath).split(path.sep)
      this.watchWasmPath = components.join("/")
    }
  }

  getWatchWasmPath(): null | string {
    return this.watchWasmPath
  }
}
