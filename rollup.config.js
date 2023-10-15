import ts from "rollup-plugin-ts";

const NODE_SHEBANG = "#!/usr/bin/env node";

export default [
    {
        input: "src/index.ts",
        output: {
            dir: "dist",
            format: "esm",
            exports: "default",
        },
        external: [
            /^node:/
        ],
        plugins: [
            ts(),
        ],
    },
    {
        input: "src/cli-wasm-bindgen.ts",
        output: {
            dir: "dist",
            format: "esm",
            exports: "none",
            banner: NODE_SHEBANG,
        },
        external: [
            /^node:/, 'vite'
        ],
        plugins: [
            ts(),
        ],
    }
];
