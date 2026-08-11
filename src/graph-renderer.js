import * as THREE from 'three'

const FLOOR_COLORS = [0x728fb8, 0x9d7caf, 0xb08d57, 0x6ea58d]
const ROOM_COLORS = [0x6f9df0, 0x8ecfba, 0xf0b46c, 0xd887a8, 0x9a8be0, 0x79c4d8]

function material(color, roughness = 0.72, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function polygonShape(polygon, holes = []) {
  const shape = new THREE.Shape()
  polygon.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, z)
    else shape.lineTo(x, z)
  })
  shape.closePath()
  holes.forEach((hole) => {
    const path = new THREE.Path()
    hole.forEach(([x, z], index) => {
      if (index === 0) path.moveTo(x, z)
      else path.lineTo(x, z)
    })
    path.closePath()
    shape.holes.push(path)
  })
  return shape
}

function planeFromPolygon(polygon, holes, meshMaterial, y) {
  const geometry = new THREE.ShapeGeometry(polygonShape(polygon, holes))
  geometry.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geometry, meshMaterial)
  mesh.position.y = y
  mesh.receiveShadow = true
  return mesh
}

function wallFrame(wall) {
  const [sx, sz] = wall.start
  const [ex, ez] = wall.end
  const dx = ex - sx
  const dz = ez - sz
  const length = Math.hypot(dx, dz)
  return {
    sx, sz,
    length: length || 1,
    dirX: dx / (length || 1),
    dirZ: dz / (length || 1),
    angle: -Math.atan2(dz, dx),
  }
}

function addBox(parent, size, position, meshMaterial, rotationY = 0) {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2])
  const mesh = new THREE.Mesh(geometry, meshMaterial)
  mesh.position.set(position[0], position[1], position[2])
  mesh.rotation.y = rotationY
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function buildWallMesh(parent, wall, height) {
  const frame = wallFrame(wall)
  const half = height / 2
  const thickness = wall.thickness ?? 0.16
  const openings = (wall.children ?? []).map((child) => child)

  // Build wall as a series of solid segments separated by openings.
  // Openings are expressed in wall-local x (distance from start).
  const segments = []
  let cursor = 0
  const sorted = openings
    .filter((o) => o && o.type)
    .map((o) => {
      const localX = (o.position && o.position[0]) || 0
      const width = o.width || 1
      return { localX, width, opening: o }
    })
    .sort((a, b) => a.localX - b.localX)

  for (const entry of sorted) {
    const start = Math.max(cursor, entry.localX - entry.width / 2)
    const end = entry.localX + entry.width / 2
    if (end <= cursor) continue
    if (start - cursor > 0.001) {
      segments.push({ from: cursor, to: start })
    }
    cursor = Math.max(cursor, end)
  }
  if (frame.length - cursor > 0.001) {
    segments.push({ from: cursor, to: frame.length })
  }

  const wallGroup = new THREE.Group()
  wallGroup.name = `wall-${wall.id}`
  for (const segment of segments) {
    const segLen = segment.to - segment.from
    if (segLen <= 0.001) continue
    const midX = (segment.from + segment.to) / 2
    const cx = frame.sx + frame.dirX * midX
    const cz = frame.sz + frame.dirZ * midX
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(segLen, height, thickness),
      material(0xd8dbe4, 0.85, 0.02),
    )
    mesh.position.set(cx, height / 2, cz)
    mesh.rotation.y = frame.angle
    mesh.castShadow = true
    mesh.receiveShadow = true
    wallGroup.add(mesh)
  }
  parent.add(wallGroup)
  return wallGroup
}

function buildOpeningMesh(parent, opening, wall, baseY) {
  const frame = wallFrame(wall)
  const localX = (opening.position && opening.position[0]) || 0
  const cx = frame.sx + frame.dirX * localX
  const cz = frame.sz + frame.dirZ * localX
  const width = opening.width || 0.9
  const height = opening.height || 2.1
  const group = new THREE.Group()
  group.position.set(cx, baseY, cz)
  group.rotation.y = frame.angle

  if (opening.type === 'door') {
    const frameMat = material(0xb9bcc6, 0.5, 0.2)
    const leafMat = material(0x9b7c54, 0.6, 0.05)
    const frameThickness = 0.05
    addBox(group, [frameThickness, height, width], [-(width / 2) - frameThickness / 2, height / 2, 0], frameMat)
    addBox(group, [frameThickness, height, width], [width / 2 + frameThickness / 2, height / 2, 0], frameMat)
    addBox(group, [width + frameThickness * 2, frameThickness, 0.06], [0, height + frameThickness / 2, 0], frameMat)
    addBox(group, [width, height, 0.06], [0, height / 2, 0], leafMat)
  } else if (opening.type === 'window') {
    const frameMat = material(0xe8eaf0, 0.4, 0.1)
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xa8d8ff,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.1,
      side: THREE.DoubleSide,
    })
    const sill = opening.sillHeight ?? 0.9
    const frameThickness = 0.05
    addBox(group, [frameThickness, height, width], [-(width / 2) - frameThickness / 2, sill + height / 2, 0], frameMat)
    addBox(group, [frameThickness, height, width], [width / 2 + frameThickness / 2, sill + height / 2, 0], frameMat)
    addBox(group, [width + frameThickness * 2, frameThickness, 0.08], [0, sill + height + frameThickness / 2, 0], frameMat)
    addBox(group, [width + frameThickness * 2, frameThickness, 0.08], [0, sill - frameThickness / 2, 0], frameMat)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, height), glassMat)
    glass.position.set(0, sill + height / 2, 0)
    group.add(glass)
  }
  parent.add(group)
  return group
}

function buildStair(parent, stair, levels, baseY) {
  const fromLevel = levels.find((l) => l.id === stair.fromLevelId)
  const toLevel = levels.find((l) => l.id === stair.toLevelId)
  const rise = toLevel && fromLevel ? toLevel.level - fromLevel.level : 1
  const height = (stair.totalRise ?? (rise > 0 ? 2.8 : 0)) || 2.8
  const width = stair.width ?? 1.0
  const stepCount = stair.stepCount ?? 14
  const runLength = (stair.runLength ?? 3.0) || 3.0
  const [px, , pz] = stair.position ?? [0, 0, 0]
  const rotation = stair.rotation ?? 0
  const group = new THREE.Group()
  group.position.set(px, baseY, pz)
  group.rotation.y = rotation

  const stepMat = material(0x7a6a52, 0.65, 0.05)
  const riserMat = material(0x9d9aa8, 0.8, 0.02)
  const stepHeight = height / stepCount
  const stepDepth = runLength / stepCount
  const railingMat = material(0x3c4457, 0.6, 0.2)

  for (let i = 0; i < stepCount; i++) {
    const z = i * stepDepth
    addBox(group, [width, stepHeight, stepDepth + 0.01], [0, stepHeight / 2, z], i === stepCount - 1 ? stepMat : riserMat)
    addBox(group, [width, 0.015, stepDepth + 0.01], [0, stepHeight + 0.008, z], stepMat)
  }
  if (stair.railingMode !== 'none') {
    const railY = height + 0.9
    addBox(group, [0.03, railY, 0.03], [width / 2 - 0.02, railY / 2, runLength / 2], railingMat)
    addBox(group, [0.03, railY, 0.03], [-width / 2 + 0.02, railY / 2, runLength / 2], railingMat)
    addBox(group, [0.03, 0.03, runLength], [width / 2 - 0.02, railY, runLength / 2], railingMat)
    if (stair.railingMode === 'both') {
      addBox(group, [0.03, 0.03, runLength], [-width / 2 + 0.02, railY, runLength / 2], railingMat)
    }
  }
  parent.add(group)
  return group
}

function buildRoof(parent, roof, segment, baseY) {
  const width = segment.width ?? 10
  const depth = segment.depth ?? 8
  const wallH = segment.wallHeight ?? 0.35
  const pitch = (segment.pitch ?? 30) * (Math.PI / 180)
  const overhang = segment.overhang ?? 0.45
  const totalW = width + overhang * 2
  const totalD = depth + overhang * 2
  const ridgeH = Math.tan(pitch) * (totalW / 2)
  const center = roof.position ?? [0, 0, 0]

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x4a4f5c,
    roughness: 0.75,
    metalness: 0.05,
    side: THREE.DoubleSide,
  })
  const gableMat = new THREE.MeshStandardMaterial({
    color: 0x565b6a,
    roughness: 0.7,
    metalness: 0.04,
    side: THREE.DoubleSide,
  })
  const group = new THREE.Group()
  group.name = `roof-${roof.id}`
  group.userData.kind = 'roof'
  group.position.set(center[0], baseY, center[2])

  const halfW = totalW / 2
  const halfD = totalD / 2
  const slopeLen = Math.hypot(halfW, ridgeH)
  const angle = Math.atan2(ridgeH, halfW)

  const makeSlope = () => {
    const geometry = new THREE.PlaneGeometry(slopeLen, totalD)
    geometry.translate(-slopeLen / 2, 0, 0)
    geometry.rotateZ(-angle)
    const mesh = new THREE.Mesh(geometry, roofMat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  const left = makeSlope()
  left.position.set(-halfW, wallH, 0)
  group.add(left)

  const right = makeSlope()
  right.rotation.y = Math.PI
  right.position.set(halfW, wallH, 0)
  group.add(right)

  const gableGeometry = () => {
    const geometry = new THREE.BufferGeometry()
    const h2 = wallH + ridgeH
    const verts = new Float32Array([
      -halfW, 0, halfD,
      0, h2, halfD,
      halfW, 0, halfD,
    ])
    geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    geometry.computeVertexNormals()
    return geometry
  }

  const front = new THREE.Mesh(gableGeometry(), gableMat)
  front.castShadow = true
  front.receiveShadow = true
  group.add(front)

  const back = new THREE.Mesh(gableGeometry(), gableMat)
  back.rotation.y = Math.PI
  back.castShadow = true
  back.receiveShadow = true
  group.add(back)

  parent.add(group)
  return group
}

export class GraphRenderer {
  constructor() {
    this.groups = { levels: new Map(), items: new THREE.Group(), zones: new THREE.Group() }
    this.levelObjects = new Map()
    this.itemMeshes = []
    this._cache = {}
  }

  getCache() {
    return this._cache
  }

  levelOffset(levels, level) {
    let offset = 0
    for (const candidate of levels) {
      if (candidate.level < level.level) {
        offset += (candidate.height ?? 2.8)
      }
    }
    return offset + (level.baseElevation ?? 0)
  }

  render(scene, graph, gltfCache) {
    const nodes = graph.nodes
    const rootIds = graph.rootNodeIds
    this._cache = { nodes, graph, gltfCache }
    const levels = Object.values(nodes)
      .filter((n) => n.type === 'level')
      .sort((a, b) => a.level - b.level)
    this.levels = levels

    for (const level of levels) {
      const group = new THREE.Group()
      group.name = `level-${level.id}`
      group.userData.pascalLevel = level
      scene.add(group)
      this.levelObjects.set(level.id, group)
      this.groups.levels.set(level.id, group)
    }

    for (const node of Object.values(nodes)) {
      if (node.parentId === null || node.parentId === undefined) continue
      const level = levels.find((l) => node.parentId === l.id)
      if (!level) continue
      const baseY = this.levelOffset(levels, level)
      const levelGroup = this.levelObjects.get(level.id)
      if (!levelGroup) continue

      if (node.type === 'slab') {
        const mesh = planeFromPolygon(
          node.polygon,
          node.holes ?? [],
          material(FLOOR_COLORS[(node.parentId.length + node.id.length) % FLOOR_COLORS.length], 0.9, 0.05),
          baseY + (node.elevation ?? 0),
        )
        mesh.name = `slab-${node.id}`
        mesh.userData.kind = 'floor'
        levelGroup.add(mesh)
      } else if (node.type === 'ceiling') {
        const mesh = planeFromPolygon(
          node.polygon,
          node.holes ?? [],
          material(0xc3cad9, 0.9, 0.02),
          baseY + (node.height ?? 2.6),
        )
        mesh.name = `ceiling-${node.id}`
        mesh.userData.kind = 'ceiling'
        mesh.visible = false
        levelGroup.add(mesh)
      } else if (node.type === 'wall') {
        buildWallMesh(levelGroup, node, node.height ?? 2.6)
        for (const opening of node.children ?? []) {
          if (!nodes[opening]) continue
          const o = nodes[opening]
          if (o.type === 'door' || o.type === 'window') {
            buildOpeningMesh(levelGroup, o, node, baseY)
          }
        }
      } else if (node.type === 'stair') {
        buildStair(levelGroup, node, levels, baseY)
      } else if (node.type === 'roof') {
        const segId = (node.children ?? [])[0]
        const seg = segId ? nodes[segId] : null
        if (seg) buildRoof(levelGroup, node, seg, baseY)
      } else if (node.type === 'item') {
        this._placeItem(node, baseY)
      }
    }

    // Zones as translucent overlays on their level.
    for (const node of Object.values(nodes)) {
      if (node.type !== 'zone') continue
      const level = levels.find((l) => node.parentId === l.id)
      const levelGroup = level ? this.levelObjects.get(level.id) : null
      if (!levelGroup || !node.polygon) continue
      const baseY = this.levelOffset(levels, level)
      const mat = new THREE.MeshStandardMaterial({
        color: ROOM_COLORS[node.id.length % ROOM_COLORS.length],
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const mesh = planeFromPolygon(node.polygon, [], mat, baseY + 0.03)
      mesh.name = `zone-${node.id}`
      mesh.userData.kind = 'zone'
      mesh.userData.zoneName = node.name
      this.groups.zones.add(mesh)
      mesh.visible = false
    }

    scene.add(this.groups.items)
    scene.add(this.groups.zones)
  }

  _placeItem(node, baseY) {
    const asset = node.asset || {}
    const src = asset.src
    const group = new THREE.Group()
    group.name = `item-${node.id}`
    group.userData.kind = 'item'
    const pos = node.position ?? [0, 0, 0]
    group.position.set(pos[0], (pos[1] ?? 0) + baseY, pos[2] ?? 0)
    const rot = node.rotation ?? [0, 0, 0]
    group.rotation.set(rot[0] ?? 0, rot[1] ?? 0, rot[2] ?? 0)
    const scale = node.scale ?? [1, 1, 1]
    group.scale.set(scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1)

    if (src && this._cache.gltfCache.has(src)) {
      const gltf = this._cache.gltfCache.get(src)
      const model = gltf.scene.clone()
      const offset = asset.offset ?? [0, 0, 0]
      const offsetGroup = new THREE.Group()
      offsetGroup.position.set(offset[0] ?? 0, offset[1] ?? 0, offset[2] ?? 0)
      offsetGroup.add(model)
      const assetScale = asset.scale ?? [1, 1, 1]
      model.scale.set(assetScale[0] ?? 1, assetScale[1] ?? 1, assetScale[2] ?? 1)
      group.add(offsetGroup)
      group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    } else {
      const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        material(0x8a8fa8, 0.6, 0.1),
      )
      group.add(placeholder)
    }
    this.groups.items.add(group)
    this.itemMeshes.push(group)
  }
}
