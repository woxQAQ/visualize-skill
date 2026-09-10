# visualize-skills

为 AI 提供声明式 TypeScript SDK 和操作手册。内容脚本声明报告 Markdown、对象标签、关系、节点与逻辑分区的位置和尺寸；系统生成风格一致、可以离线交互阅读的 HTML。

## 运行

需要 Node.js 22.18 或更新版本。SDK 分发编译后的 JavaScript 与 TypeScript 类型声明；用户的内容脚本可使用 TypeScript。Markdown 语法由 `mdast-util-from-markdown` 解析。TypeScript 和 Node 类型声明用于开发检查。

```sh
pnpm install --frozen-lockfile
pnpm example
pnpm example:single
pnpm test
```

`pnpm example` 生成 `output/self-explanation.html`，用架构图和带执行条的时序图解释系统自身；`pnpm example:single` 复用架构图，生成 `output/architecture.html`。两份产物都可点击节点查看详情，直接在浏览器中打开文件即可。

`pnpm test` 先执行 TypeScript 构建和严格检查，再运行测试。`src/`、示例和测试均参与检查；`test/contracts.ts` 检查缺少尺寸、错误属性和修改只读数据等声明在编译时被拒绝。Node 运行 TypeScript 时只移除类型，不进行类型检查。

开发环境由 `devenv.nix` 和 `devenv.yaml` 声明，使用 `devenv shell` 进入。不要通过 Homebrew 手动安装依赖。

## 分发与使用

用户通过包名 `@visualize/semantic` 导入 SDK，不引用仓库的 `src/`。`visualize` 是安装后提供的生成命令。包名中的 `semantic` 表示作者声明对象和关系的语义，外观由 SDK 生成。

当前尚未发布到 npm。可先构建本地分发包：

```sh
pnpm pack --pack-destination output
```

把生成的 `visualize-semantic-0.1.0.tgz` 交给使用者，在其内容项目中安装：

```sh
pnpm add /实际路径/visualize-semantic-0.1.0.tgz
```

包内包含 `dist/` 下的 JavaScript、`.d.ts` 类型声明、Skill 手册和示例。示例 `.ts` 用于阅读或复制到用户项目；不在 `node_modules` 内直接运行。`exports` 只开放包入口，`src/` 不进入分发包。

## 内容写法

```ts
import { document, entity, role, architecture } from '@visualize/semantic';

const processor = role({ id: 'processor', label: '业务处理' });
const api = entity({
  id: 'api', label: 'API 服务', description: '接收业务请求',
  tags: [{ id: 'public-api', label: '公开接口' }]
});
const orders = entity({ id: 'orders', label: '订单模块', tags: [{ id: 'domain-module', label: '业务模块' }] });

const chart = architecture({
  id: 'order-system',
  title: '订单系统的组件与依赖',
  nodes: [
    { entity: api, role: processor, position: { x: 0, y: 0 }, size: { width: 220, height: 88 } },
    { entity: orders, role: processor, position: { x: 360, y: 0 }, size: { width: 220, height: 88 } }
  ],
  relations: [{ id: 'submit-order', from: api, to: orders, label: '提交订单' }]
});

export default document()
  .markdown('# 订单系统\n\n点击节点查看标签、角色和关系。')
  .diagram(chart);
```

把脚本保存在安装了该包的项目中，例如 `report.ts`，然后运行：

```sh
pnpm exec visualize report.ts --check
pnpm exec visualize report.ts -o output/report.html
```

`label` 是显示名称，`tags` 是分类标签。详情面板展示这些标签，以及从图中提取的角色、所属分区和关系，不接受 Markdown 正文或任意属性字典。架构节点与时序参与者都必须声明 `size: { width, height }`；文字或分区内节点放不下时返回诊断，不自动放大。

`partition` 表示逻辑分区，声明在架构图的 `partitions` 中；节点用 `partition` 字段引用所属分区。它显示为虚线框，不进入实体列表，不承担角色或参与连线。完整写法见 [架构图 API](references/api.md#架构图与逻辑分区)。

去掉 `.markdown()` 即得到单图，没有模式开关。链式调用返回新文档，支持从同一个基础文档派生不同报告。

## 入口

- [Skill 操作手册](SKILL.md)：给 AI 的内容组织与生成流程。
- [SDK 接口](references/api.md)：图表语义、Markdown 内容边界、诊断与容量边界。
- [架构说明](docs/architecture.md)：模块责任、内部数据与确定性范围。
- [自我解释示例](examples/self-explanation.ts)：架构与时序共享身份和标签，并组合成报告。

`pnpm build` 生成 SDK 与类型声明，`pnpm typecheck` 随后检查示例和测试。打包前会自动运行这两步。分发测试会把实际 tarball 安装进独立目录，检查包名导入、类型约束和 CLI。Skill 手册随包分发，尚未注册到全局 Skill 目录。
