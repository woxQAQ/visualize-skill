import { sequence } from "../src/index.ts";
import {
  declaration,
  checking,
  presentation,
  sdk,
  coordinator,
  validator,
  layout,
  renderer,
} from "./system.ts";

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
  messages: [
    { id: "submit", from: sdk, to: coordinator, label: "生成图表", variant: "emphasis" },
    { id: "check", from: coordinator, to: validator, label: "检查语义" },
    {
      id: "checked",
      from: validator,
      to: coordinator,
      label: "检查结果",
      replyTo: "check",
      variant: "return",
    },
    {
      id: "validation-result",
      kind: "alternative",
      branches: [
        {
          label: "检查通过",
          messages: [
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
              label: "图形片段",
              replyTo: "paint",
            },
            {
              id: "built",
              from: coordinator,
              to: sdk,
              label: "返回图形",
              replyTo: "submit",
              variant: "emphasis",
            },
          ],
        },
        {
          label: "检查失败",
          messages: [
            { id: "diagnostic", from: coordinator, to: sdk, label: "返回诊断", replyTo: "submit" },
          ],
        },
      ],
    },
  ],
});

export default generation;
