import { resolveConfig } from "vite";
import { WasmManager } from "./manager";

const PLUGIN_NAME = "rs-wasm-bindgen";

async function main() {
    const command = 'serve';
    const mode = 'development';

    const config = await resolveConfig({}, command, mode);

    if (!config) {
        console.error(`failed in resolving vite config`);
        return;
    }

    const plugin = config.plugins.find((plugin) => plugin.name == PLUGIN_NAME);
    if (!plugin) {
        console.error(`plugin '${PLUGIN_NAME}' is not found`);
        return;
    }

    const wasmManager = (plugin as any).wasmManager as WasmManager;

    wasmManager.applyConfig(config);
    await wasmManager.buildAll();

    console.log(`done`);
}

main();