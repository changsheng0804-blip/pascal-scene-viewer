import * as THREE from 'three'

export class ViewerControls {
  constructor({ camera, scene, levels, levelObjects }) {
    this.camera = camera
    this.scene = scene
    this.levels = levels
    this.levelObjects = levelObjects
    this.mode = 'stacked'
    this.soloLevelId = null
  }

  setControls(controls) {
    this.controls = controls
  }

  setMode(mode) {
    this.mode = mode
    this.apply()
  }

  setSolo(levelId) {
    this.soloLevelId = levelId
    this.apply()
  }

  apply() {
    for (const level of this.levels) {
      const group = this.levelObjects.get(level.id)
      if (!group) continue
      let targetY = 0
      for (const candidate of this.levels) {
        if (candidate.level < level.level) targetY += candidate.height ?? 2.8
      }
      if (this.mode === 'exploded') targetY += level.level * 3.5
      group.position.y = targetY

      const soloHidden =
        this.mode === 'solo' && this.soloLevelId !== null && level.id !== this.soloLevelId
      group.visible = !soloHidden
    }
  }

  fitScene() {
    const box = new THREE.Box3().setFromObject(this.scene)
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const dist = sphere.radius * 2.3
    this.camera.position.set(center.x + dist * 0.72, center.y + dist * 0.5, center.z + dist)
    if (this.controls) {
      this.controls.target.copy(center)
      this.controls.update()
    } else {
      this.camera.lookAt(center)
    }
  }

  resetView() {
    this.camera.position.set(11, 9, 12)
    if (this.controls) {
      this.controls.target.set(0, 1.4, 0)
      this.controls.update()
    } else {
      this.camera.lookAt(0, 1.4, 0)
    }
  }
}
