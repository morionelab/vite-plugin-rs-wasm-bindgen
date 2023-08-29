import ts from "rollup-plugin-ts";

export default {
    input: "src/index.ts",
    output: {
        dir: "dist",
        format: "esm",
        exports: "default",
    },
    external: [
        /^node:/,
    ],
    plugins: [
        ts(),
    ],
}
