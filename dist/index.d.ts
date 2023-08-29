import { Plugin } from "vite";
type Options = {
    verbose?: boolean;
    syncImport?: boolean;
    wasmMeta?: Record<string, WasmMetaOptions>;
};
type WasmMetaOptions = string | {
    manifestPath?: string;
    skipBuild?: boolean;
    buildProfile?: string;
    skipBindgen?: boolean;
    inputWasmPath?: string;
};
declare function rsWasmBindgen(options?: Options): Plugin;
export { rsWasmBindgen as default };
