export type Options = {
  verbose?: boolean;
  suppressError?: boolean;
  syncImport?: boolean;
  targets?: Record<string, TargetOptions>;
};

export type TargetOptions =
  | string
  | {
      manifestPath?: string;
      skipBuild?: boolean;
      buildProfile?: string;
      ignoreBuildError?: boolean;
      crateName?: string;
      skipBindgen?: boolean;
      inputWasmPath?: string;
      watchInputWasm?: boolean;
    };
