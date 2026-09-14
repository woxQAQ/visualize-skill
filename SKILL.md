---
name: visualize-skills
description: 解释软件架构、项目如何运作或调用流程时，按问题选择或组合交互式架构图、时序图和泳道图，分别说明组件关系、调用过程与负责方之间的活动流转，无需用户明确要求画图。可嵌入对话或生成独立 HTML。不用于统计图表、界面设计或简单事实问答。
---

# 生成交互图表

使用随 Skill 提供的 TypeScript SDK 声明图表，生成包含样式与交互的 HTML 文件。背景和结论写在正常回复里。执行生成需要能够运行 Node 和写文件的环境。

介绍项目运行机制、梳理模块职责或解释一次请求的调用路径时，如果读者需要在多个参与方及其关系之间追踪，主动用图辅助讲解。先从代码或运行证据确认关系，再选择图表；简单事实或一步操作用文字即可。

## 选择图型并读取类型

先确定讲解需要回答哪些问题，再读取所选图型的 `src/<diagram>/index.ts`。`<diagram>` 是图型目录名，对应 `architecture`、`sequence` 或 `swimlane`。接口及字段的英文 JSDoc 说明输入语义、默认值、坐标基准和约束，作为声明图表时的依据。

| 要表达的内容                       | 读取的源码                                         | 示例                                        |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| 有哪些组件，如何分组和依赖？       | [architecture/index.ts](src/architecture/index.ts) | [architecture.ts](examples/architecture.ts) |
| 谁先发送消息，是否等待，何时响应？ | [sequence/index.ts](src/sequence/index.ts)         | [sequence.ts](examples/sequence.ts)         |
| 每项活动由谁负责，如何交接或回退？ | [swimlane/index.ts](src/swimlane/index.ts)         | [swimlane.ts](examples/swimlane.ts)         |

从所选图型的 `ArchitectureOptions`、`SequenceOptions` 或 `SwimlaneOptions` 开始，沿字段类型阅读节点、分区、泳道或消息的定义。继承的 `Participant` 字段，以及对象、职责、尺寸和关系等共用类型，读取 [shared/model.ts](src/shared/model.ts)。`Chart` 表示规范化后的图表数据；`Scene` 和名称以 `Layout` 结尾的类型描述生成结果，用于检查布局。

每张图围绕一个问题。讲解同时涉及系统组成和运行过程时，分别考虑架构图和时序图：前者说明职责与依赖，后者展开一次具体请求的调用与返回。新增图应补充已有图未表达的信息；图的数量由问题决定，不固定为一张，也不为凑数量重复画图。

多张图分别编写内容脚本并生成文件，使用一致的组件名称，在对应讲解处逐张展示。时序图表达单条同步调用栈及穿插的异步消息；条件分支、循环或并行执行按具体执行路径拆图，并在正文说明范围。泳道关系可以用条件标签表达流转，但不校验条件互斥性或并行执行语义。

## SDK 使用

在任务工作目录编写 `diagram.ts`，从本 Skill 的 [src/index.ts](src/index.ts) 导入函数和类型。该文件是统一导入入口；各图型目录的 `index.ts` 提供类型定义。将下面的 `<skill>` 替换为本 Skill 的实际绝对路径，默认导出一个图表构造函数的返回值：

```ts
import { architecture, entity, role } from "<skill>/src/index.ts";

const caller = entity({ id: "caller", label: "调用方" });
const service = entity({ id: "service", label: "服务" });
const component = role({ id: "component", label: "系统组件" });

export default architecture({
  id: "request-path",
  title: "请求路径",
  nodes: [
    {
      entity: caller,
      role: component,
      position: { x: 0, y: 0 },
      size: { width: 200, height: 80 },
    },
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

| 调用                    | 用法与返回值                                                 |
| ----------------------- | ------------------------------------------------------------ |
| `entity(options)`       | 创建只读对象定义，使用 `EntityInput`；可在多个图表中复用     |
| `role(options)`         | 创建只读职责定义，使用 `Role`；职责用于图例与节点配色        |
| `architecture(options)` | 使用 `ArchitectureOptions` 创建架构图声明                    |
| `sequence(options)`     | 使用 `SequenceOptions` 创建时序图声明                        |
| `swimlane(options)`     | 使用 `SwimlaneOptions` 创建泳道图声明                        |
| `compile(diagram)`      | 检查语义和布局，返回 `{ semantic, scene }`                   |
| `render(diagram)`       | 执行完整检查，返回继承宿主主题的 HTML 片段字符串，不写文件   |
| `renderPage(diagram)`   | 执行完整检查，返回含默认主题的完整 HTML 页面字符串，不写文件 |

节点和参与者的 `entity`、`role` 使用完整定义，通常复用 `entity()`、`role()` 的返回值。关系和消息的 `from`、`to` 接受对象或其标识，但对象仍须先出现在本图的节点或参与者中。分区和泳道只组织节点，不能作为关系端点。一个负责方执行多个活动时，为活动创建不同对象并使用同一个 `lane`。

所有标识使用小写字母开头的稳定名称，匹配 `^[a-z][a-z0-9-]*$`。同一图内复用标识时定义须一致，同一对象只能出现一次。名称和关系标签保持简短，文字按字面处理。对象摘要可用于架构和泳道节点；时序参与者只显示名称，标签当前仅保留在数据中。

`variant` 使用源码声明的预设，省略时为 `default`。架构与泳道关系使用 `RelationVariant`，时序消息使用 `MessageVariant`，两者的含义分别定义。时序同步调用必须配对 `return` 响应并声明 `replyTo`；`dashed` 异步消息不要求响应。架构和泳道关系可用 `fromSide`、`toSide` 限定节点连接边，省略的一端由路由选择。

图表声明由 SDK 创建并冻结。`compile()`、`render()` 和 `renderPage()` 接受构造函数返回的 `Diagram`，普通对象或 JSON 反序列化结果不能直接传入。`semantic` 将对象和职责集中存储，图表通过标识引用；`scene` 包含计算后的画布、节点与连线几何。需要检查这些返回值时，读取 [src/model.ts](src/model.ts) 及所选图型的场景类型。

## 布局与表达

节点尺寸、架构与泳道节点位置须显式声明，局部原点以字段注释为准。先按主要流程确定行或列的中心线：上下直连对齐画布坐标中的 `x + width / 2`，左右直连对齐 `y + height / 2`。跨分区或泳道时计入容器原点，避免只对齐局部坐标或节点边缘。

给文字、区域标题和连线路径留白。生成器保留声明的位置和尺寸，无法容纳内容或完成路由时返回诊断。架构与泳道连线可以跨越区域边界，标签须避开边框。画布最多宽 1280、高 2600 个单位；容器变窄时整张图和文字一起等比例缩小，因此内容过密时应按问题拆图。

需要组合声明时按需读取示例：[时序参与者分区](examples/sequence-partitions.ts)、[同步与异步消息](examples/message-variants.ts)、[关系预设](examples/relation-variants.ts)、[指定连接边](examples/relation-sides.ts)。示例的相对导入以示例文件位置为基准，复制到任务目录时调整路径。

## 生成与展示

需要 Node.js 22.18+，无需安装依赖或 build。Node 直接运行 TypeScript 时只移除类型，不执行静态类型检查；SDK 和生成流程负责运行时校验。

先按交付位置选择格式：

- **Codex 对话内展示**：当前任务提供了 visualization 可写目录，或宿主说明支持原生可视化引用时，读取并执行 [Codex 展示](references/codex.md)。生成 `fragment`，并在本轮最终回复中输出内容引用，才完成展示。
- **独立浏览器页面或文件交付**：生成 `page` 并提供文件链接。用户明确要求独立文件时也走此流程。

`fragment` 是继承宿主主题的嵌入片段，`page` 是包含全部样式和交互的独立页面。两种格式共用同一份图表声明。将 `<skill>` 替换为本 Skill 的绝对路径：

```sh
node "<skill>/src/cli.ts" diagram.ts --format page -o output/diagram.html
node "<skill>/src/cli.ts" diagram.ts --check
```

CLI 接收一个内容脚本，生成时用 `-o` 或 `--output` 指定文件，用 `--format page|fragment` 选择格式；省略格式时生成片段。`--check` 检查语义与布局，不写文件。内容脚本直接默认导出一张图，多张图分别调用 CLI。

输出到任务工作目录下的 `output/`，或用户指定的位置；Codex 片段的路径遵循展示流程。内容脚本的相对导入以脚本位置为基准，命令的相对路径以当前工作目录为基准。`page` 可直接在浏览器中打开，无需服务器或联网，默认配色跟随浏览器明暗偏好。环境支持时打开预览。

## 检查与调整

CLI 成功时向 stdout 输出 JSON：检查返回 `{ "ok": true, "diagram": "图表标识" }`，生成返回 `{ "ok": true, "output": "输出绝对路径" }`。失败时向 stderr 输出 `{ "ok": false, "diagnostics": [...] }` 并以状态码 1 退出。内容脚本的日志写入 stderr，避免混入结果。

直接调用 SDK 时，错误抛出 `DiagnosticError`；其 `diagnostics` 中每项包含 `code`、`path`、`message`、`hint`，定义见 [diagnostics.ts](src/diagnostics.ts)。按错误代码、字段位置和建议修改声明后重新生成，不修改 HTML 绕过检查。CLI 只在生成成功后替换目标文件；输出路径不能与输入相同。

确认生成文件完整，并检查实际展示中的文字可读性、连线和区域边界。悬停或键盘聚焦节点会强调直接相邻的节点和关系；悬停关系会强调其两个端点。检查窄容器中的阅读效果，必要时缩短标签或拆图。

文字或连线放不下时，按诊断调整节点尺寸、位置或留白。预期直连却出现折线时，检查节点中心是否对齐，以及标签和区域标题是否占用了连接空间。
