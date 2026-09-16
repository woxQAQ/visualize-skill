import type { AddDiagnostic } from "../diagnostics.ts";
import type { Message, SequenceChart } from "./model.ts";

export function validateSequence(
  chart: SequenceChart,
  path: string,
  add: AddDiagnostic,
  endpoints: (value: Message) => void,
): void {
  const stack: Message[] = [];
  const prior = new Map<string, Message>();
  const completed = new Set<string>();

  for (const message of chart.messages) {
    const messagePath = `${path}.${message.id}`;
    endpoints(message);
    if (message.kind === "reply") {
      const call = prior.get(message.replyTo!);
      if (!call || call.kind === "reply") {
        add(
          "UNKNOWN_REPLY",
          `${messagePath}.replyTo`,
          "响应目标不是先前的同步调用或异步消息。",
          "使用 replyTo 引用先前消息的标识。",
        );
      } else if (call.from !== message.to || call.to !== message.from) {
        add(
          "REPLY_DIRECTION",
          messagePath,
          "响应端点必须与原消息方向相反。",
          "将响应的 from、to 分别设为原消息的 to、from。",
        );
      } else if (completed.has(call.id)) {
        add("DUPLICATE_REPLY", messagePath, "该消息已经收到响应。", "每条消息最多关联一个响应。");
      } else if (call.kind === "sync" && stack.at(-1)?.id !== call.id) {
        add(
          "RETURN_ORDER",
          messagePath,
          "该同步调用尚有未返回的内层调用。",
          "先返回内层调用，再返回外层调用。",
        );
      } else {
        if (call.kind === "sync") stack.pop();
        completed.add(call.id);
      }
    } else if (message.kind === "sync") {
      if (stack.length && stack.at(-1)!.to !== message.from) {
        add(
          "CALL_WHILE_BLOCKED",
          messagePath,
          "消息发送方不在当前同步调用的执行位置。",
          '先返回当前同步调用，或用 kind: "async" 表达独立的异步消息。',
        );
      }
      if (stack.filter((call) => call.to === message.to).length >= 4) {
        add(
          "ACTIVATION_DEPTH",
          messagePath,
          "同一参与者的执行嵌套超过四层。",
          "把深层递归过程拆成另一张时序图。",
        );
      }
      stack.push(message);
    }
    prior.set(message.id, message);
  }

  for (const call of stack) {
    add(
      "UNFINISHED_CALL",
      `${path}.${call.id}`,
      `同步调用 ${call.id} 没有响应，无法确定执行条的终点。`,
      '添加 kind 为 "reply"、端点反向且 replyTo 指向此调用的消息。',
    );
  }
  if (chart.messages.length > 32) {
    add("MESSAGE_CAPACITY", path, "时序图超过 32 条消息。", "按完整交互拆分时序图。");
  }
}
