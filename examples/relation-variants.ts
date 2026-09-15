import { mkdir, writeFile } from "node:fs/promises";
import { architecture, entity, role, render } from "../src/index.ts";
import type { RelationVariant } from "../src/index.ts";

const component = role({ id: "component", label: "组件" });
const connections: { variant: RelationVariant; from: string; to: string; label: string }[] = [
  { variant: "default", from: "调用方", to: "业务服务", label: "普通连接" },
  { variant: "emphasis", from: "订单服务", to: "支付服务", label: "重点连接" },
  { variant: "security", from: "应用", to: "授权服务", label: "安全相关连接" },
  { variant: "dashed", from: "处理器", to: "缓存", label: "虚线连接" },
  { variant: "external", from: "业务系统", to: "第三方服务", label: "外部连接" },
  { variant: "return", from: "业务服务", to: "调用方", label: "返回结果" },
];

const variants = architecture({
  id: "relation-variants",
  meta: { title: "关系样式：六种预设" },
  nodes: connections.flatMap(({ variant, from, to }, index) => [
    {
      entity: entity({ id: `${variant}-from`, label: from }),
      role: component,
      position: { x: 0, y: index * 110 },
    },
    {
      entity: entity({ id: `${variant}-to`, label: to }),
      role: component,
      position: { x: 500, y: index * 110 },
    },
  ]),
  relations: connections.map(({ variant, label }) => ({
    id: variant,
    from: `${variant}-from`,
    to: `${variant}-to`,
    variant,
    label: `${variant} · ${label}`,
  })),
});

const html = render(variants);
await mkdir("output", { recursive: true });
await writeFile("output/relation-variants.html", html, "utf8");
