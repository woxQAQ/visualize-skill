import { mkdir, writeFile } from "node:fs/promises";
import { architecture, entity, render } from "../src/index.ts";

const submit = entity({ id: "submit", label: "提交订单" });
const pay = entity({ id: "pay", label: "支付" });
const done = entity({ id: "done", label: "完成订单" });
const timer = entity({ id: "timer", label: "超时计时" });
const cancel = entity({ id: "cancel", label: "取消订单" });

// cancel 用 position 固定在右侧，为回流连线留白；timer 声明 align 跟随 cancel
// 的中心，无需读取坐标再手算 position。
const timeout = architecture({
  id: "architecture-alignment-vertical",
  meta: { title: "对齐声明：跟随固定节点", subtitle: "timer 以 axis x 对齐 cancel 的中心" },
  nodes: [
    { entity: submit },
    { entity: pay },
    { entity: done },
    { entity: timer, align: { with: "cancel", axis: "x" } },
    { entity: cancel, position: { x: 440, y: 232 } },
  ],
  relations: [
    { id: "checkout", from: "submit", to: "pay", label: "去支付" },
    { id: "fulfill", from: "pay", to: "done", label: "支付完成" },
    { id: "start-timer", from: "submit", to: "timer", label: "启动计时" },
    { id: "expire", from: "timer", to: "cancel", label: "超时取消" },
    { id: "release", from: "cancel", to: "submit", label: "释放库存", variant: "return" },
  ],
});

const draft = entity({ id: "draft", label: "撰写草稿" });
const review = entity({ id: "review", label: "审核" });
const publish = entity({ id: "publish", label: "发布" });
const notify = entity({ id: "notify", label: "通知订阅方" });
const archive = entity({ id: "archive", label: "归档" });

// 横向分层时 notify 与 archive 会同列上下堆叠；notify 声明 align 与 publish
// 同一水平线，主干到分支保持水平直连。
const branches = architecture({
  id: "architecture-alignment-horizontal",
  meta: { title: "对齐声明：分支与主干并排", subtitle: "notify 以 axis y 对齐 publish 的中心" },
  direction: "horizontal",
  nodes: [
    { entity: draft },
    { entity: review },
    { entity: publish },
    { entity: notify, align: { with: "publish", axis: "y" } },
    { entity: archive },
  ],
  relations: [
    { id: "submit-review", from: "draft", to: "review", label: "提交审核" },
    { id: "approve", from: "review", to: "publish", label: "审核通过" },
    { id: "notify-followers", from: "publish", to: "notify", label: "推送通知" },
    { id: "archive-copy", from: "publish", to: "archive", label: "留存副本" },
  ],
});

await mkdir("output", { recursive: true });
await writeFile("output/architecture-alignment-vertical.html", render(timeout), "utf8");
await writeFile("output/architecture-alignment-horizontal.html", render(branches), "utf8");
