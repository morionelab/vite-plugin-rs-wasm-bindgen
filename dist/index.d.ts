import { Plugin } from 'vite';

type Options = {
    verbose?: boolean;
    suppressError?: boolean;
    syncImport?: boolean;
    targets?: Record<string, TargetOptions>;
};
type TargetOptions = string | {
    /**
     * Path to the `Cargo.toml` of the wasm package.
     *
     * This path is passed to `cargo build --manifest-path` as-is.
     * Use absolute path (`path.join(__dirname, relative_path)`) if necessary.
     */
    manifestPath?: string;
    skipBuild?: boolean;
    buildProfile?: string;
    ignoreBuildError?: boolean;
    crateName?: string;
    skipBindgen?: boolean;
    /**
     * Path to the compiled wasm.
     *
     * This path is passed to `wasm-bindgen` as-is.
     * Use absolute path (`path.join(__dirname, relative_path)`) if necessary.
     *
     * If omitted, the path is resolved by `cargo metadata`.
     */
    inputWasmPath?: string;
    watchInputWasm?: boolean;
};

declare function rsWasmBindgen(options?: Options): Plugin;

export { rsWasmBindgen as default };
