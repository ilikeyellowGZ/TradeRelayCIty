import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const directory = dirname(fileURLToPath(import.meta.url))
const svg = await readFile(join(directory, 'assets', 'TradeRelayCity.svg'), 'utf8')
const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = sizes.map((size) => Buffer.from(new Resvg(svg, {
  fitTo: { mode: 'width', value: size },
}).render().asPng()))

const header = Buffer.alloc(6 + sizes.length * 16)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
sizes.forEach((size, index) => {
  const entry = 6 + index * 16
  header[entry] = size === 256 ? 0 : size
  header[entry + 1] = size === 256 ? 0 : size
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(images[index].length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += images[index].length
})

const output = join(directory, 'assets', 'TradeRelayCity.ico')
await writeFile(output, Buffer.concat([header, ...images]))
process.stdout.write(`Generated ${output}\n`)
