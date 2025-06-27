#!/usr/bin/env node
import { resolveConfig } from 'vite';
import { parseArgs } from 'node:util';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const PLUGIN_NAME = "rs-wasm-bindgen";
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let options;
        try {
            options = getCommandOptions();
        }
        catch (error) {
            displayHelp();
            process.exit(1);
        }
        if (options.help) {
            displayHelp();
            process.exit(0);
        }
        const config = yield resolveConfig({}, options.command, options.mode);
        if (!config) {
            console.error(`failed in resolving vite config`);
            process.exit(1);
        }
        const plugin = config.plugins.find((plugin) => plugin.name == PLUGIN_NAME);
        if (!plugin) {
            console.error(`plugin "'${PLUGIN_NAME}'" is missing`);
            process.exit(1);
        }
        const manager = plugin.api;
        manager.applyConfig(config);
        yield manager.buildModules(true);
    });
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
`);
}
function getCommandOptions() {
    var _a;
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
    });
    return {
        help: values.help,
        command: values.build ? "build" : "serve",
        mode: (_a = values.mode) !== null && _a !== void 0 ? _a : (values.build ? "production" : "development"),
    };
}
main();
