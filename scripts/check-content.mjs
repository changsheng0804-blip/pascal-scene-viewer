import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public/content/v1')
const fail = (msg) => { console.error(`check-content failed: ${msg}`); process.exit(1) }

const graph = JSON.parse(readFileSync(resolve(contentDir, 'graph.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(resolve(contentDir, 'manifest.json'), 'utf8'))
const provenance = JSON.parse(readFileSync(resolve(contentDir, 'provenance.json'), 'utf8'))

const nodes = graph.nodes || {}
if (Object.keys(nodes).length !== 80) fail(`expected 80 nodes, got ${Object.keys(nodes).length}`)

const counts = {}
for (const node of Object.values(nodes)) counts[node.type] = (counts[node.type] || 0) + 1
for (const [type, expected] of Object.entries(manifest.typeCounts || {})) {
  if (counts[type] !== expected) fail(`type ${type}: graph ${counts[type] ?? 0} vs manifest ${expected}`)
}

const referenced = new Set()
for (const node of Object.values(nodes)) {
  if (node.type === 'item' && node.asset?.src) referenced.add(node.asset.src)
}
if (referenced.size !== 16) fail(`expected 16 unique asset srcs, got ${referenced.size}`)

for (const asset of manifest.assets) {
  const path = resolve(contentDir, 'assets', asset.filename)
  if (!existsSync(path)) fail(`missing asset ${asset.filename}`)
  const buffer = readFileSync(path)
  if (buffer.length !== asset.bytes) fail(`size mismatch for ${asset.filename}`)
  const sha = createHash('sha256').update(buffer).digest('hex')
  if (sha !== asset.sha256) fail(`hash mismatch for ${asset.filename}`)
  if (!referenced.has(`./assets/${asset.filename}`)) fail(`asset ${asset.filename} not referenced by graph`)
}

for (const file of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
  const path = resolve(contentDir, 'decoder', 'draco', file)
  if (!existsSync(path) || statSync(path).size === 0) fail(`missing decoder ${file}`)
}

if (!provenance.assets.every((a) => a.publicationPermission === 'user-confirmed')) {
  fail('provenance not fully user-confirmed')
}

console.log(`check-content ok: 80 nodes, ${manifest.assets.length} assets, decoders present, provenance confirmed`)
