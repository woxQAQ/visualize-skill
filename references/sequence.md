# 时序图

[公共接口](api.md) · [架构图](architecture.md)

`sequence(options)` 接收必填的 `id`、`title`、`participants` 和 `messages`。参与者和消息数组均不能为空。消息按数组顺序从上到下排列。可选的 `partitions` 声明参与者分区，省略时为 `[]`。

## 参与者

`SequenceParticipant` 表示时序参与者，包含 `entity`、`role`、`size` 和可选的 `partition`，不接受 `position`。`entity`、`role` 接收完整对象定义，不能只传标识字符串。`size` 为 `{ width, height }`，值须为正有限数字，一单位对应一个 CSS 像素。参与者按数组顺序横向排列，相邻边界间隔为 40；图内标题框显示名称，不显示对象摘要。

## 参与者分区

`SequencePartition` 表示时序参与者分区，将相邻的参与者按系统、职责或部署归属组织在一起。`sequence()` 用 `partitions` 声明分区，参与者用 `partition` 指定归属；分区范围由参与者排列和消息布局自动计算。

每个分区只声明 `id` 和 `label`，名称是最多 48 个字符的单行短文本。分区不进入实体表，没有角色、标签或详情，也不能作为消息端点。每个分区至少包含一个参与者；参与者可以不属于任何分区，当前不支持嵌套。

```ts
partitions: [
  { id: "backend", label: "服务端" },
],
participants: [
  { entity: client, role: caller, size: { width: 180, height: 64 } },
  { entity: service, role: handler, partition: "backend", size: { width: 180, height: 64 } },
  { entity: database, role: storage, partition: "backend", size: { width: 180, height: 64 } },
],
```

分区成员在 `participants` 中必须连续排列，布局保留原有顺序。`partitions` 数组顺序不改变参与者位置。未知引用、重复标识、空分区或不连续成员分别产生 `UNKNOWN_PARTITION`、`DUPLICATE_PARTITION`、`EMPTY_PARTITION`、`NONCONTIGUOUS_PARTITION` 诊断。

分区用浅色背景和虚线边框绘制，覆盖组内参与者标题及完整生命线。它不接受 `position` 或 `size`：宽度由成员的标题框与间距计算，高度随消息布局延伸。成员左右各留 14 像素，同组及跨组参与者之间仍保持 40 像素间距；相邻分区边框之间留 12 像素。

分区标题最多两行，所有参与者标题框在分区标题下方对齐。标题放不下时应缩短名称或增加参与者宽度。消息线可以跨越边界；标签在边框分隔出的可用区间内换行，背景与边框至少相隔 2 像素。分区不改变消息顺序、同步调用栈或异步语义。

完整示例见 [sequence-partitions.ts](../examples/sequence-partitions.ts)。

## 消息

`MessageInput` 是作者声明的消息，`Message` 是 SDK 规范化后的消息。二者都是单一接口，不拆成调用、响应或条件片段的联合类型，不继承 `Relation`。消息没有 `kind`、`fromSide`、`toSide` 或 `branches`，声明这些字段会报错。

| 字段         | 含义                                                           |
| ------------ | -------------------------------------------------------------- |
| `id`         | 图内唯一的消息标识                                             |
| `from`、`to` | 发送方和接收方，可用实体对象或标识引用，必须出现在当前参与者中 |
| `label`      | 消息名称或动作                                                 |
| `variant`    | 消息语义及其渲染预设，省略时规范化为 `default`                 |
| `replyTo`    | 响应关联的原消息标识，仅 `return` 使用且必须声明               |

`MessageVariant` 表示消息预设，独立于 `RelationVariant`。两者的可用值、含义、校验和样式表分别维护；消息不接受 `external`。

| `variant`  | 语义                               | 渲染                               |
| ---------- | ---------------------------------- | ---------------------------------- |
| `default`  | 普通同步调用                       | 前景色实线、实心箭头               |
| `dashed`   | 异步消息，发送方不等待响应即可继续 | 前景色长虚线、开口箭头             |
| `emphasis` | 主链路中的同步调用                 | 分类色加粗实线、实心箭头、加粗文字 |
| `return`   | 对先前消息的响应                   | 次要文字色短虚线、开口箭头         |
| `security` | 鉴权、权限或策略相关的同步调用     | 红色实线、实心箭头                 |

消息的 `variant` 同时决定执行语义和绘制方式，渲染不再读取独立的调用、返回类型或返回标志。它是单选预设，例如响应使用 `return`，不同时标为 `emphasis`。

```ts
messages: [
  { id: "authorize", from: caller, to: service, label: "校验权限", variant: "security" },
  { id: "log", from: service, to: audit, label: "异步记录", variant: "dashed" },
  {
    id: "authorized",
    from: service,
    to: caller,
    label: "权限结果",
    variant: "return",
    replyTo: "authorize",
  },
];
```

## 执行与响应

`default`、`emphasis`、`security` 开启接收方的执行条，按同步调用栈处理。每次同步调用都必须有 `return` 消息结束执行条；响应通过 `replyTo` 指向调用，端点与调用相反。先返回内层调用，再返回外层调用。同一参与者的自调用和递归通过横向错开的执行条表达。

`dashed` 不进入同步调用栈，不创建执行条，不要求响应。它可以穿插在同步调用之间，也可以使用后续 `return` 消息关联一个响应。异步响应不弹出同步调用栈、不关闭同步执行条。每条原消息最多关联一个响应，响应本身不能作为 `replyTo` 的目标。

`replyTo` 只建立响应关联，不能把 `default` 或其他预设隐式转换为响应。`return` 缺少 `replyTo`、其他预设携带 `replyTo`、引用未来消息或重复响应都会报错。

当前图表表达单条同步调用栈及穿插的异步消息，不建模多个并行执行栈。没有条件分支、循环片段或并发片段接口；需要这些内容时按具体执行路径拆图，并在正文说明范围。

完整调用示例见 [sequence.ts](../examples/sequence.ts)，五种消息预设与异步响应示例见 [message-variants.ts](../examples/message-variants.ts)。

## 文字与容量

消息标签优先写调用名称或动作，把不影响理解的参数列表和完整返回结构放进正文。检查编号加入后的实际断行，尤其是中英文混排和自调用；需要多行时保留完整术语，避免单字尾行。文本排版会在宽度允许时把中文单字尾行与前一个完整词合并，但不会理解所有领域术语，也不会跨越显式换行调整文本。

每张图最多 6 个参与者、32 条消息。同一参与者的同步执行最多嵌套 4 层。参与者名称最多排 3 行，并须放入声明尺寸。声明的画布最大宽 1280、高 2600。容器变窄时整张时序图等比例缩小，保留参与者排列、消息顺序、生命线、执行条和响应配对，详见[容器宽度](api.md#容器宽度)。
