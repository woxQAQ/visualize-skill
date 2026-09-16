import { mkdir, writeFile } from "node:fs/promises";
import { architecture, render } from "../src/index.ts";
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

const overview = architecture({
  id: "system-architecture",
  meta: { title: "系统架构", subtitle: "声明入口与生成分区" },
  partitions: [
    {
      id: "generation",
      label: "生成过程",
      nodes: [coordinator, validator, layout, renderer],
    },
  ],
  nodes: [
    { entity: skill, role: guidance },
    {
      entity: sdk,
      role: declaration,
    },
    {
      entity: coordinator,
      role: presentation,
    },
    {
      entity: validator,
      role: checking,
    },
    {
      entity: layout,
      role: presentation,
    },
    {
      entity: renderer,
      role: presentation,
    },
    {
      entity: output,
      role: artifact,
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

const html = render(overview);
await mkdir("output", { recursive: true });
await writeFile("output/architecture.html", html, "utf8");
