# `vite-plugin-rs-wasm-bindgen` Options

This plugin takes an object of the following `Options` type.
The field `modules` is mandatory to specify the modules to be processed;
the plugin does nothing if `modules` is empty or missing. 

```typescript
type Options = {
    modules?: Record<string, ModuleOptions>;
    verbose?: boolean;
    redirectStderr?: boolean;

    // common fields
    skipBindgen?: boolean | "auto";
    skipBuild?: boolean | "auto";
    useDebugBuild?: boolean;
    useAwait?: boolean;
    watchRawWasm?: boolean;
};

type ModuleOptions = string |
{
    manifestPath?: string;
    rawWasmPath?: string;

    // common fields
    skipBindgen?: boolean | "auto";
    skipBuild?: boolean | "auto";
    useDebugBuild?: boolean;
    useAwait?: boolean;
    watchRawWasm?: boolean;
};
```

## `Options` Fields

### `modules`

Type: `Record<string, ModuleOptions>`

An object to specify modules to be generated and bundled.

Each key specifies the module path where `wasm-bindgen` outputs the binding modules
and the value specifies the source of wasm (usually the path of `Cargo.toml`).
If `modules` is empty or missing, this plugin does nothing.

The key is finally passed to `--out-dir` and `--out-name` of `wasm-bindgen` options;
the non-absolute path is resolved from the project root and splitted into the
`dirname` and `basename`. The key should not include the file extension.

For example the key `"src/generated/app-wasm"` will output:
- `${root}/src/generated/app-wasm.js`
- `${root}/src/generated/app-wasm_bg.js`
- `${root}/src/generated/app-wasm_bg.wasm`
- and some `.d.ts` files

The value specifies the source of wasm file to be passed to `wasm-bindgen`,
which is either a string value or an object of `ModuleOptions`.
The string value is equivalent to the object `{ manifestPath: value }`.


### `verbose`

Type: `boolean`

Displays shell commands executed behind.


### `redirectStderr`

Type: `boolean`

Redirects stderr of the executed shell commands (e.g., `cargo build`).


## `ModuleOptions` Fields

### `manifestPath`

Type: `string`

The path of `Cargo.toml` to build the raw wasm.

The non-absolute path is resolved from the project root.

This field is required unless either
- `skipBindgen` is true, or
- `skipBuild` is true and `rawWasmPath` is specified,


### `rawWasmPath`

Type: `string`

The path of the raw wasm file (input of `wasm-bindgen`, output of `cargo build`).
If not specified, the path is resolved using `cargo metadata`.

The non-absolute path is resolved from the project root.

This field is required if `skipBindgen` is not true and `manifestPath` is not specified.


## Common Fields

These fields in `Options` is applied to all entries in modules
unless overwritten by`ModuleOptions`.


### skipBindgen

Type: `boolean | "auto"` 

If set to true, the executions of `cargo build` and `wasm-bindgen` are skipped
assuming the module files are already generated.

If set to `"auto"`, the executions are skipped unless requested by the plugin CLI
`vite-rs-wasm-bindgen`.


### skipBuild

Type: `boolean | "auto"` 

If set to true, the execution of `cargo build` is skipped
assuming the raw wasm file is already generated.

If set to `"auto"`, the execution is skipped unless requested by the plugin CLI
`vite-rs-wasm-bindgen`.


### useDebugBuild

Type: `boolean`

If set to true, the raw wasm file is built for `debug` profile (without `--release`).

By default (`undefined` or `false`), it is built with `--release`. 


## useAwait

Type: `boolean`

If set to true, the wasm file is imported using the *top-level await* internally.

By default (`undefined` or `false`), the exported items of the wasm module are
available only after the **init-promise** is resolved, where the *init-promise*
is returned from the default export of `{wasm-module}?init`.


## watchRawWasm

Type: `boolean`

If set to true, changes on the raw wasm file trigger the `wasm-bindgen` execution.

