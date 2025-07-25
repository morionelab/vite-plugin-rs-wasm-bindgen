import { Plugin } from 'vite';

type Options = {
    /**
     * An object to specify modules to be generated and bundled.
     *
     * Each key specifies a module path where `wasm-bindgen` output goes and the value
     * specifies the input wasm source (typically the path of `Cargo.toml`).
     * The plugin does nothing if `modules` is empty or missing.
     *
     * The key is resolved from the project root (if non-absolute), splitted to
     * dirname and basename, then passed to `wasm-bindgen` options `--out-dir` and `--out-name`.
     *
     * For example the key `"src/generated/app-wasm"` will output:
     * - `${root}/src/generated/app-wasm.js`
     * - `${root}/src/generated/app-wasm_bg.js`
     * - `${root}/src/generated/app-wasm_bg.wasm`
     *
     * Usually the key should not include extensions.
     *
     * The value specifies the input wasm source as a string value or an object of
     * `ModuleOptions`. The string value is equivalent to `{ manifestPath: value }`.
     */
    modules?: Record<string, ModuleOptions>;
    /**
     * If set to true,
     * displays shell commands executed behind.
     */
    verbose?: boolean;
    /**
     * If set to true,
     * redirects stderr of the executed shell commands (e.g., `cargo build`).
     */
    redirectStderr?: boolean;
    /**
     * If set to true,
     * the executions of `cargo build` and `wasm-bindgen` are skipped
     * assuming the module files are already generated.
     *
     * If set to `"auto"`,
     * the executions are skipped unless requested by the plugin CLI
     * `vite-rs-wasm-bindgen`.
     */
    skipBindgen?: boolean | "auto";
    /**
     * If set to true,
     * the execution of `cargo build` is skipped
     * assuming the raw wasm file is already generated.
     *
     * If set to 'auto',
     * the execution is skipped unless requested by the plugin CLI
     * `vite-rs-wasm-bindgen`.
     */
    skipBuild?: boolean | "auto";
    /**
     * If set to true,
     * the raw wasm file is built for `debug` profile (without `--release`).
     */
    useDebugBuild?: boolean;
    /**
     * If set to true,
     * the wasm file is imported using the *top-level-await* internally.
     */
    useAwait?: boolean;
    /**
     * If set to true,
     * changes on the raw wasm file trigger the `wasm-bindgen` execution.
     */
    watchRawWasm?: boolean;
};
type ModuleOptions = string | {
    /**
     * The path of `Cargo.toml` to build the raw wasm.
     *
     * The non-absolute path is resolved from the project root.
     *
     * This field is required unless either
     * - `skipBindgen` is true, or
     * - `skipBuild` is true and `rawWasmPath` is specified,
     */
    manifestPath?: string;
    /**
     * The path of the raw wasm file (input of `wasm-bindgen`, output of `cargo build`).
     * If not specified, the path is resolved using `cargo metadata`.
     *
     * The non-absolute path is resolved from the project root.
     *
     * This field is required if `skipBindgen` is not true and `manifestPath` is not specified.
     */
    rawWasmPath?: string;
    /**
     * If set to true,
     * the executions of `cargo build` and `wasm-bindgen` are skipped
     * assuming the module files are already generated.
     *
     * If set to `"auto"`,
     * the executions are skipped unless requested by the plugin CLI
     * `vite-rs-wasm-bindgen`.
     */
    skipBindgen?: boolean | "auto";
    /**
     * If set to true,
     * the execution of `cargo build` is skipped
     * assuming the raw wasm file is already generated.
     *
     * If set to 'auto',
     * the execution is skipped unless requested by the plugin CLI
     * `vite-rs-wasm-bindgen`.
     */
    skipBuild?: boolean | "auto";
    /**
     * If set to true,
     * the raw wasm file is built for `debug` profile (without `--release`).
     */
    useDebugBuild?: boolean;
    /**
     * If set to true,
     * the wasm file is imported using the *top-level-await* internally.
     */
    useAwait?: boolean;
    /**
     * If set to true,
     * changes on the raw wasm file trigger the `wasm-bindgen` execution.
     */
    watchRawWasm?: boolean;
};

declare function rsWasmBindgen(options?: Options): Plugin;

export { rsWasmBindgen as default };
