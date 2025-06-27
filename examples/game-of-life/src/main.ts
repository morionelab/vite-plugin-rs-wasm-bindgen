import { Universe, Cell } from "./generated/game-of-life"
import init from "./game-of-life-init"

const INTERVAL = 250 // ms

const canvas = document.querySelector("canvas")!

init().then((instance) => {
    const memory = instance.exports["memory"] as WebAssembly.Memory
    // or
    // import { memory } from "./generated/life-of-game_bg.wasm"

    // items imported from the generated (wasm-bindgen) module can not be used
    // until the init promise is resolved.
    const universe = Universe.new()

    setInterval(() => {
        const PADDING = 10
        const SIZE = 20
        const ALIVE = "#333"
        const DEAD = "#ccc"

        const width = universe.width()
        const height = universe.height()
        const cellsPtr = universe.cells()
        const cells = new Uint8Array(memory.buffer, cellsPtr, width * height)

        // draw canvas
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#fff"
        ctx.fillRect(0, 0, 2 * PADDING + width * SIZE, 2 * PADDING + height * SIZE)

        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const index = row * width + col
                ctx.fillStyle = cells[index] == Cell.Alive ? ALIVE : DEAD

                const x = PADDING + col * SIZE
                const y = PADDING + row * SIZE
                const w = SIZE - 1
                const h = SIZE - 1
                ctx.fillRect(x, y, w, h)
            }
        }

        // update universe
        universe.tick()
    }, INTERVAL)
})

