export type Options = {
  verbose?: boolean
  suppressError?: boolean
  targets?: Record<string, string | TargetOptions>
}

export type TargetOptions = {
  /**
   * Path to the `Cargo.toml` of the wasm package.
   *
   * This path is passed to `cargo build --manifest-path` as-is.
   * Use absolute path (`path.join(__dirname, relative_path)`) if necessary.
   */
  manifestPath?: string
  skipBuild?: boolean
  buildProfile?: string
  ignoreBuildError?: boolean
  crateName?: string
  skipBindgen?: boolean
  /**
   * Path to the compiled wasm.
   *
   * This path is passed to `wasm-bindgen` as-is.
   * Use absolute path (`path.join(__dirname, relative_path)`) if necessary.
   *
   * If omitted, the path is resolved by `cargo metadata`.
   */
  inputWasmPath?: string
  watchInputWasm?: boolean
}
