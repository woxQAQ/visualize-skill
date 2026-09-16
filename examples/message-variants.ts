import { mkdir, writeFile } from "node:fs/promises";
import { entity, role, sequence, render } from "../src/index.ts";

const participant = role({ id: "participant", label: "参与者" });
const client = entity({ id: "client", label: "客户端" });
const service = entity({ id: "service", label: "服务" });
const audit = entity({ id: "audit", label: "审计服务" });

const messages = sequence({
  id: "message-variants",
  meta: { title: "消息行为与视觉强调独立组合" },
  participants: [client, service, audit].map((entity) => ({
    entity,
    role: participant,
  })),
  messages: [
    { id: "request", from: client, to: service, label: "提交请求", variant: "emphasis" },
    {
      id: "audit",
      from: service,
      to: audit,
      label: "异步记录",
      kind: "async",
      variant: "security",
    },
    { id: "policy", from: service, to: service, label: "检查权限", variant: "security" },
    {
      id: "recorded",
      from: audit,
      to: service,
      label: "记录完成",
      kind: "reply",
      variant: "security",
      replyTo: "audit",
    },
    {
      id: "allowed",
      from: service,
      to: service,
      label: "允许执行",
      kind: "reply",
      replyTo: "policy",
    },
    { id: "work", from: service, to: service, label: "处理请求" },
    {
      id: "worked",
      from: service,
      to: service,
      label: "处理完成",
      kind: "reply",
      replyTo: "work",
    },
    {
      id: "response",
      from: service,
      to: client,
      label: "返回结果",
      kind: "reply",
      replyTo: "request",
    },
    { id: "event", from: service, to: audit, label: "发布事件", kind: "async" },
    {
      id: "notify",
      from: client,
      to: audit,
      label: "异步通知",
      kind: "async",
      variant: "emphasis",
    },
  ],
});

const html = render(messages);
await mkdir("output", { recursive: true });
await writeFile("output/message-variants.html", html, "utf8");
