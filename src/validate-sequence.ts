import type { AddDiagnostic } from "./diagnostics.ts";
import type { Call, Relation, Return, SequenceChart, Step } from "./model.ts";
export function validateSequence(
  chart: SequenceChart,
  path: string,
  add: AddDiagnostic,
  relation: (value: Relation) => void,
): void {
  let messageCount = 0;
  const stepIds = new Set();

  function walk(steps: readonly Step[], stack: Call[], prior: Map<string, Call | Return>): Call[] {
    for (const step of steps) {
      const stepPath = `${path}.${step.id}`;
      if (stepIds.has(step.id)) {
        add(
          "DUPLICATE_RELATION",
          stepPath,
          "步骤标识重复。",
          "为所有消息和条件片段指定唯一标识，包括不同分支内的步骤。",
        );
      }
      stepIds.add(step.id);
      if (step.kind === "alternative") {
        const exits = step.branches.map((branch) => walk(branch.steps, [...stack], new Map(prior)));
        const expected = exits[0].map((call) => call.id).join(",");
        if (exits.some((exit) => exit.map((call) => call.id).join(",") !== expected)) {
          add(
            "BRANCH_EXECUTION_MISMATCH",
            stepPath,
            "各条件分支结束时的调用状态不同。",
            "让所有分支完成相同的外层调用，或将返回放在分支之后。",
          );
        }
        stack = exits[0];
        continue;
      }

      relation(step);
      messageCount++;
      if (step.kind === "return") {
        const call = prior.get(step.replyTo);
        if (!call || call.kind !== "call") {
          add(
            "UNKNOWN_REPLY",
            `${stepPath}.replyTo`,
            "返回目标不是当前执行路径上先前的调用。",
            "使用 replyTo 引用当前分支或进入分支之前的调用。",
          );
        } else if (call.from !== step.to || call.to !== step.from) {
          add(
            "REPLY_DIRECTION",
            stepPath,
            "返回端点必须与调用方向相反。",
            "将返回的 from、to 分别设为原调用的 to、from。",
          );
        } else if (stack.at(-1)?.id !== call.id) {
          add(
            "RETURN_ORDER",
            stepPath,
            "该调用尚有未返回的内层调用，或已经返回。",
            "按调用栈顺序先返回内层调用，每个执行区间只能结束一次。",
          );
        } else {
          stack.pop();
        }
      } else {
        if (stack.length && stack.at(-1)!.to !== step.from) {
          add(
            "CALL_WHILE_BLOCKED",
            stepPath,
            "消息发送方正在等待另一个同步调用返回。",
            "先返回当前调用，再发起下一次调用。",
          );
        }
        if (stack.filter((call) => call.to === step.to).length >= 4) {
          add(
            "ACTIVATION_DEPTH",
            stepPath,
            "同一参与者的执行嵌套超过四层。",
            "把深层递归过程拆成另一张时序图。",
          );
        }
        stack.push(step);
      }
      prior.set(step.id, step);
    }
    return stack;
  }

  const pending = walk(chart.steps, [], new Map());
  for (const call of pending) {
    add(
      "UNFINISHED_CALL",
      `${path}.${call.id}`,
      `调用 ${call.id} 没有返回，无法确定执行条的终点。`,
      "添加端点反向且 replyTo 指向此调用的返回消息。",
    );
  }
  if (messageCount > 32) {
    add("MESSAGE_CAPACITY", path, "时序图超过 32 条调用与返回消息。", "按完整交互拆分时序图。");
  }
}
