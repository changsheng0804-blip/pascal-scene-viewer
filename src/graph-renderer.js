import * as THREE from 'three'

const FLOOR_COLORS = [0x728fb8, 0x9d7caf, 0xb08d57, 0x6ea58d]
const ROOM_COLORS = [0x6f9df0, 0x8ecfba, 0xf0b46c, 0xd887a8, 0x9a8be0, 0x79c4d8]

function material(color, roughness = 0.72, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function doubleSided(color, roughness = 0.75, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })
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

// Level-local coordinates: this function only builds geometry; the level group
// itself is moved vertically by ViewerControls.
function buildSlab(polygon, holes, thickness, elevation, meshMaterial) {
  const geometry = new THREE.ExtrudeGeometry(polygonShape(polygon, holes), {
    depth: thickness,
    bevelEnabled: false,
  })
  // Extrude pushes along +Z; rotateX(-π/2) makes the solid extend downward
  // along -Y: top face at y=0, underside at y=-thickness. Position the mesh
  // so the top face sits exactly at `elevation` — no geometry translate.
  geometry.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geometry, meshMaterial)
  mesh.position.y = elevation
  mesh.receiveShadow = true
  mesh.castShadow = true
  return mesh
}

function wallFrame(wall) {
  const [sx, sz] = wall.start
  const [ex, ez] = wall.end
  const dx = ex - sx
  const dz = ez - sz
  const length = Math.hypot(dx, dz) || 1
  return {
    sx, sz,
    length,
    dirX: dx / length,
    dirZ: dz / length,
    angle: -Math.atan2(dz, dx),
  }
}

function addBox(parent, size, position, meshMaterial, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), meshMaterial)
  mesh.position.set(position[0], position[1], position[2])
  mesh.rotation.y = rotationY
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function buildWallMesh(parent, wall) {
  const frame = wallFrame(wall)
  const height = wall.height ?? 2.6
  const thickness = wall.thickness ?? 0.16
  // Openings were resolved by render() and attached to wall.__openings.
  const entries = (wall.__openings ?? [])
    .map((o) => ({ localX: (o.position && o.position[0]) || 0, width: o.width || 1, opening: o }))
    .sort((a, b) => a.localX - b.localX)

  const segments = []
  let cursor = 0
  for (const entry of entries) {
    const start = Math.max(cursor, entry.localX - entry.width / 2)
    const end = entry.localX + entry.width / 2
    if (end <= cursor) continue
    if (start - cursor > 0.001) segments.push({ from: cursor, to: start })
    cursor = Math.max(cursor, end)
  }
  if (frame.length - cursor > 0.001) segments.push({ from: cursor, to: frame.length })

  const wallGroup = new THREE.Group()
  wallGroup.name = `wall-${wall.id}`
  wallGroup.userData.kind = 'wall'
  const wallMat = doubleSided(0xd8dbe4, 0.85, 0.02)
  for (const segment of segments) {
    const segLen = segment.to - segment.from
    if (segLen <= 0.001) continue
    const midX = (segment.from + segment.to) / 2
    const cx = frame.sx + frame.dirX * midX
    const cz = frame.sz + frame.dirZ * midX
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, height, thickness), wallMat)
    mesh.position.set(cx, height / 2, cz)
    mesh.rotation.y = frame.angle
    mesh.castShadow = true
    mesh.receiveShadow = true
    wallGroup.add(mesh)
  }
  parent.add(wallGroup)
  return wallGroup
}

function buildOpeningMesh(parent, opening, wall) {
  const frame = wallFrame(wall)
  const localX = (opening.position && opening.position[0]) || 0
  const cx = frame.sx + frame.dirX * localX
  const cz = frame.sz + frame.dirZ * localX
  const width = opening.width || 0.9
  const height = opening.height || 2.1
  const group = new THREE.Group()
  group.name = `${opening.type}-${opening.id}`
  group.position.set(cx, 0, cz)
  group.rotation.y = frame.angle

  if (opening.type === 'door') {
    const frameMat = material(0xb9bcc6, 0.5, 0.2)
    const leafMat = material(0x9b7c54, 0.6, 0.05)
    const frameThickness = 0.05
    // Side jambs.
    addBox(group, [frameThickness, height, width], [-(width / 2) - frameThickness / 2, height / 2, 0], frameMat)
    addBox(group, [frameThickness, height, width], [width / 2 + frameThickness / 2, height / 2, 0], frameMat)
    // Head.
    addBox(group, [width + frameThickness * 2, frameThickness, width], [0, height + frameThickness / 2, 0], frameMat)
    // Leaf.
    addBox(group, [width, height, 0.06], [0, height / 2, 0], leafMat)
    // Threshold at floor.
    addBox(group, [width, 0.03, width], [0, 0.015, 0], frameMat)
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
    const top = sill + height
    const frameThickness = 0.05
    // Side jambs.
    addBox(group, [frameThickness, height, width], [-(width / 2) - frameThickness / 2, sill + height / 2, 0], frameMat)
    addBox(group, [frameThickness, height, width], [width / 2 + frameThickness / 2, sill + height / 2, 0], frameMat)
    // Head and sill.
    addBox(group, [width + frameThickness * 2, frameThickness, width], [0, top + frameThickness / 2, 0], frameMat)
    addBox(group, [width + frameThickness * 2, frameThickness, width], [0, sill - frameThickness / 2, 0], frameMat)
    // Glass.
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, height), glassMat)
    glass.position.set(0, sill + height / 2, 0)
    group.add(glass)
  }
  parent.add(group)
  return group
}

function buildStair(parent, stair, levels) {
  const fromLevel = levels.find((l) => l.id === stair.fromLevelId)
  const toLevel = levels.find((l) => l.id === stair.toLevelId)
  const riseIndex =
    toLevel && fromLevel ? toLevel.level - fromLevel.level : 1
  const height = (stair.totalRise ?? (riseIndex > 0 ? 2.8 : 0)) || 2.8
  const width = stair.width ?? 1.0
  const stepCount = stair.stepCount ?? 14
  const runLength = (stair.runLength ?? 3.0) || 3.0
  const [px, , pz] = stair.position ?? [0, 0, 0]
  const rotation = stair.rotation ?? 0
  const group = new THREE.Group()
  group.name = `stair-${stair.id}`
  group.position.set(px, 0, pz)
  group.rotation.y = rotation

  const stepMat = material(0x7a6a52, 0.65, 0.05)
  const riserMat = material(0x9d9aa8, 0.8, 0.02)
  const stepHeight = height / stepCount
  const stepDepth = runLength / stepCount
  const railingMat = material(0x3c4457, 0.6, 0.2)

  for (let i = 0; i < stepCount; i++) {
    const z = i * stepDepth
    addBox(group, [width, stepHeight, stepDepth + 0.01], [0, stepHeight / 2, z], riserMat)
    addBox(group, [width, 0.015, stepDepth + 0.01], [0, stepHeight + 0.008, z], stepMat)
  }
  if (stair.railingMode !== 'none') {
    const railY = height + 0.9
    for (const side of [width / 2 - 0.02, -width / 2 + 0.02]) {
      addBox(group, [0.03, railY, 0.03], [side, railY / 2, runLength / 2], railingMat)
      addBox(group, [0.03, 0.03, runLength], [side, railY, runLength / 2], railingMat)
    }
  }
  parent.add(group)
  return group
}

function triGeometry(verts, indices) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function buildRoof(parent, roof, segment) {
  const width = segment.width ?? 10
  const depth = segment.depth ?? 8
  const wallH = segment.wallHeight ?? 0.35
  const pitch = (segment.pitch ?? 30) * (Math.PI / 180)
  const overhang = segment.overhang ?? 0.45
  const totalW = width + overhang * 2
  const totalD = depth + overhang * 2
  const halfW = totalW / 2
  const halfD = totalD / 2
  const ridgeH = Math.tan(pitch) * halfW
  const ridgeY = wallH + ridgeH
  const center = roof.position ?? [0, 0, 0]

  const roofMat = doubleSided(0x4a4f5c, 0.75, 0.05)
  const gableMat = doubleSided(0x565b6a, 0.7, 0.04)

  const group = new THREE.Group()
  group.name = `roof-${roof.id}`
  group.userData.kind = 'roof'
  group.position.set(center[0], 0, center[2])

  // Left slope: eave at x=-halfW, ridge at x=0, z from -halfD to +halfD.
  const left = new THREE.Mesh(
    triGeometry(
      [
        -halfW, wallH, -halfD,
        -halfW, wallH, halfD,
        0, ridgeY, halfD,
        0, ridgeY, -halfD,
      ],
      [0, 1, 2, 0, 2, 3],
    ),
    roofMat,
  )
  left.castShadow = true
  left.receiveShadow = true
  group.add(left)

  // Right slope: mirror of left, ridge also at x=0.
  const right = new THREE.Mesh(
    triGeometry(
      [
        halfW, wallH, -halfD,
        halfW, wallH, halfD,
        0, ridgeY, halfD,
        0, ridgeY, -halfD,
      ],
      [0, 2, 1, 0, 3, 2],
    ),
    roofMat,
  )
  right.castShadow = true
  right.receiveShadow = true
  group.add(right)

  // Gable triangles at z=±halfD.
  const front = new THREE.Mesh(
    triGeometry(
      [
        -halfW, wallH, halfD,
        halfW, wallH, halfD,
        0, ridgeY, halfD,
      ],
      [0, 1, 2],
    ),
    gableMat,
  )
  front.castShadow = true
  front.receiveShadow = true
  group.add(front)

  const back = new THREE.Mesh(
    triGeometry(
      [
        -halfW, wallH, -halfD,
        0, ridgeY, -halfD,
        halfW, wallH, -halfD,
      ],
      [0, 1, 2],
    ),
    gableMat,
  )
  back.castShadow = true
  back.receiveShadow = true
  group.add(back)

  // The roof level group is already lifted above the occupied stories by
  // ViewerControls; the roof geometry sits at this level's local origin.
  parent.add(group)
  group.position.set(center[0], 0, center[2])
  return group
}

export class GraphRenderer {
  constructor() {
    this.groups = { levels: new Map(), items: new THREE.Group(), zones: new THREE.Group() }
    this.levelObjects = new Map()
    this.itemMeshes = []
    this.levels = []
    this._cache = {}
  }

  render(scene, graph, gltfCache) {
    const nodes = graph.nodes
    this._cache = { nodes, graph, gltfCache }
    this.levels = Object.values(nodes)
      .filter((n) => n.type === 'level')
      .sort((a, b) => a.level - b.level)

    for (const level of this.levels) {
      const group = new THREE.Group()
      group.name = `level-${level.id}`
      group.userData.pascalLevel = level
      scene.add(group)
      this.levelObjects.set(level.id, group)
      this.groups.levels.set(level.id, group)
    }

    // First pass: collect children by parent to attach openings to walls.
    for (const node of Object.values(nodes)) {
      if (node.type !== 'wall') continue
      node.__openings = (node.children ?? [])
        .map((id) => nodes[id])
        .filter((o) => o && (o.type === 'door' || o.type === 'window'))
    }

    for (const node of Object.values(nodes)) {
      const level = this.levels.find((l) => node.parentId === l.id)
      if (!level) continue
      const levelGroup = this.levelObjects.get(level.id)
      if (!levelGroup) continue
      const elevation = node.elevation ?? 0

      if (node.type === 'slab') {
        const mesh = buildSlab(
          node.polygon,
          node.holes ?? [],
          node.thickness ?? 0.1,
          elevation,
          material(FLOOR_COLORS[(node.id.length + level.id.length) % FLOOR_COLORS.length], 0.9, 0.05),
        )
        mesh.name = `slab-${node.id}`
        mesh.userData.kind = 'floor'
        levelGroup.add(mesh)
      } else if (node.type === 'ceiling') {
        const mesh = buildSlab(
          node.polygon,
          node.holes ?? [],
          node.thickness ?? 0.08,
          node.height ?? 2.6,
          material(0xc3cad9, 0.9, 0.02),
        )
        mesh.name = `ceiling-${node.id}`
        mesh.userData.kind = 'ceiling'
        mesh.visible = false
        levelGroup.add(mesh)
      } else if (node.type === 'wall') {
        buildWallMesh(levelGroup, node)
        for (const opening of node.__openings ?? []) {
          buildOpeningMesh(levelGroup, opening, node)
        }
      } else if (node.type === 'stair') {
        buildStair(levelGroup, node, this.levels)
      } else if (node.type === 'roof') {
        const segId = (node.children ?? [])[0]
        const seg = segId ? nodes[segId] : null
        if (seg) buildRoof(levelGroup, node, seg)
      } else if (node.type === 'item') {
        this._placeItem(node)
      }
    }

    // Zones as translucent overlays at their level's local elevation.
    for (const node of Object.values(nodes)) {
      if (node.type !== 'zone') continue
      const level = this.levels.find((l) => node.parentId === l.id)
      const levelGroup = level ? this.levelObjects.get(level.id) : null
      if (!levelGroup || !node.polygon) continue
      const mat = new THREE.MeshStandardMaterial({
        color: ROOM_COLORS[node.id.length % ROOM_COLORS.length],
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(polygonShape(node.polygon)), mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.02
      mesh.name = `zone-${node.id}`
      mesh.userData.kind = 'zone'
      mesh.userData.zoneName = node.name
      this.groups.zones.add(mesh)
      mesh.visible = false
    }

    scene.add(this.groups.items)
    scene.add(this.groups.zones)
  }

  _placeItem(node) {
    const asset = node.asset || {}
    const src = asset.src
    const group = new THREE.Group()
    group.name = `item-${node.id}`
    group.userData.kind = 'item'
    const pos = node.position ?? [0, 0, 0]
    group.position.set(pos[0], pos[1] ?? 0, pos[2] ?? 0)
    const rot = node.rotation ?? [0, 0, 0]
    group.rotation.set(rot[0] ?? 0, rot[1] ?? 0, rot[2] ?? 0)
    const scale = node.scale ?? [1, 1, 1]
    group.scale.set(scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1)

    if (src && this._cache.gltfCache.has(src)) {
      const gltf = this._cache.gltfCache.get(src)
      const model = gltf.scene.clone()
      const offset = asset.offset ?? [0, 0, 0]
      const assetScale = asset.scale ?? [1, 1, 1]
      model.scale.set(assetScale[0] ?? 1, assetScale[1] ?? 1, assetScale[2] ?? 1)
      const offsetGroup = new THREE.Group()
      offsetGroup.position.set(offset[0] ?? 0, offset[1] ?? 0, offset[2] ?? 0)
      offsetGroup.add(model)
      group.add(offsetGroup)
      group.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true
          o.receiveShadow = true
        }
      })
    } else {
      const placeholder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), material(0x8a8fa8, 0.6, 0.1))
      placeholder.position.y = 0.25
      group.add(placeholder)
    }
    this.groups.items.add(group)
    this.itemMeshes.push(group)
  }
}
