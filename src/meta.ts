import * as path from "node:path";

import { WasmMetaOptions } from "./options";

export type WasmMeta = {
  rawId: string;
  manifestPath: null | string;
  inputWasmPath: null | string;
  skipBuild: boolean;
  buildProfile: null | string;
  skipBindgen: boolean;
  bindgenDir: string;
  bindgenName: string;
};

export function createWasmMetaFromOptions(
  root: string,
  id: string,
  options: WasmMetaOptions
): WasmMeta {
  const rawId = id;

  if (typeof options === "string") {
    options = { manifestPath: options };
  }

  const bindgenPath = path.join(root, id);

  const bindgenDir = path.dirname(bindgenPath);
  const bindgenName = path.basename(bindgenPath);
  const bindgenOutputPath = path.join();

  const skipBuild = options.skipBuild ?? false;
  const manifestPath = options.manifestPath ?? null;
  const buildProfile = options.buildProfile ?? null;

  const skipBindgen = options.skipBindgen ?? false;
  const inputWasmPath = options.inputWasmPath ?? null;

  return {
    rawId,
    manifestPath,
    inputWasmPath,
    skipBuild,
    buildProfile,
    skipBindgen,
    bindgenDir,
    bindgenName,
  };
}
