# 公共 API

内容脚本从 Skill 目录的 `src/index.ts` 导入接口。生成与 Codex 展示方式见 [SKILL.md](../SKILL.md)。

| 图表                     | 参考                      | 示例                                           |
| ------------------------ | ------------------------- | ---------------------------------------------- |
| 组件、依赖和分区         | [架构图](architecture.md) | [architecture.ts](../examples/architecture.ts) |
| 同步调用、返回和互斥分支 | [时序图](sequence.md)     | [sequence.ts](../examples/sequence.ts)         |
| 活动、泳道、交接和回退   | [泳道图](swimlane.md)     | [swimlane.ts](../examples/swimlane.ts)         |

## 图表与输出

| 调用                    | 返回值                            | 行为                                       |
| ----------------------- | --------------------------------- | ------------------------------------------ |
| `architecture(options)` | `ArchitectureChart<Entity, Role>` | 创建架构图声明                             |
| `sequence(options)`     | `SequenceChart<Entity, Role>`     | 创建时序图声明                             |
| `swimlane(options)`     | `SwimlaneChart<Entity, Role>`     | 创建泳道图声明                             |
| `compile(diagram)`      | `{ semantic, scene }`             | 检查语义和布局，返回单张图的语义与几何结果 |
| `render(diagram)`       | HTML 片段字符串                   | 执行完整检查并渲染，不写文件               |

`Diagram` 表示由 SDK 创建的完整图表声明。`Chart` 表示实体和职责已替换为标识的图表数据。`SemanticDiagram` 意为“图表语义数据”，包含 `version`、`entities`、`roles` 和单个 `chart`。`scene` 是画布、节点与连线的几何结果，按图表种类另含分区、泳道、生命线或执行区间。

声明和语义数据均不可变，可以 JSON 序列化；`compile()` 和 `render()` 只接受 SDK 创建的图表，不接受普通 JSON、数组或正文。直接默认导出一张图：

```ts
import { architecture, entity, role } from "<skill>/src/index.ts";

const caller = entity({ id: "caller", label: "调用方" });
const service = entity({ id: "service", label: "服务" });
const component = role({ id: "component", label: "系统组件" });

export default architecture({
  id: "request-path",
  title: "请求路径",
  nodes: [
    { entity: caller, role: component, position: { x: 0, y: 0 }, size: { width: 200, height: 80 } },
    {
      entity: service,
      role: component,
      position: { x: 320, y: 0 },
      size: { width: 200, height: 80 },
    },
  ],
  relations: [{ id: "request", from: caller, to: service, label: "请求" }],
});
```

HTML 片段展示一张图及其图例，包含所需样式和交互。样式引用 Codex 提供的 CSS 主题变量，自动随应用配色和明暗模式更新，不需要重新生成图表。

## 对象与职责

`entity(options)` 创建对象，`role(options)` 创建职责。两者返回只读数据，可在多个图表声明中复用；每张图独立检查和渲染，不建立跨图导航或共享页面状态。

| `entity()` 字段 | 必填 | 含义                     |
| --------------- | ---- | ------------------------ |
| `id`            | 是   | 对象标识                 |
| `label`         | 是   | 非空显示名称             |
| `description`   | 否   | 单行摘要，最多 80 个字符 |
| `tags`          | 否   | 分类标签数组，默认 `[]`  |

每个标签只有 `id`、`label` 两个字段。一个对象最多 8 个标签，标签名称最多 24 个字符。摘要和标签不能包含换行、制表符或首尾空白。所有文字均按字面处理，没有富文本或正文解析入口。

`role()` 只有必填的 `id` 和 `label`。每张图最多 6 种职责，按标识排序对应宿主的 `--viz-series-1` 到 `--viz-series-6` 分类色。不同图中的职责集合不同，颜色可能重新分配；颜色不表示跨图身份。

架构和泳道节点显示名称与可选摘要，时序参与者显示名称。`tags` 保留在对象数据中，当前图形不展示标签，也不提供节点详情入口。

所有标识遵循 `^[a-z][a-z0-9-]*$`，例如 `order-api`。一张图内，同名对象、职责或标签必须有一致的定义；同一对象只能出现一次，可以连接多条关系。关系、消息和条件分支的标识在本图内唯一。参数对象只接受文档列出的字段。

## 关系样式

`variant` 意为关系的“样式预设”，适用于架构关系、泳道流转以及时序调用和返回。它是可选字段，省略时使用 `default`；SDK 创建的只读关系和 `compile()` 输出均保留明确的 `variant`。类型 `RelationVariant` 是以下五个名称的联合类型。不接受任意颜色或 CSS 样式。

| `variant`  | 用途                 | 颜色 token       | 线宽 | 线型                            |
| ---------- | -------------------- | ---------------- | ---- | ------------------------------- |
| `default`  | 普通连接             | `--viz-series-1` | 1.5  | 实线                            |
| `emphasis` | 重点连接，文字也加粗 | `--viz-series-5` | 2.5  | 实线                            |
| `security` | 安全相关连接         | `--red`          | 1.5  | 实线                            |
| `dashed`   | 虚线连接             | `--viz-series-1` | 1.5  | 短虚线，线段 5、间隔 4          |
| `external` | 外部连接             | `--viz-series-3` | 1.5  | 点划线，线段与间隔为 8、3、2、3 |

尺寸是缩放前的画布单位。实际色值随宿主主题变化；`security` 使用主题红色，其余分类色不绑定固定色相。关系文字应说明实际含义，不能只靠颜色表达语义。悬停时保留预设颜色和线型，线宽增加 1、文字加粗，并强调两个端点。

```ts
relations: [{ id: "authorize", from: caller, to: service, label: "校验权限", variant: "security" }];
```

时序消息仍由 `replyTo` 决定是否返回。调用使用实心箭头，线型取自预设；返回始终使用开口箭头和短虚线，颜色、线宽和字重仍取自自身预设。调用和返回分别声明 `variant`，不自动继承。`alternative` 条件片段不接受 `variant`。五种预设的完整对比见 `examples/relation-variants.ts`。

## 关系连接边

架构图和泳道图的关系可声明 `fromSide`（起点连接边）和 `toSide`（终点连接边）。类型 `RelationSide` 包含 `top`、`right`、`bottom`、`left`，分别表示节点矩形的上、右、下、左边。字段彼此独立，均可省略；省略的一端由算法选择，不填写 `auto`。

```ts
relations: [
  {
    id: "authorize",
    from: caller,
    to: service,
    label: "校验权限",
    variant: "security",
    fromSide: "right",
    toSide: "left",
  },
];
```

示例从起点右边的中点出发，进入终点左边的中点。`toSide: 'left'` 指终点的左边界，箭头从左向右进入节点。连接边相对于节点自身，不是所属分区或泳道。

声明的连接边是必须满足的约束。布线在这些边之间继续选择转折、避障和标签位置；不会移动节点、忽略指定边或改变 `variant`。无法找到可用路线时返回 `RELATION_LAYOUT`，诊断包含指定的边，提示调整连接边、节点位置或留白。节点位置仍以 `position` 为准，起止边不规定中间路线从哪个方向绕行。

自循环必须使用不同的起止边；两端显式声明同一边会返回 `RELATION_SIDE_CONFLICT`。非法边名返回 `INVALID_RELATION_SIDE`。时序调用、返回和条件片段不接受这两个字段，仍连接生命线与执行条。

SDK 的只读关系、语义数据和布局中的关系保留已声明的边；省略的边保持省略，实际连接点见 `scene.edges[].points`。完整示例见 `examples/relation-sides.ts`。

## 容器宽度

`compile(diagram)` 计算声明的几何布局，`render(diagram)` 只输出这一份 SVG。图形使用固定的 `viewBox` 和 `max-width: 100%; height: auto`，在容器比画布窄时等比例缩小，容器变宽后恢复，最大保持原始尺寸。片段两侧各留 16 像素。

节点、分区、泳道、连线和文字一起缩放，不重新排列或布线，也不切换为其他视图。窄容器中的文字会变小。标题和角色图例保持正常字号，并按需要换行。图表高度按缩放比例自然变化，不限制区域高度，也不引入内部滚动。

`--check` 检查声明和同一份几何布局，不写出文件。

## 主题

颜色 token 是按用途命名的 CSS 变量。文字使用 `--foreground`，次要文字、生命线与结构边界使用 `--muted-foreground`，背景使用 `--background`，边界使用 `--border`。节点边框与图例使用六个 `--viz-series-*` 分类色；节点底色由 10% 分类色与 90% 背景色混合得到。关系线、箭头和关系文字使用关系自身 `variant` 的颜色，不依据起点、终点或节点职责分配颜色。悬停时保留该颜色，通过线条与文字加粗、弱化无关关系来强调连接。分类色并不保证始终是某个固定色相。

Codex 注入这些变量并同步主题变化；生成器只输出变量引用，不读取机器的明暗设置，不增加主题切换脚本或锁定浅色。HTML 片段的颜色依赖宿主主题环境，浏览器预览也需要提供同一套变量。几何尺寸与文字排版不受主题切换影响。

## 交互

| 操作                   | 结果                                                         |
| ---------------------- | ------------------------------------------------------------ |
| 悬停或键盘聚焦节点     | 强调本节点、直接相邻节点和相连关系，弱化其余部分；只扩展一层 |
| 悬停关系线或关系文字   | 仅强调当前关系及其起点和终点，弱化其余部分                   |
| 移开鼠标并移走键盘焦点 | 恢复常态                                                     |

交互脚本不改变宿主页面、地址片段或浏览器历史，不请求网络。图表随容器宽度等比例缩小，避免横向滚动条；文字的实际显示大小随缩放比例变化。

## 诊断与 CLI

声明检查字段和类型，编译继续检查身份一致性、关系端点、调用生命周期及几何布局。错误抛出 `DiagnosticError`，其 `diagnostics` 含 `code`、`path`、`message`、`hint`。

常见诊断包括 `INVALID_DIAGRAM`、`UNKNOWN_FIELD`、`IDENTITY_CONFLICT`、`UNKNOWN_ENDPOINT`、`NODE_CONTENT_FIT`、`PARTITION_CONTENT_FIT`、`LANE_CONTENT_FIT`、`NODE_OVERLAP`、`REGION_OVERLAP`、`RELATION_LAYOUT`。时序错误如 `UNFINISHED_CALL`、`RETURN_ORDER`、`BRANCH_EXECUTION_MISMATCH` 表示调用模型需要修正。具体修改方式以诊断为准。

```sh
node "<skill>/src/cli.ts" diagram.ts -o diagram.html
node "<skill>/src/cli.ts" diagram.ts --check
```

CLI 接收一个内容脚本及 `-o` / `--output`、`--check`、`-h` / `--help`。成功时 stdout 输出 JSON：检查为 `{ "ok": true, "diagram": "图表标识" }`，生成结果为 `{ "ok": true, "output": "输出绝对路径" }`。失败时 stderr 输出 `{ "ok": false, "diagnostics": [...] }`，退出码为 1。输入脚本日志应写 stderr。

`--check` 即使同时传入 `-o` 也不写文件。生成先写临时文件，再原子替换目标；失败保留已有产物。输出路径不能与输入相同。

CLI 执行普通本地 ES module，具有 Node 进程权限，不提供代码隔离。Node 运行 `.ts` 时只移除类型，不做类型检查。
