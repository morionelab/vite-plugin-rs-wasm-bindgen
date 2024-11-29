export type Options = {
  /**
   * If true, info log is displayed.
   * Useful to see the failed command.
   */
  verbose?: boolean

  /**
   * If true, the stderr of subprocess (e.g. `cargo build`) is redirected.
   */
  redirectStderr?: boolean

  /**
   * If true, `cargo build` uses the profile *debug*;
   * otherwise it uses the profile *release*.
   */
  useDebugBuild?: boolean

  /**
   * Specified targets managed by this plugin.
   * 
   * The key is expected to be output wasm module path without extension.
   * Non-absolute path is resolved from the project root.
   * 
   * Internally, the key is resolved and separated to *dirname* and *basename*
   * then passed to `wasm-bindgen` as `--out-dir <dirname> --out-name <basename>`.
   * 
   * The value must be either a string value or an object of type `TargetOptions`.
   * The string value is considered as `manifestPath` of `TargetOptions`.
   */
  targets?: Record<string, string | TargetOptions>
}

export type TargetOptions = {
  /**
   * If true, `cargo build` and `wasm-bindgen` for this target is skipped
   * assuming the necessary files are already generated at the expected path.
   */
  skipBindgen?: boolean

  /**
   * If true, `cargo build` for this target is skipped
   * assuming the necessary files are already built.
   */
  skipBuild?: boolean

  /**
   * Path to the `Cargo.toml` of the wasm source.
   *
   * This field is required unless `skipBindgen` or `skipBuild` is true.
   * 
   * Non-absolute path is resolved from the project root.
   */
  manifestPath?: string

  /**
   * Target-specific `useDebugBuild` setting.
   * If omitted, the top-level setting is applied.
   */
  useDebugBuild?: boolean

  /**
   * Path to the wasm file compiled by `cargo build`.
   *
   * This field is usually not required because the plugin resolves the path
   * using `cargo metadata`. This field is required if
   * - `manifestPath` is not set,
   * - the workspace contains multiple packages.
   * 
   * Non-absolute path is resolved from the project root.
   */
  rawWasmPath?: string

  noWatchRawWasm?: boolean
}


export type NormOptions = {
  verbose: boolean,
  redirectStderr: boolean,
  targets: Record<string, NormTargetOptions>
}

export type NormTargetOptions = {
  skipBindgen: boolean
  skipBuild: boolean
  manifestPath: string | null
  useDebugBuild: boolean
  rawWasmPath: string | null
  noWatchRawWasm: boolean
}

export function normalizeOptions(options: Options): NormOptions {
  const anyAsBool = (value: any) => (!!value)
  const anyAsOptStr = (value: any) => (typeof value === 'string' ? value : null)

  const verbose = anyAsBool(options.verbose)
  const redirectStderr = anyAsBool(options.redirectStderr)
  const useDebugBuild = anyAsBool(options.useDebugBuild)

  const rawTargets = options.targets ?? {}
  const targets: Record<string, NormTargetOptions> = {}

  for (const [subId, target] of Object.entries(rawTargets)) {
    if (typeof target === 'object') {
      targets[subId] = {
        skipBindgen: anyAsBool(target.skipBindgen),
        skipBuild: anyAsBool(target.skipBuild),
        manifestPath: anyAsOptStr(target.manifestPath),
        useDebugBuild: anyAsBool(target.useDebugBuild ?? useDebugBuild),
        rawWasmPath: anyAsOptStr(target.rawWasmPath),
        noWatchRawWasm: anyAsBool(target.noWatchRawWasm),
      }
    } else {
      targets[subId] = {
        skipBindgen: false,
        skipBuild: false,
        manifestPath: anyAsOptStr(target),
        useDebugBuild, // use top-level value
        rawWasmPath: null,
        noWatchRawWasm: false,
      }
    }
  }

  return {
    verbose,
    redirectStderr,
    targets,
  }
}
