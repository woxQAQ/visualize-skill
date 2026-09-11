import { document, entity, role, architecture, sequence } from "../src/index.ts";

const guidance = role({ id: "guidance", label: "内容指导" });
const declaration = role({ id: "declaration", label: "语义声明" });
const checking = role({ id: "checking", label: "规则检查" });
const presentation = role({ id: "presentation", label: "视觉生成" });
const artifact = role({ id: "artifact", label: "输出产物" });

const skill = entity({
  id: "skill",
  label: "Skill",
  description: "指导 AI 组织内容与关系",
  tags: [
    { id: "authoring", label: "内容编写" },
    { id: "instructions", label: "操作手册" },
  ],
});
const sdk = entity({
  id: "sdk",
  label: "TypeScript SDK",
  description: "声明身份、关系与阅读顺序",
  tags: [
    { id: "authoring", label: "内容编写" },
    { id: "typescript", label: "TypeScript" },
  ],
});
const coordinator = entity({
  id: "coordinator",
  label: "生成入口",
  description: "组织检查、布局与渲染",
  tags: [
    { id: "build-time", label: "构建阶段" },
    { id: "orchestration", label: "调用编排" },
  ],
});
const validator = entity({
  id: "validator",
  label: "语义检查",
  description: "检查引用与调用生命周期",
  tags: [
    { id: "build-time", label: "构建阶段" },
    { id: "validation", label: "规则校验" },
  ],
});
const layout = entity({
  id: "layout",
  label: "图表布局",
  description: "应用几何声明与计算连线",
  tags: [
    { id: "build-time", label: "构建阶段" },
    { id: "geometry", label: "几何计算" },
  ],
});
const renderer = entity({
  id: "renderer",
  label: "HTML 渲染",
  description: "绘制图表并组织节点属性",
  tags: [
    { id: "build-time", label: "构建阶段" },
    { id: "html", label: "HTML" },
    { id: "svg", label: "SVG" },
  ],
});
const output = entity({
  id: "output",
  label: "独立 HTML",
  description: "图表与结构化节点属性",
  tags: [
    { id: "offline", label: "离线阅读" },
    { id: "interactive", label: "节点交互" },
  ],
});

export const overview = architecture({
  id: "system-architecture",
  title: "系统架构：声明入口与生成分区",
  partitions: [
    {
      id: "generation",
      label: "生成过程",
      position: { x: 0, y: 220 },
      size: { width: 908, height: 380 },
    },
  ],
  nodes: [
    { entity: skill, role: guidance, position: { x: 0, y: 0 }, size: { width: 220, height: 88 } },
    {
      entity: sdk,
      role: declaration,
      position: { x: 344, y: 0 },
      size: { width: 220, height: 88 },
    },
    {
      entity: coordinator,
      role: presentation,
      partition: "generation",
      position: { x: 0, y: 0 },
      size: { width: 220, height: 88 },
    },
    {
      entity: validator,
      role: checking,
      partition: "generation",
      position: { x: 0, y: 190 },
      size: { width: 220, height: 88 },
    },
    {
      entity: layout,
      role: presentation,
      partition: "generation",
      position: { x: 320, y: 190 },
      size: { width: 220, height: 88 },
    },
    {
      entity: renderer,
      role: presentation,
      partition: "generation",
      position: { x: 640, y: 190 },
      size: { width: 220, height: 88 },
    },
    {
      entity: output,
      role: artifact,
      position: { x: 664, y: 720 },
      size: { width: 220, height: 88 },
    },
  ],
  relations: [
    { id: "guides", from: skill, to: sdk, label: "指导声明" },
    { id: "declares", from: sdk, to: coordinator, label: "提交语义文档" },
    { id: "checks", from: coordinator, to: validator, label: "检查语义" },
    { id: "validates", from: validator, to: layout, label: "合法文档" },
    { id: "positions", from: layout, to: renderer, label: "几何结果" },
    { id: "renders", from: renderer, to: output, label: "独立 HTML" },
  ],
});

export const generation = sequence({
  id: "generation-sequence",
  title: "生成时序：调用、执行与返回",
  participants: [
    { entity: sdk, role: declaration, size: { width: 160, height: 56 } },
    { entity: coordinator, role: presentation, size: { width: 136, height: 56 } },
    { entity: validator, role: checking, size: { width: 136, height: 56 } },
    { entity: layout, role: presentation, size: { width: 136, height: 56 } },
    { entity: renderer, role: presentation, size: { width: 136, height: 56 } },
  ],
  steps: [
    { id: "submit", from: sdk, to: coordinator, label: "生成报告" },
    { id: "check", from: coordinator, to: validator, label: "检查语义" },
    { id: "checked", from: validator, to: coordinator, label: "检查结果", replyTo: "check" },
    {
      id: "validation-result",
      kind: "alternative",
      branches: [
        {
          label: "检查通过",
          steps: [
            { id: "place", from: coordinator, to: layout, label: "计算布局" },
            { id: "placed", from: layout, to: coordinator, label: "几何结果", replyTo: "place" },
            { id: "paint", from: coordinator, to: renderer, label: "渲染 HTML" },
            { id: "assemble-properties", from: renderer, to: renderer, label: "汇总节点属性" },
            {
              id: "properties-ready",
              from: renderer,
              to: renderer,
              label: "属性已就绪",
              replyTo: "assemble-properties",
            },
            {
              id: "painted",
              from: renderer,
              to: coordinator,
              label: "HTML 内容",
              replyTo: "paint",
            },
            { id: "built", from: coordinator, to: sdk, label: "返回报告", replyTo: "submit" },
          ],
        },
        {
          label: "检查失败",
          steps: [
            { id: "diagnostic", from: coordinator, to: sdk, label: "返回诊断", replyTo: "submit" },
          ],
        },
      ],
    },
  ],
});

export default document()
  .markdown(`
# 用图表探索这套系统

这份报告由它所介绍的 SDK 生成。图中保留组件和关系，点击节点可以查看标签、角色与关联关系。

## 系统由谁负责

点击 [Skill](entity:skill) 或图中任意节点，可以查看结构化属性。虚线框“生成过程”是逻辑分区。生成入口、语义检查、图表布局和 HTML 渲染是其中的实体，连线连接这些实际组件。
  `)
  .diagram(overview)
  .markdown(`
## 一次生成如何执行

下图沿时间向下阅读。实线箭头发起同步调用，虚线箭头返回结果；生命线上的细长矩形表示执行区间。检查通过和失败是互斥分支，各自结束同一次生成调用。

[生成入口](entity:coordinator) 在两张图中都是组织检查、布局和渲染的实际组件。逻辑分区只用于架构组织，不参与时序调用。
  `)
  .diagram(generation).markdown(`
## 声明与呈现各自负责什么

| 负责方 | 内容 |
| --- | --- |
| 内容脚本 | 声明事实、关系、标签、节点与分区的宽高和架构位置。 |
| [语义检查](entity:validator)与[图表布局](entity:layout) | 检查尺寸、节点重叠、关系标签和调用生命周期，不静默改写内容。 |
| [HTML 渲染](entity:renderer) | 统一控制颜色、字体、连线和属性展示。 |

[架构图](diagram:system-architecture) 也可以独立输出，保留相同的节点详情和交互。
  `);
