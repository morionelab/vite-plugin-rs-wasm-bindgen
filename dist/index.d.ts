import { Plugin } from 'vite';

type Options = {
    /**
     * If true, info log is displayed.
     * Useful to see the failed command.
     */
    verbose?: boolean;
    /**
     * If true, the stderr of subprocess (e.g. `cargo build`) is redirected.
     */
    redirectStderr?: boolean;
    /**
     * If true, `cargo build` uses the profile *debug*;
     * otherwise it uses the profile *release*.
     */
    useDebugBuild?: boolean;
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
    targets?: Record<string, string | TargetOptions>;
};
type TargetOptions = {
    /**
     * If true, `cargo build` and `wasm-bindgen` for this target is skipped
     * assuming the necessary files are already generated at the expected path.
     */
    skipBindgen?: boolean;
    /**
     * If true, `cargo build` for this target is skipped
     * assuming the necessary files are already built.
     */
    skipBuild?: boolean;
    /**
     * Path to the `Cargo.toml` of the wasm source.
     *
     * This field is required unless `skipBindgen` or `skipBuild` is true.
     *
     * Non-absolute path is resolved from the project root.
     */
    manifestPath?: string;
    /**
     * Target-specific `useDebugBuild` setting.
     * If omitted, the top-level setting is applied.
     */
    useDebugBuild?: boolean;
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
    rawWasmPath?: string;
    noWatchRawWasm?: boolean;
};

declare function rsWasmBindgen(options?: Options): Plugin;

export { rsWasmBindgen as default };
