import path from "node:path"
import { promisify } from "node:util"
import { execFile } from "node:child_process"
import { Logger } from "vite"

//
// cargo build
//
type CargoBuildWasmArgs = {
  key: string
  skipBuild: boolean
  manifestPath: null | string
  profile: string
  ignoreError: boolean
  logger: Logger
  verbose: boolean
  suppressError: boolean
}

export async function execCargoBuildWasm(
  args: CargoBuildWasmArgs,
): Promise<boolean> {
  const key = args.key
  const skipBuild = args.skipBuild
  const manifestPath = args.manifestPath
  const profile = args.profile
  const ignoreError = args.ignoreError
  const logger = args.logger
  const verbose = args.verbose
  const suppressError = args.suppressError

  let skipReason: null | string = null

  if (skipBuild) {
    skipReason = "skipBuild"
  } else if (manifestPath === null) {
    skipReason = "no manifestPath"
  }

  if (skipReason !== null) {
    if (verbose) {
      logger.info(`skip building source wasm of ${key} (${skipReason})`)
    }
    return true
  }

  const command = "cargo"
  const commandArgs: Array<string> = []

  commandArgs.push("build", "--lib")
  commandArgs.push("--manifest-path", manifestPath!)
  commandArgs.push("--target", "wasm32-unknown-unknown")

  if (profile == "release") {
    commandArgs.push("--release")
  } else if (profile != "dev") {
    commandArgs.push("--profile")
    commandArgs.push(profile)
  }

  try {
    if (verbose) {
      const joinedArgs = commandArgs.join(" ")
      logger.info(
        `building source wasm of ${key}: ${command} ${joinedArgs}`,
      )
    }
    await promisify(execFile)(command, commandArgs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const ignored = ignoreError ? " (ignored)" : ""
    logger.error(`building source wasm of ${key} failed${ignored}`)

    if (!suppressError) {
      process.stderr.write(error.stderr)
    }
    return ignoreError
  }

  return true
}

//
// cargo metadata
//
type CargoMetadataArgs = {
  key: string
  skipBindgen: boolean
  manifestPath: null | string
  crateName: null | string
  profile: string
  logger: Logger
  verbose: boolean
}

export async function execCargoMetadata(
  args: CargoMetadataArgs,
): Promise<null | string> {
  const key = args.key
  const skipBindgen = args.skipBindgen
  const manifestPath = args.manifestPath
  const givenCrateName = args.crateName
  const profile = args.profile
  const logger = args.logger
  const verbose = args.verbose

  let skipReason: null | string = null

  if (skipBindgen) {
    skipReason = "skipBindgen"
  } else if (manifestPath === null) {
    skipReason = "no manifestPath"
  }

  if (skipReason !== null) {
    if (verbose) {
      console.info(`skip locating source wasm of ${key} (${skipReason})`)
    }
    return null
  }

  const command = "cargo"
  const commandArgs: Array<string> = []
  commandArgs.push("metadata", "--no-deps")
  commandArgs.push("--manifest-path", manifestPath!)
  commandArgs.push("--format-version", "1")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let metadata: any = null
  try {
    if (verbose) {
      console.info(`resloving input wasm of ${key}`)
    }
    const { stdout } = await promisify(execFile)(command, commandArgs)
    metadata = JSON.parse(stdout)
  } catch (error) {
    logger.error(`reading cargo metadata of ${key} failed`)
    return null
  }

  const targetDirectory = metadata["target_directory"] as string
  const packages = metadata["packages"]
  let mainCrateName: null | string = null
  for (const package_ of packages) {
    if (package_["manifest_path"] === manifestPath) {
      mainCrateName = package_["name"]
    }
  }

  const crateName = givenCrateName ?? mainCrateName

  if (targetDirectory === null) {
    logger.error(`target directory of ${key} is missing`)
    return null
  } else if (crateName === null) {
    logger.error(
      `failed in resolving package name of ${key} (explicit crateName is required)`,
    )
    return null
  }

  let profileDirectory: string
  if (profile == "dev" || profile == "test") {
    profileDirectory = "debug"
  } else if (profile == "bench") {
    profileDirectory = "release"
  } else {
    // as-is (including release)
    profileDirectory = profile
  }

  const inputWasmPath = path.join(
    targetDirectory,
    "wasm32-unknown-unknown",
    profileDirectory,
    crateName.replace(/-/g, "_") + ".wasm",
  )

  if (verbose) {
    logger.info(` => ${inputWasmPath}`)
  }
  return inputWasmPath
}

//
// wasm-bindgen
//
type WasmBindgenArgs = {
  key: string
  skipBindgen: boolean
  inputWasmPath: string
  outputDir: string
  outputName: string
  logger: Logger
  verbose: boolean
}

export async function execWasmBindgen(args: WasmBindgenArgs): Promise<boolean> {
  const key = args.key
  const skipBindgen = args.skipBindgen
  const inputWasmPath = args.inputWasmPath
  const outputDir = args.outputDir
  const outputName = args.outputName
  const logger = args.logger
  const verbose = args.verbose

  let skipReason: null | string = null

  if (skipBindgen) {
    skipReason = "skipBindgen"
  }

  if (skipReason !== null) {
    if (verbose) {
      logger.info(`skip wasm-bindgen of ${key} (${skipReason})`)
    }
    return true
  }

  const command = "wasm-bindgen"
  const commandArgs: Array<string> = []

  commandArgs.push("--out-dir", outputDir)
  commandArgs.push("--out-name", outputName)
  commandArgs.push("--target", "bundler")
  commandArgs.push(inputWasmPath)

  try {
    if (verbose) {
      const joinedArgs = commandArgs.join(" ")
      logger.info(`bindgen ${key}: ${command} ${joinedArgs}`)
    }
    await promisify(execFile)(command, commandArgs)
  } catch (error) {
    logger.error(`bindgen ${key} failed`)
    return false
  }

  return true
}
