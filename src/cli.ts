import { resolveConfig } from "vite"
import { WasmManager } from "./manager"
import { parseArgs } from "node:util"

const PLUGIN_NAME = "rs-wasm-bindgen"

async function main() {
  let options
  try {
    options = getCommandOptions()
  } catch (error) {
    displayHelp()
    process.exit(1)
  }

  if (options.help) {
    displayHelp()
    process.exit(0)
  }

  const config = await resolveConfig({}, options.command, options.mode)
  if (!config) {
    console.error(`failed in resolving vite config`)
    process.exit(1)
  }

  const plugin = config.plugins.find((plugin) => plugin.name == PLUGIN_NAME)
  if (!plugin) {
    console.error(`plugin "'${PLUGIN_NAME}'" is missing`)
    process.exit(1)
  }

  const manager = plugin.api as WasmManager
  manager.applyConfig(config)
  await manager.buildModules(true)
}

function displayHelp() {
  console.error(`vite-rs-wasm-bindgen [options]

Options
  --help/-h           show help
  --build/-b          use 'build' command instead of 'serve'
  --mode/-m <mode>    execution mode
                      The default value is
                      'development' (if command is 'serve') or
                      'production' (if command is 'build')
`)
}

function getCommandOptions(): {
  help: boolean
  command: "serve" | "build"
  mode: string
} {
  const { values } = parseArgs({
    options: {
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
      build: {
        type: "boolean",
        short: "b",
        default: false,
      },
      mode: {
        type: "string",
        short: "m",
      },
    },
  })

  return {
    help: values.help,
    command: values.build ? "build" : "serve",
    mode: values.mode ?? (values.build ? "production" : "development"),
  }
}

main()
