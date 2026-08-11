import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const decoderPath = `${import.meta.env.BASE_URL}content/v1/decoder/draco/`

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath(decoderPath)
dracoLoader.setDecoderConfig({ type: 'wasm' })
dracoLoader.preload()

const loader = new GLTFLoader()
loader.setDRACOLoader(dracoLoader)

export function resolveAssetUrl(src) {
  // graph.json stores rewritten relative paths like ./assets/<hash>.glb
  if (src.startsWith('./') || src.startsWith('../') || src.startsWith('/')) {
    return `${import.meta.env.BASE_URL}content/v1/${src.replace(/^\.?\//, '')}`
  }
  return src
}

export async function loadGraph() {
  const base = `${import.meta.env.BASE_URL}content/v1/`
  const [graphRes, manifestRes, provenanceRes] = await Promise.all([
    fetch(`${base}graph.json`),
    fetch(`${base}manifest.json`),
    fetch(`${base}provenance.json`),
  ])
  if (!graphRes.ok || !manifestRes.ok || !provenanceRes.ok) {
    throw new Error('内容资源加载失败（graph/manifest/provenance）')
  }
  const graph = await graphRes.json()
  const manifest = await manifestRes.json()
  const provenance = await provenanceRes.json()
  return { graph, manifest, provenance }
}

export async function loadAssets(graph, onProgress) {
  const srcs = new Set()
  for (const node of Object.values(graph.nodes || {})) {
    if (node.type === 'item' && node.asset?.src) srcs.add(node.asset.src)
  }
  const urls = [...srcs]
  const cache = new Map()
  const total = urls.length
  let loaded = 0
  await Promise.all(
    urls.map(async (src) => {
      const url = resolveAssetUrl(src)
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, (err) => reject(new Error(`加载失败: ${url} — ${err?.message || err}`)))
      })
      cache.set(src, gltf)
      loaded += 1
      if (onProgress) onProgress(loaded, total)
    }),
  )
  return cache
}
