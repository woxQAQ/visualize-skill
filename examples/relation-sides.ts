import { mkdir, writeFile } from "node:fs/promises";
import { architecture, entity, role, render } from "../src/index.ts";

const component = role({ id: "component", label: "组件" });
const connections = [
  {
    id: "authorize",
    from: "应用",
    to: "授权服务",
    y: 0,
    toY: 0,
    fromSide: "right",
    toSide: "left",
    variant: "security",
    label: "右侧出 · 左侧进",
  },
  {
    id: "dispatch",
    from: "任务入口",
    to: "工作进程",
    y: 220,
    toY: 220,
    fromSide: "bottom",
    toSide: "bottom",
    variant: "default",
    label: "底部出 · 底部进",
  },
  {
    id: "publish",
    from: "生成器",
    to: "发布服务",
    y: 440,
    toY: 520,
    fromSide: "right",
    toSide: "top",
    variant: "emphasis",
    label: "右侧出 · 顶部进",
  },
] as const;

const sides = architecture({
  id: "relation-sides",
  meta: { title: "声明连接边：起点与终点" },
  nodes: connections.flatMap((connection) => [
    {
      entity: entity({ id: `${connection.id}-from`, label: connection.from }),
      role: component,
      position: { x: 0, y: connection.y },
    },
    {
      entity: entity({ id: `${connection.id}-to`, label: connection.to }),
      role: component,
      position: { x: 500, y: connection.toY },
    },
  ]),
  relations: connections.map(({ id, label, variant, fromSide, toSide }) => ({
    id,
    from: `${id}-from`,
    to: `${id}-to`,
    label,
    variant,
    fromSide,
    toSide,
  })),
});

const html = render(sides);
await mkdir("output", { recursive: true });
await writeFile("output/relation-sides.html", html, "utf8");
