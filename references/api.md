# SDK 接口

安装分发包后，所有 API 从 `@visualize/semantic` 导入。仓库示例也使用这个入口。用户不用知道 `src/` 或 `dist/` 的内部路径。安装方式见 [分发与使用](../README.md#分发与使用)。

## 文档与输出

```ts
import { document, render, compile } from '@visualize/semantic';

const base = document().markdown('# 系统说明');
const report = base.markdown('解释内容。').diagram(chart);

export default report;

// 嵌入其他 Node 程序时可以直接调用：
const html = render(report);
const { semantic, scenes } = compile(report);
```

`document()` 创建不可变文档。`.markdown(source)` 和 `.diagram(chart)` 返回新文档；调用顺序就是阅读顺序。循环追加时写 `result = result.diagram(chart)`。未加入文档的图表不会出现在产物里。

`render()` 返回完整 HTML 字符串；`compile()` 检查内容和布局并返回语义文档与图表几何结果，不写文件。`report.toJSON()` 只生成可序列化的语义文档，不执行完整检查。HTML 内嵌系统提供的节点详情交互脚本，不包含内容作者的脚本、外部字体或网络资源。

单图无需模式参数：`export default document().diagram(chart)`。纯 Markdown、多图而无文字也可以输出。

## TypeScript 检查

SDK 和 CLI 源码使用 TypeScript，`pnpm build` 生成 `dist/` 下的 JavaScript 与 `.d.ts`。`package.json` 的 `exports` 同时提供运行入口与类型入口，CLI 名称为 `visualize`。`pnpm typecheck` 先构建再执行 `tsc --noEmit`，开启 `strict` 和 `erasableSyntaxOnly`，覆盖源码、示例、测试和编译期契约检查。用户内容脚本可由 Node.js 22.18 及以上版本运行；运行 `.ts` 文件本身不执行类型检查。

`ArchitectureOptions` 和 `SequenceOptions` 是作者输入；`Entity` 是规范化后的共享对象；`SemanticDocument` 是可序列化的只读文档；`Scene` 是布局结果。`Step` 通过 `kind` 区分调用、返回和条件分支。需要这些类型时使用 `import type` 从 SDK 入口导入。JavaScript 调用、动态加载的输入仍经过运行时校验。

## 共享身份与角色

```ts
import { entity, role } from '@visualize/semantic';

const api = entity({
  id: 'api',
  label: 'API 服务',
  description: '接收请求并组织处理', // 可省略，作为图内摘要
  tags: [{ id: 'public-api', label: '公开接口' }] // 可省略，点击后按标签展示
});
const database = entity({ id: 'database', label: '数据库' });
const compute = role({ id: 'compute', label: '业务处理' });
const storage = role({ id: 'storage', label: '持久存储' });
```

`entity` 表示对象身份；`role` 表示图中的职责。`label` 是对象的显示名称，`tags` 是分类标签，每项只有 `id` 和 `label`。同一标签标识在文档内必须对应同一名称，一个对象不能重复声明同一标签。标签最多 8 个，名称最多 24 个字符，必须为单行短文本。`description` 仅为最多 80 个字符的单行图内摘要。

详情面板展示对象标识、标签，以及从各图提取的角色、所属分区和关系；这些属性不参与节点几何计算。没有独立的详情正文，也不接受 `details`、`metadata` 或任意字段。标签按普通文本渲染，不解析 Markdown。新增信息类型应声明明确的字段和语义，不能把说明正文包装成 JSON 后塞入属性。

点击图中节点或对象引用，会打开同一份详情。节点以悬停和键盘焦点高亮提示交互，没有可见的“查看详情”文字。Escape 或关闭按钮关闭面板并归还焦点。禁用 JavaScript 时，链接指向文末的可展开节点资料。标识符以小写英文字母开头，只含小写英文字母、数字和连字符。同一标识的对象定义在整份文档中必须一致；同一对象在不同图里可以承担不同角色。角色颜色在文档内统一分配，角色标签同时出现在图例中。

每张图的 `nodes` 或 `participants` 显式声明对象、角色和 `size: { width, height }`。尺寸为大于零的有限数字。关系中的 `from`、`to` 可以传对象或标识字符串，但引用对象必须出现在当前图中。

## 架构图与逻辑分区

```ts
import { architecture } from '@visualize/semantic';

const chart = architecture({
  id: 'order-architecture',
  title: '订单系统的逻辑分区与依赖',
  partitions: [
    { id: 'order-domain', label: '订单业务', position: { x: 0, y: 0 }, size: { width: 620, height: 200 } }
  ],
  nodes: [
    { entity: api, role: compute, partition: 'order-domain', position: { x: 0, y: 0 }, size: { width: 220, height: 88 } },
    { entity: database, role: storage, partition: 'order-domain', position: { x: 340, y: 0 }, size: { width: 220, height: 88 } }
  ],
  relations: [{ id: 'write-order', from: api, to: database, label: '保存订单' }]
});
```

`Partition` 表示逻辑区域，只包含 `id`、`label`、`position` 和 `size`，其中名称最多 48 个字符。它是图内的分组声明，不进入文档的 `entities`，没有角色、标签或详情面板，也不能作为连线端点。相同分区标识不能在一张图中重复，每个分区至少有一个节点。没有分区时可以省略 `partitions`。

节点通过 `partition: 分区标识` 声明归属，未指定则位于画布根层。分区本身不嵌套，实体之间没有容器关系。节点详情展示“所属分区”的名称。`relations` 表示实体之间的有向依赖或作用，允许循环、自依赖和多条不同关系；没有依赖时显式写 `relations: []`。

架构节点和分区都必须声明 `position: { x, y }` 与 `size: { width, height }`。坐标为非负有限数字，尺寸为正有限数字，单位是 SVG 用户单位；当前输出一单位对应一个 CSS 像素。根节点和分区相对于画布内容原点，分区内节点相对于该分区的内容区域。画布边距为 32 像素；分区标题区为文字高度加 24 像素，内容区还有 24 像素内边距。

宽高严格采用声明值。节点文字放不下返回 `NODE_CONTENT_FIT`，超过文字行数上限返回 `LABEL_CAPACITY`；节点超出分区或分区标题放不下返回 `PARTITION_CONTENT_FIT`。分区之间、分区与根节点之间不能重叠，节点之间也必须留出至少 12 像素间距。系统不会自动放大、移动或截断内容。横向排布建议留出约 100 像素或更多间隔，以容纳关系标签。

连接采用直线或正交折线，标签直接放在对应线段旁。路由避开节点、分区标题和已放置的标签，允许穿过分区的虚线边界。如果没有可用通道，返回 `RELATION_LAYOUT`，由作者调整位置。颜色、字号、形状和 CSS 不开放给内容脚本。

## 时序图

```ts
import { sequence } from '@visualize/semantic';

const chart = sequence({
  id: 'save-sequence',
  title: '保存订单的交互顺序',
  participants: [
    { entity: api, role: compute, size: { width: 160, height: 56 } },
    { entity: database, role: storage, size: { width: 160, height: 56 } }
  ],
  steps: [
    { id: 'save', from: api, to: database, label: '写入订单' },
    {
      id: 'result',
      kind: 'alternative',
      branches: [
        {
          label: '写入成功',
          steps: [{ id: 'saved', from: database, to: api, label: '返回订单编号', replyTo: 'save' }]
        },
        {
          label: '写入失败',
          steps: [{ id: 'failed', from: database, to: api, label: '返回错误', replyTo: 'save' }]
        }
      ]
    }
  ]
});
```

参与者按声明顺序横向排列，采用各自声明的宽高，相邻边界间隔为 40 像素；标题框仅显示名称。生命线从各自标题框底部开始，首条消息位于最高标题框下方。消息按 `steps` 顺序向下排列。普通消息表示同步调用，实线实心箭头指向接收者；接收时开始执行条。带 `replyTo` 的消息表示返回，使用虚线空心箭头，并在发送时结束对应执行条。

每次调用必须有对应返回；返回端点与调用相反，先返回内层调用。正在等待同步调用的参与者不能同时发起另一调用。`from` 与 `to` 相同表示自调用，嵌套执行条横向错开。当前只支持有明确返回的同步调用，不将异步消息套用这套生命周期。

互斥条件分支必须以相同的调用状态结束。例如，两个分支都返回外层调用，或都保持外层调用，统一在分支之后返回。分支内发起的调用不能被另一分支引用。跨分支的同一次外层执行会分段绘制，分别显示各条路径上的执行终点。

条件片段使用 `kind: 'alternative'`，每个分支包含条件标签与非空 `steps`。消息与条件片段的 `id` 在一张图中共同保持唯一。条件区域使用标准 `alt` 标签和方括号条件。当前不支持循环片段或并发片段，不要用条件分支冒充这些语义。

## 报告 Markdown 范围

Markdown 仅用于文档的 `.markdown()` 块，不用于节点属性。使用 `mdast-util-from-markdown` 解析 CommonMark，再转换为报告内容结构；不直接使用解析器生成的 HTML。

- 标题、段落、嵌套强调、行内代码、换行、分隔线和引用块。
- 有序与无序列表，支持嵌套列表及列表项内的多个段落，保留有序列表起始值。
- 反引号、波浪号或缩进代码块，保留语言标记；不执行代码。
- 普通链接、引用式链接、自动链接，地址限于 http、https、mailto。
- `[对象](entity:api)` 打开对象属性，`[架构](diagram:order-architecture)` 引用图表；支持在引用块和列表中检查这些引用。
- CommonMark 的字符转义、字符实体及 Setext 标题。

模板字符串会去除共同空格缩进。其余语法按 CommonMark 处理，例如未闭合的围栏代码块延续到输入末尾。原始 HTML 和图片仍产生带源文件行号的诊断，代码块中的 HTML 作为文本转义。不启用 GFM 扩展（GitHub 增加的表格、任务列表、删除线等语法），这些扩展写法按普通 CommonMark 内容处理。

## 容量与错误

| 范围 | 限制 |
| --- | --- |
| 每个对象的标签 | 最多 8 个，每个名称最多 24 个字符 |
| 对象的图内摘要 | 最多 80 个字符，单行 |
| 整份文档的角色 | 最多 6 种 |
| 架构图对象 | 每图最多 12 个 |
| 架构图关系 | 每图最多 16 条 |
| 架构分区 | 不嵌套，每个分区至少有一个节点 |
| 时序参与者 | 最多 6 个 |
| 时序消息 | 最多 32 条调用与返回 |
| 同一参与者的执行嵌套 | 最多 4 层 |
| 时序条件片段嵌套 | 最多 3 层 |
| 布局尺寸 | 最大 1280 × 2600 |

标签和说明有行数限制，具体诊断会指出位置。容量是当前布局的阅读边界；修改限制需要一同验证布局，而不是绕过检查。宽图在小屏幕内横向滚动，不压缩字号。图表字体使用系统等宽字体与固定字符前进宽度，详情见 [架构说明](../docs/architecture.md)。

SDK 抛出 `DiagnosticError`，其 `diagnostics` 数组包含 `code`、`path`、`message`、`hint`。语义检查会尽可能汇总多个问题；声明语法或布局错误在检测处立即返回。

CLI 成功时向 stdout 输出 JSON，失败时向 stderr 输出诊断 JSON 并以 1 退出。`--check` 检查语义与布局，不写文件；构建先生成完整 HTML，再原子替换目标文件，失败时保留旧产物。脚本输出日志时应写 stderr，避免与 CLI 成功 JSON 混合。
