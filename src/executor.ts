import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { NormOptions, NormModuleOptions } from "./options"

import { Logger, ResolvedConfig, createLogger } from "vite"

export type ModuleState = {
  debugBuild: boolean
  rawWasmPath: null | string
  outputDir: string
  outputName: string
}

export class Executor {
  private absRoot: string
  private redirectStderr: boolean

  private logger: Logger

  constructor(options: NormOptions, config: ResolvedConfig) {
    this.absRoot = path.resolve(config.root)
    this.redirectStderr = options.redirectStderr

    this.logger = createLogger(options.verbose ? "info" : "error", {
      prefix: "rs-wasm",
      allowClearScreen: config.clearScreen,
      customLogger: config.customLogger,
    })
  }

  async build(
    subId: string,
    moduleOptions: NormModuleOptions,
    manual: boolean,
  ): Promise<ModuleState> {
    const outputPath = path.resolve(this.absRoot, subId)
    if (path.extname(outputPath)) {
      this.logWarn(`module key "${subId}" has extension`)
    }

    let rawWasmPath = moduleOptions.rawWasmPath
    if (rawWasmPath) {
      rawWasmPath = path.resolve(this.absRoot, rawWasmPath)
    }

    const state: ModuleState = {
      debugBuild: false,
      rawWasmPath,
      outputDir: path.dirname(outputPath),
      outputName: path.basename(outputPath),
    }

    if (
      moduleOptions.skipBindgen &&
      !(moduleOptions.skipBindgen === "auto" && manual)
    ) {
      this.logInfo(`skip build and bindgen "${subId}"`)
    } else {
      await this.cargoBuild(subId, moduleOptions, manual, state)
      await this.resolveRawWasmPath(subId, moduleOptions, state)
      await this.wasmBindgen(subId, moduleOptions, manual, state)
    }
    return state
  }

  async update(
    subId: string,
    moduleOptions: NormModuleOptions,
    state: ModuleState,
  ) {
    const manual = false
    if (moduleOptions.skipBindgen) {
      // skip
    } else {
      await this.wasmBindgen(subId, moduleOptions, manual, state)
    }
  }

  private async cargoBuild(
    subId: string,
    options: NormModuleOptions,
    manual: boolean,
    state: ModuleState,
  ) {
    const subError = new Error("cargo build failed")
    const operation = `building "${subId}" raw-wasm`

    if (options.skipBuild && !(options.skipBuild === "auto" && manual)) {
      this.logInfo(`skip ${operation}`)
      return
    } else if (options.manifestPath === null) {
      this.logError(`FAILED ${operation}: no manifest path`)
      throw subError
    }

    const absManifestPath = path.resolve(this.absRoot, options.manifestPath)

    const command = "cargo"
    const commandArgs: Array<string> = []

    commandArgs.push("build", "--lib")
    commandArgs.push("--manifest-path", absManifestPath)
    commandArgs.push("--target", "wasm32-unknown-unknown")

    if (!options.useDebugBuild) {
      commandArgs.push("--release")
    }

    try {
      this.logInfo(`${operation}: ${command} ${commandArgs.join(" ")}`)

      const result = await promisify(execFile)(command, commandArgs)

      if (this.redirectStderr) {
        this.printStderr(result)
      }
    } catch (error: unknown) {
      if (this.redirectStderr) {
        this.printStderr(error)
      }

      this.logError(`FAILED ${operation}`)

      throw subError
    }

    state.debugBuild = options.useDebugBuild
  }

  async resolveRawWasmPath(
    subId: string,
    options: NormModuleOptions,
    state: ModuleState,
  ) {
    const subError = new Error("cargo metadata failed")
    const operation = `resolving "${subId}" raw-wasm path`

    if (state.rawWasmPath) {
      return
    } else if (options.manifestPath === null) {
      this.logError(`FAILED ${operation}: no manifest path`)
      throw subError
    }

    const absManifestPath = path.resolve(this.absRoot, options.manifestPath)

    const command = "cargo"
    const commandArgs: Array<string> = []
    commandArgs.push("metadata")
    commandArgs.push("--no-deps")
    commandArgs.push("--manifest-path", absManifestPath!)
    commandArgs.push("--format-version", "1")

    let output: string = ""
    try {
      this.logInfo(`${operation}: ${command} ${commandArgs.join(" ")}`)

      const result = await promisify(execFile)(command, commandArgs)
      if (this.redirectStderr) {
        this.printStderr(result)
      }
      output = result.stdout
    } catch (error: unknown) {
      this.logError(`FAILED ${operation}`)

      if (this.redirectStderr) {
        this.printStderr(error)
      }

      throw subError
    }

    try {
      let metadata = JSON.parse(output)
      state.rawWasmPath = this.extractRawWasmPath(metadata, state.debugBuild)
      this.logInfo(`resolved => ${state.rawWasmPath}`)
    } catch (error: unknown) {
      if (typeof error === "string") {
        this.logError(`FAILED ${operation}: ${error}`)
      } else {
      }
      throw subError
    }
  }

  private extractRawWasmPath(metadata: any, debugBuild: boolean): string {
    const targetDir = metadata["target_directory"] as string

    const packages = metadata["packages"] as Array<any>
    if (packages.length > 1) {
      throw "multiple packages"
    }

    const targets = packages[0].targets as Array<any>
    let libName: null | string = null
    for (const target of targets) {
      const kind = target.kind as Array<string>
      if (kind.includes("cdylib")) {
        libName = target.name as string
        break
      }
    }

    if (libName === null) {
      throw "no cdylib target"
    }

    const wasmName = libName.replace(/-/g, "_") + ".wasm"
    const profileDir = debugBuild ? "debug" : "release"

    return path.join(targetDir, "wasm32-unknown-unknown", profileDir, wasmName)
  }

  private async wasmBindgen(
    subId: string,
    options: NormModuleOptions,
    manual: boolean,
    state: ModuleState,
  ) {
    const subError = new Error("wasm-bindgen failed")
    const operation = `generating "${subId}" module`

    if (options.skipBindgen && !(options.skipBindgen === "auto" && manual)) {
      this.logInfo(`skip ${operation}`)
      return
    } else if (state.rawWasmPath === null) {
      this.logError(`FAILED ${operation}: no raw wasm path`)
      throw subError
    }

    const command = "wasm-bindgen"
    const commandArgs: Array<string> = []

    commandArgs.push("--out-dir", state.outputDir)
    commandArgs.push("--out-name", state.outputName)
    commandArgs.push("--target", "bundler")
    commandArgs.push(state.rawWasmPath)

    try {
      this.logInfo(`${operation}: ${command} ${commandArgs.join(" ")}`)

      const result = await promisify(execFile)(command, commandArgs)
      if (this.redirectStderr) {
        this.printStderr(result)
      }
    } catch (error: unknown) {
      this.logError(`FAILED ${operation}`)

      if (this.redirectStderr) {
        this.printStderr(error)
      }

      throw subError
    }
  }

  private printStderr(obj: unknown) {
    if (
      obj &&
      typeof obj === "object" &&
      "stderr" in obj &&
      (typeof obj.stderr === "string" || obj.stderr instanceof Uint8Array)
    ) {
      process.stderr.write(obj.stderr)
    }
  }

  private logInfo(msg: string) {
    this.logger.info(msg, { timestamp: true })
  }

  private logWarn(msg: string) {
    this.logger.warn(msg, { timestamp: true })
  }

  private logError(msg: string) {
    this.logger.error(msg, { timestamp: true })
  }
}
