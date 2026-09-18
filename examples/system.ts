import { entity, role, sequence } from "../src/index.ts";

export const guidance = role({ id: "guidance", label: "内容指导" });
export const declaration = role({ id: "declaration", label: "语义声明" });
export const checking = role({ id: "checking", label: "规则检查" });
export const presentation = role({ id: "presentation", label: "视觉生成" });
export const artifact = role({ id: "artifact", label: "输出产物" });

export const skill = entity({
  id: "skill",
  label: "Skill",
  description: "指导 AI 组织内容与关系",
  tags: [
    { id: "authoring", label: "内容编写" },
    { id: "instructions", label: "操作手册" },
  ],
});
export const sdk = entity({
  id: "sdk",
  label: "TypeScript SDK",
  description: "声明组件、职责与关系",
  tags: [
    { id: "authoring", label: "内容编写" },
    { id: "typescript", label: "TypeScript" },
  ],
});
export const coordinator = entity({
  id: "coordinator",
  label: "生成入口",
  description: "组织检查、布局与渲染",
  tags: [
    { id: "build-time", label: "构建阶段" },
    { id: "orchestration", label: "调用编排" },
  ],
});
export const validator = entity({
  id: "validator",
  label: "语义检查",
  description: "检查引用与调用生命周期",
  tags: [
    { id: "build-time", label: "构建阶段" },
    { id: "validation", label: "规则校验" },
  ],
});
export const layout = entity({
  id: "layout",
  label: "图表布局",
  description: "应用几何声明与计算连线",
  tags: [
    { id: "build-time", label: "构建阶段" },
    { id: "geometry", label: "几何计算" },
  ],
});
export const renderer = entity({
  id: "renderer",
  label: "HTML 渲染",
  description: "绘制图表并组织节点属性",
  tags: [
    { id: "build-time", label: "构建阶段" },
    { id: "html", label: "HTML" },
    { id: "svg", label: "SVG" },
  ],
});
export const output = entity({
  id: "output",
  label: "交互图形片段",
  description: "图表与结构化节点属性",
  tags: [
    { id: "offline", label: "本地生成" },
    { id: "interactive", label: "节点交互" },
  ],
});

export const generation = sequence({
  id: "generation-sequence",
  meta: { title: "生成成功路径：调用、执行与响应" },
  participants: [
    { entity: sdk, role: declaration },
    { entity: coordinator, role: presentation },
    { entity: validator, role: checking },
    { entity: layout, role: presentation },
    { entity: renderer, role: presentation },
  ],
  messages: [
    { id: "submit", from: "sdk", to: "coordinator", label: "生成图表", variant: "emphasis" },
    { id: "check", from: "coordinator", to: "validator", label: "检查语义" },
    {
      id: "checked",
      from: "validator",
      to: "coordinator",
      label: "检查结果",
      replyTo: "check",
      kind: "reply",
    },
    { id: "place", from: "coordinator", to: "layout", label: "计算布局" },
    {
      id: "placed",
      from: "layout",
      to: "coordinator",
      label: "几何结果",
      kind: "reply",
      replyTo: "place",
    },
    { id: "paint", from: "coordinator", to: "renderer", label: "渲染 HTML" },
    { id: "assemble-properties", from: "renderer", to: "renderer", label: "汇总节点属性" },
    {
      id: "properties-ready",
      from: "renderer",
      to: "renderer",
      label: "属性已就绪",
      kind: "reply",
      replyTo: "assemble-properties",
    },
    {
      id: "painted",
      from: "renderer",
      to: "coordinator",
      label: "图形片段",
      kind: "reply",
      replyTo: "paint",
    },
    {
      id: "built",
      from: "coordinator",
      to: "sdk",
      label: "返回图形",
      kind: "reply",
      replyTo: "submit",
    },
  ],
});
