import path from "node:path";
import { defineConfig } from "vite";
import rsWasmBindgen from "vite-plugin-rs-wasm-bindgen";

const rootDir = path.resolve(__dirname);

export default defineConfig({
    plugins: [
        rsWasmBindgen({
            verbose: true,
            useAwait: true,
            modules: {
                "src/generated/game-of-life": path.join(rootDir, "..", "wasm-src", "Cargo.toml")
            }
        })
    ],
    build: {
        target: "esnext"
    },
})