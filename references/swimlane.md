# 泳道图

`swimlane()` 表达活动在不同负责方之间如何流转。泳道从上到下排列，左侧显示负责的人、团队或系统，节点表示该负责方执行的活动。活动的 `role` 表示职责分类并决定颜色，`lane` 表示本图中的负责方归属。

```ts
import { document, entity, role, swimlane } from '../src/index.ts';

const activity = role({ id: 'activity', label: '流程活动' });
const submit = entity({ id: 'submit', label: '提交申请' });
const review = entity({ id: 'review', label: '审核申请' });

export default document().diagram(swimlane({
  id: 'approval-flow', title: '申请与审核', width: 800, headerWidth: 200,
  lanes: [
    { id: 'applicant', label: '申请人', height: 200 },
    { id: 'reviewer', label: '审核人', height: 200 }
  ],
  nodes: [
    { entity: submit, role: activity, lane: 'applicant', position: { x: 32, y: 40 }, size: { width: 180, height: 80 } },
    { entity: review, role: activity, lane: 'reviewer', position: { x: 352, y: 40 }, size: { width: 180, height: 80 } }
  ],
  relations: [{ id: 'submit-review', from: submit, to: review, label: '提交审核' }]
}));
```

导入路径以内容脚本所在目录为基准。包含分支、回退及同泳道流转的完整示例见 [swimlane.ts](../examples/swimlane.ts)。

## 声明

| 字段 | 含义 |
| --- | --- |
| `id`、`title` | 图表标识和标题 |
| `width` | 所有泳道共用的总宽度，包含左侧标题栏，不包含画布外边距 |
| `headerWidth` | 所有泳道共用的左侧标题栏宽度，可选，默认 `144` |
| `lanes` | 按从上到下的顺序声明泳道，每条包含 `id`、`label`、`height` |
| `nodes` | 活动节点，每个包含 `entity`、`role`、`lane`、`position`、`size` |
| `relations` | 流转关系，每条包含 `id`、`from`、`to`、`label`；允许空数组 |

除 `headerWidth` 外，以上字段均必填。至少声明一条泳道和一个节点；每条泳道至少包含一个节点。泳道标识在当前图中唯一，名称为最多 48 字符的单行短文本，标题实际最多排 3 行。每个活动必须属于一条已声明的泳道，没有根节点或嵌套泳道。

泳道本身不进入共享对象表，没有 `role`、标签或详情，不能作为连线端点。一个负责方执行多个活动时，为各活动声明独立实体，并使用同一个 `lane`。节点详情展示所属泳道以及流入、流出关系，沿用共享实体、正文引用和关联节点定位。

关系端点可以是实体对象或标识字符串，必须在当前图中声明。节点和关系数组的顺序不表示执行顺序，方向由 `from`、`to` 决定。支持同泳道流转、跨泳道流转、自循环、回退和同端点多条关系。分支以多条出边及各自的条件标签表达，汇合以多条入边表达；当前不建模条件的互斥性或并行执行语义，也不提供 BPMN 事件和网关符号。

## 坐标与尺寸

节点的连接点固定为上、下、左、右四条边的中点。系统根据避障和标签空间选择连接侧，多条关系可以共用同一个中点；自循环连接同一节点的两个不同侧中点。

一单位对应一个 CSS 像素。`position` 的 `x`、`y` 为非负有限数字，`width`、`headerWidth`、`height` 和节点尺寸为正有限数字。

画布四周留 32 像素。泳道从画布内容原点依次向下紧邻排列，共用相同宽度，泳道高度严格采用声明值。左侧标题栏由图表级 `headerWidth` 控制，默认 144，标题左右各留 16 像素。所有泳道共用这一宽度，以保持标题栏边界对齐。

内容区四周各留 24；节点的 `position` 相对于内容区原点。第一条泳道中 `position: { x: 0, y: 0 }` 的节点画布坐标为 `{ x: 32 + headerWidth + 24, y: 56 }`。默认标题栏下为 `{ x: 200, y: 56 }`，设置 `headerWidth: 200` 后为 `{ x: 256, y: 56 }`。

`width` 包含标题栏。在总宽度不变时，增大 `headerWidth` 会压缩内容区，节点随内容原点右移；如需保留原有内容空间，同时增加 `width`。标题栏必须容纳文字与内边距，内容区必须容纳节点；设置过窄或过宽都会返回诊断，不会自动调整尺寸。

节点必须完整放在所属泳道的内容区中，节点间至少留 12 像素间距；连线和标签通常需要更多留白。系统不改变声明的位置和尺寸。路由可以穿过泳道分隔线，避开节点、标题栏和已放置的标签；连线及标签必须留在整组泳道的内容范围内。无法布线时返回 `RELATION_LAYOUT`，请增加空间或调整位置。

## 容量与诊断

每张图最多 12 个节点、16 条关系。节点名称最多 3 行，摘要最多 4 行，仍须满足声明尺寸。画布最大宽 1280、高 2600，包含四周边距，因此 `width` 最大为 1216，所有泳道高度之和最多为 2536。窄屏中图表横向滚动。

泳道错误包括 `DUPLICATE_LANE`、`EMPTY_LANE`、`UNKNOWN_LANE`、`LANE_CONTENT_FIT`；节点重叠、文字和图表容量等沿用共用诊断。使用 `compile()` 或 CLI 的 `--check` 完整验证语义与布局。
