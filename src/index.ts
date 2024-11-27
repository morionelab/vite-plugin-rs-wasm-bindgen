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

    resolveId(source, _importer, _options) {
      if (wasmManager.isInitHelperId(source)) {
        return source
      } else {
        return null
      }
    },

    async load(id) {
      if (wasmManager.isInitHelperId(id)) {
        return wasmManager.loadInitHelper()
      } else if (wasmManager.isTargetBgWasmId(id)) {
        this.addWatchFile(id)
        return wasmManager.loadTargetBgWasm(id)
      } else {
        return null
      }
    },

    transform(code, id) {
      if (wasmManager.isTargetJsId(id)) {
        return wasmManager.transformTargetJs(code, id)
      } else {
        return null
      }
    },

    async watchChange(id, change) {
      if (/\.wasm$/i.test(id) && change.event != "delete") {
        await wasmManager.handleWasmChange(id)
      }
    },
  }
}
