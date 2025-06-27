import typescript from "@rollup/plugin-typescript"
import dts from "rollup-plugin-dts"

const NODE_SHEBANG = "#!/usr/bin/env node"

export default [
  {
    input: "src/index.ts",
    output: {
      dir: "dist",
      format: "esm",
    },
    external: [/^node:/, "vite"],
    plugins: [typescript()],
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "esm",
    },
    plugins: [dts()],
  },
  {
    input: "src/cli.ts",
    output: {
      dir: "dist/bin",
      format: "esm",
      banner: NODE_SHEBANG,
    },
    external: [/^node:/, "vite"],
    plugins: [
      typescript({
        outDir: "dist/bin",
      }),
    ],
  },
]
