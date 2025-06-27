import type { Plugin } from "vite"

import type { Options } from "./options"
import { WasmManager } from "./manager"

const PLUGIN_NAME = "rs-wasm-bindgen"

export default function rsWasmBindgen(options?: Options): Plugin {
  const manager = new WasmManager(options ?? {})

  return {
    name: PLUGIN_NAME,
    api: manager,

    configResolved(config) {
      manager.applyConfig(config)
    },

    async buildStart(_inputOptions) {
      await manager.buildModules(false)

      for (const watchWasmDir of manager.listWatchWasmDir()) {
        this.addWatchFile(watchWasmDir)
      }
    },

    resolveId(source, _importer, _options) {
      if (manager.isInitHelperId(source)) {
        return source
      } else {
        return null
      }
    },

    async load(id) {
      if (manager.isInitHelperId(id)) {
        return manager.loadInitHelper()
      } else if (manager.isModuleBgWasmId(id)) {
        this.addWatchFile(id)
        return manager.loadModuleBgWasm(id)
      } else if (manager.isModuleJsInitId(id)) {
        return manager.loadModuleJsInit(id)
      } else {
        return null
      }
    },

    transform(code, id) {
      if (manager.isModuleJsId(id)) {
        return manager.transformModuleJs(code, id)
      } else {
        return null
      }
    },

    async watchChange(id, change) {
      if (manager.isRawWasmId(id) && change.event !== "delete") {
        await manager.handleRawWasmChange(id)
      }
    },
  }
}
