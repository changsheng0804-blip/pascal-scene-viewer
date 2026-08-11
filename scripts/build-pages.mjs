import { build } from 'vite'
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = resolve(repoRoot, 'public')
const contentDir = resolve(publicRoot, 'content/v1')
const tmpOut = resolve(repoRoot, '.build-tmp')
const outDir = resolve(repoRoot, '.pages-build')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

// Windows-safe recursive copy: remove existing dest first, then copy.
function copyTree(src, dest) {
  rmSync(dest, { recursive: true, force: true })
  const stat = statSync(src)
  if (stat.isFile()) {
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(src, dest)
    return
  }
  mkdirSync(dest, { recursive: true })
  for (const name of readdirSync(src)) {
    copyTree(join(src, name), join(dest, name))
  }
}

function copyFileInto(destFile, srcFile) {
  mkdirSync(dirname(destFile), { recursive: true })
  rmSync(destFile, { force: true })
  copyFileSync(srcFile, destFile)
}

const manifest = readJson(resolve(contentDir, 'manifest.json'))
const provenance = readJson(resolve(contentDir, 'provenance.json'))
const graph = readJson(resolve(contentDir, 'graph.json'))
const nodeCount = Object.keys(graph.nodes || {}).length
if (nodeCount !== 80) throw new Error(`graph.json node count ${nodeCount}, expected 80`)
if (!manifest.assets || manifest.assets.length !== 16) {
  throw new Error(`manifest has ${manifest.assets?.length} assets, expected 16`)
}
if (!provenance.assets.every((a) => a.publicationPermission === 'user-confirmed')) {
  throw new Error('provenance gate failed')
}

rmSync(tmpOut, { recursive: true, force: true })
rmSync(outDir, { recursive: true, force: true })
await build({ root: repoRoot, base: './', build: { outDir: tmpOut, emptyOutDir: true } })

const versions = ['viewer/v1', 'viewer/latest']

for (const rel of versions) {
  const pageDir = resolve(outDir, rel)
  mkdirSync(pageDir, { recursive: true })

  // Complete app shell (index.html + hashed bundle assets).
  copyFileInto(resolve(pageDir, 'index.html'), resolve(tmpOut, 'index.html'))
  copyTree(resolve(tmpOut, 'assets'), resolve(pageDir, 'assets'))

  // Version content at <page>/content/v1 so BASE_URL './' resolves.
  const dst = resolve(pageDir, 'content/v1')
  mkdirSync(dst, { recursive: true })
  copyFileInto(resolve(dst, 'graph.json'), resolve(contentDir, 'graph.json'))
  copyFileInto(resolve(dst, 'manifest.json'), resolve(contentDir, 'manifest.json'))
  copyFileInto(resolve(dst, 'provenance.json'), resolve(contentDir, 'provenance.json'))
  copyTree(resolve(contentDir, 'assets'), resolve(dst, 'assets'))
  copyTree(resolve(contentDir, 'decoder'), resolve(dst, 'decoder'))
}

// Floorplans entry: same v1 app, plan camera via ?view=plan.
const planDir = resolve(outDir, 'viewer/v1/floorplans')
mkdirSync(planDir, { recursive: true })
copyFileInto(resolve(planDir, 'index.html'), resolve(tmpOut, 'index.html'))
copyTree(resolve(tmpOut, 'assets'), resolve(planDir, 'assets'))
const planDst = resolve(planDir, 'content/v1')
mkdirSync(planDst, { recursive: true })
copyFileInto(resolve(planDst, 'graph.json'), resolve(contentDir, 'graph.json'))
copyFileInto(resolve(planDst, 'manifest.json'), resolve(contentDir, 'manifest.json'))
copyFileInto(resolve(planDst, 'provenance.json'), resolve(contentDir, 'provenance.json'))
copyTree(resolve(contentDir, 'assets'), resolve(planDst, 'assets'))
copyTree(resolve(contentDir, 'decoder'), resolve(planDst, 'decoder'))
// Mark the plan page with the plan query parameter so the app starts top-down.
{
  const planHtml = readFileSync(resolve(planDir, 'index.html'), 'utf8')
    .replace('</body>', '<script>history.replaceState(null, "", "?view=plan")</script></body>')
  writeFileSync(resolve(planDir, 'index.html'), planHtml)
}

// Root convenience redirects.
for (const rel of ['index.html', 'viewer/index.html']) {
  const dst = resolve(outDir, rel)
  mkdirSync(dirname(dst), { recursive: true })
  rmSync(dst, { force: true })
  writeFileSync(
    dst,
    '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./viewer/v1/"></head><body><a href="./viewer/v1/">打开 Viewer v1</a></body></html>',
  )
}

rmSync(tmpOut, { recursive: true, force: true })

const sizes = {}
for (const rel of versions) {
  sizes[rel] = dirSizeKiB(resolve(outDir, rel))
}
console.log(`pages build complete: ${outDir}`)
console.log(JSON.stringify({ versions, sizes }, null, 2))

function dirSizeKiB(dir) {
  let total = 0
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const name of readdirSync(current)) {
      const full = join(current, name)
      const stat = statSync(full)
      if (stat.isDirectory()) stack.push(full)
      else total += stat.size
    }
  }
  return Math.round((total / 1024) * 10) / 10 + ' KiB'
}
