import { Plugin } from 'vite';
type Options = {
    verbose?: boolean;
    suppressError?: boolean;
    syncImport?: boolean;
    targets?: Record<string, TargetOptions>;
};
type TargetOptions = string | {
    manifestPath?: string;
    skipBuild?: boolean;
    buildProfile?: string;
    ignoreBuildError?: boolean;
    crateName?: string;
    skipBindgen?: boolean;
    inputWasmPath?: string;
    watchInputWasm?: boolean;
};
declare function rsWasmBindgen(options?: Options): Plugin;
export { rsWasmBindgen as default };
