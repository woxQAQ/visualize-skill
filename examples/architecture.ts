import { architecture } from "../src/index.ts";
import {
  guidance,
  declaration,
  checking,
  presentation,
  artifact,
  skill,
  sdk,
  coordinator,
  validator,
  layout,
  renderer,
  output,
} from "./system.ts";

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
    { id: "declares", from: sdk, to: coordinator, label: "提交图表声明" },
    { id: "checks", from: coordinator, to: validator, label: "检查语义" },
    { id: "validates", from: validator, to: layout, label: "合法图表" },
    { id: "positions", from: layout, to: renderer, label: "几何结果" },
    { id: "renders", from: renderer, to: output, label: "图形片段" },
  ],
});

export default overview;
