# Pascal Scene Viewer

只读展示 `单户两层住宅-合理布局-v1`（Pascal 场景 `348aaad6e1f6`，80 节点）的静态 3D Viewer。无编辑、无自动保存、不连接 Pascal API。

## 部署地址

- 3D 视图：`viewer/v1/`
- 平面图视图：`viewer/v1/floorplans/`
- 最新版入口：`viewer/latest/`

项目站点基路径为 `/pascal-scene-viewer/`，因此完整 URL 为：

```text
https://changsheng0804-blip.github.io/pascal-scene-viewer/viewer/v1/
https://changsheng0804-blip.github.io/pascal-scene-viewer/viewer/v1/floorplans/
https://changsheng0804-blip.github.io/pascal-scene-viewer/viewer/latest/
```

## 内容组织

```text
public/content/v1/
  graph.json        # 只读场景图（80 节点，家具路径已改写为 ./assets/<sha256>.glb）
  manifest.json     # 版本与资产清单
  provenance.json   # 资产来源与公开授权记录
  assets/           # 16 个家具 GLB（SHA-256 命名，精确字节）
  decoder/draco/    # 本地 Draco decoder（不依赖 gstatic）
```

新增版本时添加 `public/content/v2/` 并在 `scripts/build-pages.mjs` 中注册对应页面，`v1` 保持不可变。

## 构建

```bash
npm ci
npm run check:provenance   # 资产公开授权校验
npm run check:content      # 图与资产一致性校验
npm run build              # 生成 .pages-build/ 多级静态输出
npm run preview            # 本地预览
```

## 发布

`.github/workflows/pages.yml` 会在 push 到 `main` 后自动构建并部署到 GitHub Pages。仓库需在 Settings → Pages 中选择 “GitHub Actions” 作为发布源。

## 许可与来源

- Viewer 软件：本仓库代码。
- 场景数据：Pascal 场景 `348aaad6e1f6` 的只读快照。
- 家具 GLB：已获仓库所有者确认可公开发布；各模型的上游逐项许可未在 Pascal 场景/目录中提供，详见 `public/content/v1/provenance.json`。
- Three.js：MIT。Draco decoder：Apache-2.0。
