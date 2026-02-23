# AGENTS.md

## 项目现状（以代码为准）

- 技术栈：`React 18 + TypeScript + Vite + Vitest`。
- 仓库形态：单包应用（非 monorepo），根目录直接是业务代码与配置。
- 核心依赖：
  - `react-photo-album`：网格相册展示。
  - `yet-another-react-lightbox`：大图查看。
  - `@headlessui/react`：画集详情弹窗。
- 发布方式：支持 Cloudflare Pages（`wrangler`）。

## 当前功能基线（修改时必须兼容）

1. 本地图片来源
- 优先使用 `showDirectoryPicker` 读取目录。
- 不支持目录选择器时，降级为 `<input type="file" webkitdirectory multiple>`。
- 支持图片后缀：`jpg/jpeg/png/webp/gif/bmp/avif/heic/heif`。

2. 浏览模式
- `全图模式`：展示当前路径下所有图片，可按路径过滤。
- `画集模式`：按一级子目录聚合为画集（根目录图片不作为画集）。
- 画集可打开详情弹窗，弹窗内继续使用网格浏览。
- 画集详情弹窗标题支持超长路径自动换行（最多 2 行截断），且不能影响网格每行排版宽度计算。

3. 大图查看（Lightbox）
- 支持从全图和画集详情两种上下文打开。
- 键盘行为：`Enter` 打开、`Escape` 先关大图再关弹窗、`F` 切换全屏。
- 切图动画已关闭，要求直接切图（`animation.fade/swipe/navigation = 0`）。

4. 资源与性能策略
- 预览图懒加载（`IntersectionObserver` + 滚动稳定后加载）。
- 预览 URL 有缓存上限和回收机制；离开视口延迟释放。
- 大图 URL 按当前索引窗口预加载并释放远处资源，避免内存膨胀。

5. 状态与交互
- 支持“刷新当前目录”（仅目录句柄可用时）。
- 支持清空当前加载图片与错误状态。
- 包含空状态、错误态、浏览器能力不支持提示。

## 与旧版指引的关键差异

- 不是 monorepo：移除 `turbo where`、`pnpm install --filter <project_name>` 这类多包指引。
- 不是 Vue：移除 `defineVmodel`、`vue-ts` 模板等 Vue 专属规范。
- 目录与脚本以当前仓库为准：不使用不存在的 `README.md`/包目录假设。

## 开发命令（当前仓库）

- 安装依赖：`pnpm install`
- 本地开发：`pnpm dev`
- 构建：`pnpm build`
- 测试：`pnpm test`
- 预览构建产物：`pnpm preview`
- Cloudflare 登录检查：`pnpm cf:whoami`
- Cloudflare Pages 发布：`pnpm cf:deploy`

## 编码与协作规范

1. 通用原则
- 修改前先定位真实文件与现有实现，不臆造 API、配置或路径。
- 代码保持简洁，优先类型安全与显式错误处理。
- 非复杂业务逻辑不加注释。

2. React/TypeScript 约束
- 复用现有 hook 与工具函数（如 `useDirectoryImages`、`resourceManager`）。
- 行为变更优先补或改 Vitest 测试，保持现有测试结构风格。
- 不引入不必要的全局状态库或额外网络请求。

3. 样式约束
- 使用原生 CSS nesting。
- 嵌套深度不超过 3 层。
- 伪类和修饰态优先使用 `&`。

4. 文档同步
- 若变更了用户可见行为、交互快捷键、缓存策略或发布流程，必须同步更新本文件对应章节。

## MCP / 文档查询

- 涉及第三方库 API、配置项或脚手架步骤时，优先使用 Context7 查询官方文档后再实现。
