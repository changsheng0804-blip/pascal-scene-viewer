import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public/content/v1')
const provenance = JSON.parse(readFileSync(resolve(contentDir, 'provenance.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(resolve(contentDir, 'manifest.json'), 'utf8'))

if (provenance.publicationDecision !== 'user-confirmed-public') {
  console.error('check-provenance failed: publication decision is not user-confirmed-public')
  process.exit(1)
}
if (!Array.isArray(provenance.assets) || provenance.assets.length !== manifest.assets.length) {
  console.error('check-provenance failed: asset provenance count mismatch')
  process.exit(1)
}
for (const asset of provenance.assets) {
  if (asset.publicationPermission !== 'user-confirmed') {
    console.error(`check-provenance failed: ${asset.assetId} not user-confirmed`)
    process.exit(1)
  }
}

console.log(`check-provenance ok: ${provenance.assets.length} assets user-confirmed for publication`)
