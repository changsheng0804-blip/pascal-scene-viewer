# Third-Party Notices

## Three.js

- Source: https://github.com/mrdoob/three.js
- License: MIT
- Used for: 3D rendering, OrbitControls, GLTFLoader, DRACOLoader.

## Draco (Google)

- Source: https://github.com/google/draco
- License: Apache-2.0
- Used for: KHR_draco_mesh_compression decoding (13 of 16 furniture GLBs).
- Files vendored under `public/content/v1/decoder/draco/`.

## Furniture GLB assets

- Source: Pascal Editor item library (`apps/editor/public/items/`).
- The 16 unique models were explicitly confirmed by the repository owner for public publication.
- Per-model upstream license/author metadata was not present in the Pascal scene or catalog.
- Full asset inventory (SHA-256, source path, bytes) is recorded in `public/content/v1/provenance.json`.

## Scene data

- Source: Pascal scene `348aaad6e1f6`（`单户两层住宅-合理布局-v1`）, 80-node read-only snapshot.
