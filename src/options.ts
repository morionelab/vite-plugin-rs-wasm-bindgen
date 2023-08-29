export type Options = {
  verbose?: boolean;
  syncImport?: boolean;
  wasmMeta?: Record<string, WasmMetaOptions>;
};

export type WasmMetaOptions =
  | string
  | {
    manifestPath?: string;
    skipBuild?: boolean;
    buildProfile?: string;
    skipBindgen?: boolean;
    inputWasmPath?: string;
  };
