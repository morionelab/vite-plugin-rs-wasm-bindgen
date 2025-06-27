# Examples of `vite-plugin-rs-wasm-bindgen`

## Contents

Some code of the Conway's game of life is borrowed from
[Rust and WebAssembly tutorial](https://github.com/rustwasm/wasm_game_of_life)

### wasm-src

A Rust project to build the wasm file of game-of-life, shared by other examples.

This directory is expected to be put beside the `game-of-life` or `game-of-life-use-await` directories
as its `Cargo.toml` is referred to by the relative path in `vite.config.js`.

### game-of-life

A simple example of the Conway's game of life.

### game-of-life-use-await

Another example of the Conway's game of life which uses the `useAwait` option (*top-level await*).


## Preparation

### Fix wasm-src/Cargo.toml

The `wasm-bindgen` version in `wasm-src/Cargo.toml` dependencies must match
to `wasm-bindgen --version`. Fix the file according to your environment or
update `wasm-bindgen-cli` to the latest version.

```diff
 [dependencies]
-wasm-bindgen = "*"
+wasm-bindgen = "0.2.100"  # fix according to your environment
```

### Fix package.json

The dependency of `"vite-plugin-rs-wasm-bindgen"` in `package.json` uses
relative path by default.
If you put the examples outside the cloned repository, fix its path
to some repository.

```diff
   "devDependencies": {
     "vite": "^6",
-    "vite-plugin-rs-wasm-bindgen": "file://../.."
+    "vite-plugin-rs-wasm-bindgen": "morionelab/vite-plugin-rs-wasm-bindgen"
   },
```

### Run `npm install`

Run `npm install` in the example directory.

If you leave the dependency of `vite-plugin-rs-wasm-bindgen` unchanged (relative path),
run `npm install` in the package directory too.
