import type { Plugin } from "vite"

import type { Options } from "./options"
import { WasmManager } from "./manager"

const PLUGIN_NAME = "rs-wasm-bindgen"

export default function rsWasmBindgen(options?: Options): Plugin {
  const wasmManager = new WasmManager(options ?? {})

  return {
    name: PLUGIN_NAME,
    configResolved(config) {
      wasmManager.applyConfig(config)
    },

    async buildStart(_inputOptions) {
      await wasmManager.buildAll()

      for (const watchWasmDir of wasmManager.listWatchWasmDir()) {
        this.addWatchFile(watchWasmDir)
      }
    },

    async load(id) {
      if (!wasmManager.isTargetWasmId(id)) {
        return null
      }

      this.addWatchFile(id)

      return wasmManager.loadWasmAsProxyCode(id)
    },

    async watchChange(id, change) {
      if (/\.wasm$/i.test(id) && change.event != "delete") {
        await wasmManager.handleWasmChange(id)
      }
    },
  }
}
