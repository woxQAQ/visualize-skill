import { test } from "node:test";
import assert from "node:assert/strict";
import { measure, wrap } from "../src/design.ts";

test("mixed-language labels keep a trailing Han character with its preceding word", () => {
  const text = "11. agent_end 与消息数组";
  const result = wrap(text, 158, "label", 2, 12);
  assert.deepEqual(result.lines, ["11. agent_end 与消息", "数组"]);
  assert.equal(result.lines.join(""), text);
  assert.ok(result.lines.every((line) => measure(line, 12) <= 158));
  assert.equal(result.width, Math.max(...result.lines.map((line) => measure(line, 12))));
});

test("tail balancing preserves explicit breaks and does not split words or exceed capacity", () => {
  assert.deepEqual(wrap("消息数\n组", 158, "label").lines, ["消息数", "组"]);
  assert.deepEqual(wrap("agent 中", 50, "label", 2, 12).lines, ["agent", "中"]);
  assert.deepEqual(wrap("甲乙丙", 14, "label", 3).lines, ["甲", "乙", "丙"]);
  assert.deepEqual(wrap("消息数组", 28, "label", 2).lines, ["消息", "数组"]);
  assert.deepEqual(wrap("接口返回结果中", 84, "label", 2).lines, ["接口返回", "结果中"]);
  assert.deepEqual(wrap("执行副作用", 24, "label", 3, 12).lines, ["执行", "副", "作用"]);
});
