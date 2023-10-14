import type { Plugin } from "vite";

import type { Options } from "./options";
import { WasmManager } from "./manager";

const PLUGIN_NAME = "rs-wasm-bindgen";

export default function rsWasmBindgen(options?: Options): Plugin {
  const wasmManager = new WasmManager(options ?? {});

  return {
    name: PLUGIN_NAME,
    wasmManager,

    configResolved(config) {
      wasmManager.applyConfig(config);
    },

    async buildStart(_inputOptions) {
      return wasmManager.buildAll();
    },

    async load(id: string) {
      if (!/\.wasm$/i.test(id)) {
        return null;
      }

      this.addWatchFile(id);

      return wasmManager.loadWasmAsProxyCode(id);
    },
  } as Plugin;
}
