import type { Plugin } from "vite";

import type { Options } from "./options";
import { execCargoBuildWasm, execCargoMetadata, execWasmBindgen } from "./cmds";
import { WasmMeta, createWasmMetaFromOptions } from "./meta";
import { WasmData } from "./wasmlib";

const PLUGIN_NAME = "rs-wasm-bindgen";

export default function rsWasmBindgen(options?: Options): Plugin {
  options = options ?? {};

  let verbose = options.verbose ?? false;
  let syncImport = options.syncImport ?? false;
  let wasmMetaOptionsMap = options.wasmMeta ?? {};

  let root: null | string = null;
  let release = false;
  let wasmMetaList: Array<WasmMeta> = [];

  return {
    name: PLUGIN_NAME,

    configResolved(config) {
      console.log(config.configFile);
      root = config.root;
      release = config.isProduction;

      for (let id in wasmMetaOptionsMap) {
        const wasmMetaOptions = wasmMetaOptionsMap[id];
        const wasmMeta = createWasmMetaFromOptions(root, id, wasmMetaOptions);
        wasmMetaList.push(wasmMeta);
      }
    },

    async buildStart(_inputOptions) {
      let context = this;
      let opts = { verbose, release };

      for (let wasmMeta of wasmMetaList) {
        await execCargoBuildWasm(context, wasmMeta, opts);
        await execCargoMetadata(context, wasmMeta, opts);
        await execWasmBindgen(context, wasmMeta, opts);
      }
    },

    async load(id: string) {
      if (!/\.wasm$/i.test(id)) {
        return null;
      }

      const wasmData = await WasmData.create(id);
      return wasmData.generateProxyCode(syncImport);
    },
  };
}
