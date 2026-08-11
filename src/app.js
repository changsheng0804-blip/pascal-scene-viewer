import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GraphRenderer } from './graph-renderer.js'
import { ViewerControls } from './controls.js'
import { loadGraph, loadAssets } from './content-loader.js'
import './styles.css'

const canvasHost = document.getElementById('viewer')
const loadingEl = document.getElementById('loading')
const errorEl = document.getElementById('error')
const subtitleEl = document.getElementById('scene-subtitle')
const statsEl = document.getElementById('scene-stats')

function showError(message) {
  errorEl.textContent = message
  errorEl.hidden = false
  loadingEl.classList.add('hidden')
}

function setLoading(text) {
  loadingEl.textContent = text
  loadingEl.classList.remove('hidden')
}

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
canvasHost.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0b1020)

const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

const hemi = new THREE.HemisphereLight(0xffffff, 0x44506b, 0.9)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xffffff, 2.4)
sun.position.set(8, 14, 6)
sun.castShadow = true
scene.add(sun)
const fill = new THREE.DirectionalLight(0x9ab4ff, 0.7)
fill.position.set(-6, 4, -5)
scene.add(fill)

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 400)
camera.position.set(11, 9, 12)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.target.set(0, 1.4, 0)

let graphRenderer
let viewerControls
let currentMode = 'stacked'
let currentSoloId = null

function wireToggles(sceneObject) {
  const kinds = [
    ['show-floors', 'floor'],
    ['show-ceilings', 'ceiling'],
    ['show-zones', 'zone'],
    ['show-furniture', 'item'],
    ['show-roof', 'roof'],
  ]
  for (const [id, kind] of kinds) {
    const el = document.getElementById(id)
    el.addEventListener('change', () => {
      sceneObject.traverse((obj) => {
        if (obj.userData && obj.userData.kind === kind) obj.visible = el.checked
      })
    })
  }
}

function buildLevelButtons(levels) {
  const container = document.getElementById('level-buttons')
  container.innerHTML = ''
  for (const level of levels) {
    const label = level.name || `Level ${level.level}`
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'level-button'
    button.textContent = label
    button.dataset.levelId = level.id
    button.addEventListener('click', () => {
      currentMode = 'solo'
      currentSoloId = level.id
      viewerControls.setMode('solo')
      viewerControls.setSolo(level.id)
      container.querySelectorAll('.level-button').forEach((b) => b.classList.remove('active'))
      button.classList.add('active')
      document.querySelectorAll('[data-level-mode]').forEach((b) => b.classList.remove('active'))
      const soloBtn = document.querySelector('[data-level-mode="solo"]')
      if (soloBtn) soloBtn.classList.add('active')
    })
    container.appendChild(button)
  }
}

function wireModeButtons() {
  document.querySelectorAll('[data-level-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.levelMode
      currentMode = mode
      viewerControls.setMode(mode)
      if (mode !== 'solo') {
        viewerControls.setSolo(null)
        currentSoloId = null
      } else if (!currentSoloId && graphRenderer && graphRenderer.levels.length > 0) {
        currentSoloId = graphRenderer.levels[0].id
        viewerControls.setSolo(currentSoloId)
      }
      document.querySelectorAll('[data-level-mode]').forEach((b) => b.classList.remove('active'))
      button.classList.add('active')
      if (mode === 'solo' && currentSoloId) {
        document.querySelectorAll('.level-button').forEach((b) => {
          b.classList.toggle('active', b.dataset.levelId === currentSoloId)
        })
      }
    })
  })
}

function wireViewButtons() {
  document.getElementById('fit-scene').addEventListener('click', () => viewerControls.fitScene())
  document.getElementById('reset-camera').addEventListener('click', () => viewerControls.resetView())
  document.getElementById('view-3d').addEventListener('click', () => viewerControls.fitScene())
  document.getElementById('view-plan').addEventListener('click', () => {
    camera.position.set(0, 22, 0.01)
    controls.target.set(0, 0, 0)
    controls.update()
  })
}

function renderStats(manifest, graph) {
  const counts = manifest.typeCounts || {}
  const totalNodes = Object.keys(graph.nodes || {}).length
  const totalItems = counts.item || 0
  const totalWalls = counts.wall || 0
  const totalZones = counts.zone || 0
  statsEl.innerHTML = ''
  const rows = [
    ['节点总数', totalNodes],
    ['墙体', totalWalls],
    ['房间分区', totalZones],
    ['家具实例', totalItems],
    ['场景版本', manifest.restoredApiVersion ?? '—'],
  ]
  for (const [label, value] of rows) {
    const dt = document.createElement('dt')
    dt.textContent = label
    const dd = document.createElement('dd')
    dd.textContent = String(value)
    statsEl.appendChild(dt)
    statsEl.appendChild(dd)
  }
}

async function main() {
  setLoading('正在读取场景…')
  try {
    const { graph, manifest, provenance } = await loadGraph()
    subtitleEl.textContent = `${manifest.sceneName ?? '场景'} · ${manifest.sourceRevision ?? ''} 快照 · 只读`
    renderStats(manifest, graph)

    setLoading(`正在加载家具模型 0/${Object.keys(graph.nodes).filter((k) => graph.nodes[k].type === 'item').length}…`)
    const gltfCache = await loadAssets(graph, (loaded, total) => {
      setLoading(`正在加载家具模型 ${loaded}/${total}…`)
    })

    graphRenderer = new GraphRenderer()
    graphRenderer.render(scene, graph, gltfCache)

    viewerControls = new ViewerControls({
      camera,
      scene,
      levels: graphRenderer.levels,
      levelObjects: graphRenderer.levelObjects,
    })
    viewerControls.setControls(controls)

    buildLevelButtons(graphRenderer.levels)
    wireModeButtons()
    wireViewButtons()
    wireToggles(scene)
    viewerControls.setMode('stacked')
    viewerControls.fitScene()

    // Optional plan view entry (?view=plan): near-top-down camera keeping
    // standard up vector so OrbitControls stays consistent.
    const planView = new URLSearchParams(window.location.search).get('view') === 'plan'
    if (planView) {
      camera.position.set(0, 22, 0.01)
      camera.up.set(0, 1, 0)
      camera.lookAt(0, 0, 0)
      controls.target.set(0, 0, 0)
      controls.update()
      document.getElementById('show-ceilings').checked = false
      document.getElementById('show-roof').checked = false
      for (const obj of [document.getElementById('show-ceilings'), document.getElementById('show-roof')]) {
        obj.dispatchEvent(new Event('change'))
      }
    }

    loadingEl.classList.add('hidden')
    window.__viewerScene = scene
    window.__viewerLevels = graphRenderer.levels
  } catch (err) {
    showError(`加载失败：${err.message}`)
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
renderer.setSize(window.innerWidth, window.innerHeight)

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}
animate()

main()
