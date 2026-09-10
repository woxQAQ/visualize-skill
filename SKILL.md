---
name: visualize-skills
description: 将系统架构、组件依赖和同步调用过程制作成可离线阅读的交互式 HTML。用户要求绘制架构图、时序图，或结合图表与文字解释技术方案时使用。支持单图、多图报告和节点关联导航，不用于统计图表或网页界面制作。
---

# 用图说明系统

使用随 Skill 提供的 TypeScript 接口，交付可离线阅读的 HTML 和生成它的内容脚本。

## 内容组织

结构问题用架构图，过程问题用时序图。需要两种视角时，跨图复用同一对象。每张图围绕一个问题组织，图外文字说明背景和结论，图内名称与关系标签保持简短、具体。

按需查阅 [API 索引](references/api.md)：[架构图](references/architecture.md)、[时序图](references/sequence.md)、[Markdown](references/markdown.md)。完整组合示例见 [self-explanation.ts](examples/self-explanation.ts)。

对象表示实际组件；分区按共同职责或归属对组件分组，例如功能相近的组件或部署在同一区域的组件。分区名称应说明分组依据，分区本身不作为连线端点。

节点尺寸与架构位置由内容脚本声明，生成器不会自动扩容或重排。时序调用必须配对返回。

## 生成

需要 Node.js 22.18+，直接运行源码，无需安装依赖或 build。

在用户工作目录编写 `report.ts`：从本 Skill 的 `src/index.ts` 导入接口，相对路径以 `report.ts` 所在目录为基准，默认导出由 `document().markdown(...).diagram(...)` 组合的文档。只追加一张图即可生成单图。

将 `<skill>` 替换为本 Skill 目录的路径，运行。命令中的相对路径以终端当前目录为基准：

```sh
node "<skill>/src/cli.ts" report.ts -o report.html
```

生成时自动检查内容与布局。失败后按诊断修改内容脚本，再次运行；不要修改生成的 HTML 来绕过问题。

## 检查与交付

打开 HTML 检查文字、连线、分区和调用顺序，以及节点详情与关联定位。修改后重新生成。交付 HTML 和内容脚本的链接；HTML 已内嵌样式与交互，无需服务器。
