import * as path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { PluginContext } from "rollup";

import { WasmMeta } from "./meta";

type CommandOptions = {
  verbose: boolean;
  release: boolean;
};

export async function execCargoBuildWasm(
  context: PluginContext,
  meta: WasmMeta,
  opts: CommandOptions
) {
  let verbose = opts.verbose;

  let skipReason: null | string = null;

  if (meta.skipBuild) {
    skipReason = "skipBuild";
  } else if (meta.manifestPath === null) {
    skipReason = "no manifestPath";
  }

  if (skipReason !== null) {
    if (verbose) {
      console.info(`skip building ${meta.rawId} (${skipReason})`);
    }
    return;
  }

  let manifestPath = meta.manifestPath!;
  let release = opts.release;

  let command = "cargo";
  let args: Array<string> = [];

  args.push("build", "--lib");
  args.push("--manifest-path", manifestPath!);
  args.push("--target", "wasm32-unknown-unknown");

  if (release) {
    args.push("--release");
  }

  const joinedArgs = args.join(" ");

  try {
    if (verbose) {
      console.info(`building ${meta.rawId}: ${command} ${joinedArgs}`);
    }
    await promisify(execFile)(command, args);
  } catch (error) {
    context.warn(`building ${meta.rawId} failed: ${command} ${joinedArgs}`);
  }
}

export async function execCargoMetadata(
  context: PluginContext,
  meta: WasmMeta,
  opts: CommandOptions
) {
  let verbose = opts.verbose;

  let skipReason: null | string = null;

  if (meta.skipBindgen) {
    skipReason = "skipBindgen";
  } else if (meta.inputWasmPath !== null) {
    skipReason = "inputWasmPath is set";
  } else if (meta.manifestPath === null) {
    skipReason = "no manifestPath";
  }

  if (skipReason !== null) {
    if (verbose) {
      console.info(
        `skip resolving input wasm of ${meta.rawId} (${skipReason})`
      );
    }
    return;
  }

  let manifestPath = meta.manifestPath!;
  let release = opts.release;

  let command = "cargo";
  let args: Array<string> = [];
  args.push("metadata", "--no-deps");
  args.push("--manifest-path", manifestPath);
  args.push("--format-version", "1");

  try {
    if (verbose) {
      console.info(`resolving input wasm of ${meta.rawId}`);
    }
    let { stdout } = await promisify(execFile)(command, args);
    let metadata = JSON.parse(stdout);

    let targetDirectory = metadata["target_directory"] as string;
    let name: null | string = null;

    for (let package_ of metadata["packages"]) {
      for (let target of package_["targets"]) {
        if (target["crate_types"].includes("cdylib")) {
          if (name === null) {
            name = target["name"];
          } else {
            throw "multiple cdylib targets";
          }
        }
      }
    }

    if (name === null) {
      throw "no cdylib target";
    }

    let buildProfile: null | string = meta.buildProfile ?? null;
    if (buildProfile === null) {
      buildProfile = release ? "release" : "debug";
    }

    meta.inputWasmPath = path.join(
      targetDirectory,
      "wasm32-unknown-unknown",
      buildProfile,
      name.replace('-', '_') + ".wasm"
    );

    if (verbose) {
      console.info(
        `resolved input wasm of ${meta.rawId}: ${meta.inputWasmPath}`
      );
    }
  } catch (error) {
    context.warn(`resolving input wasm of ${meta.rawId} failed: ${error}`);
  }
}

export async function execWasmBindgen(
  context: PluginContext,
  meta: WasmMeta,
  opts: CommandOptions
) {
  let verbose = opts.verbose;

  let skipReason: null | string = null;

  if (meta.skipBindgen) {
    skipReason = "skipBindgen";
  } else if (meta.inputWasmPath === null) {
    skipReason = "no inputWasmPath";
  }

  if (skipReason !== null) {
    if (verbose) {
      console.info(`skip wasm-bindgen of ${meta.rawId} (${skipReason})`);
    }
    return;
  }

  let inputWasmPath = meta.inputWasmPath!;

  let command = "wasm-bindgen";
  let args: Array<string> = [];

  args.push("--out-dir", meta.bindgenDir);
  args.push("--out-name", meta.bindgenName);
  args.push("--target", "bundler");
  args.push(inputWasmPath);

  const joinedArgs = args.join(" ");

  try {
    if (verbose) {
      console.info(`bindgen ${meta.rawId}: ${command} ${joinedArgs}`);
    }
    await promisify(execFile)(command, args);
  } catch (error) {
    context.warn(`bindgen ${meta.rawId} failed: ${command} ${joinedArgs}`);
  }
}
