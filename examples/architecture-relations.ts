import { mkdir, writeFile } from "node:fs/promises";
import { architecture, entity, role, render } from "../src/index.ts";

const caller = role({ id: "caller", label: "调用方" });
const core = role({ id: "core", label: "核心服务" });
const external = role({ id: "external", label: "外部依赖" });

const storefront = entity({ id: "storefront", label: "店面" });
const order = entity({ id: "order", label: "订单服务" });
const payment = entity({ id: "payment", label: "支付服务" });
const channel = entity({ id: "channel", label: "支付渠道" });
const risk = entity({ id: "risk", label: "风控服务" });
const inventory = entity({ id: "inventory", label: "库存服务" });

// 一张图覆盖六种关系样式预设：主链路用 default 与 emphasis，外部依赖用
// external，异步查询用 dashed，安全相关用 security，回流用 return。
// 主链路的连接边保持一致，回流从底部进出，分支从合适的边进入。
const ordering = architecture({
  id: "architecture-relations",
  meta: { title: "关系样式与连接边", subtitle: "下单主链路与分支" },
  direction: "horizontal",
  nodes: [
    { entity: storefront, role: caller },
    { entity: order, role: core },
    { entity: payment, role: core },
    { entity: channel, role: external },
    { entity: risk, role: external },
    { entity: inventory, role: core },
  ],
  relations: [
    {
      id: "submit",
      from: "storefront",
      to: "order",
      label: "提交订单",
      fromSide: "right",
      toSide: "left",
    },
    { id: "pay", from: "order", to: "payment", label: "请求支付", variant: "emphasis" },
    { id: "charge", from: "payment", to: "channel", label: "调用渠道", variant: "external" },
    {
      id: "paid",
      from: "payment",
      to: "order",
      label: "支付结果",
      variant: "return",
      fromSide: "bottom",
      toSide: "bottom",
    },
    {
      id: "risk-check",
      from: "order",
      to: "risk",
      label: "风控校验",
      variant: "security",
      toSide: "top",
    },
    {
      id: "stock",
      from: "order",
      to: "inventory",
      label: "预占库存",
      variant: "dashed",
      fromSide: "bottom",
    },
  ],
});

const html = render(ordering);
await mkdir("output", { recursive: true });
await writeFile("output/architecture-relations.html", html, "utf8");
