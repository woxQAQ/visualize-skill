import { entity, role, sequence } from "../src/index.ts";

const participant = role({ id: "participant", label: "参与者" });
const client = entity({ id: "client", label: "客户端" });
const service = entity({ id: "service", label: "服务" });
const audit = entity({ id: "audit", label: "审计服务" });

export default sequence({
  id: "message-variants",
  title: "消息语义示例：主链路、异步、权限与响应",
  participants: [client, service, audit].map((entity) => ({
    entity,
    role: participant,
    size: { width: 220, height: 64 },
  })),
  messages: [
    { id: "request", from: client, to: service, label: "提交请求", variant: "emphasis" },
    { id: "audit", from: service, to: audit, label: "异步记录", variant: "dashed" },
    { id: "policy", from: service, to: service, label: "检查权限", variant: "security" },
    {
      id: "recorded",
      from: audit,
      to: service,
      label: "记录完成",
      variant: "return",
      replyTo: "audit",
    },
    {
      id: "allowed",
      from: service,
      to: service,
      label: "允许执行",
      variant: "return",
      replyTo: "policy",
    },
    { id: "work", from: service, to: service, label: "处理请求" },
    {
      id: "worked",
      from: service,
      to: service,
      label: "处理完成",
      variant: "return",
      replyTo: "work",
    },
    {
      id: "response",
      from: service,
      to: client,
      label: "返回结果",
      variant: "return",
      replyTo: "request",
    },
    { id: "notify", from: client, to: audit, label: "异步通知", variant: "dashed" },
  ],
});
