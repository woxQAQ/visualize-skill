// Original package report reproduces incoming arrows sharing outgoing port leads.
import { entity, role, architecture } from "../../src/index.ts";

const facade = role({ id: "facade", label: "有状态封装" });
const loop = role({ id: "loop", label: "无状态循环" });
const llm = role({ id: "llm-foundation", label: "模型流基础" });
const vocab = role({ id: "vocabulary", label: "类型与契约" });
const persistent = role({ id: "persistent", label: "持久化运行时" });

const piAi = entity({
  id: "pi-ai",
  label: "@earendil-works/pi-ai",
  description: "LLM 抽象：Model、Message、EventStream",
  tags: [
    { id: "external-dep", label: "外部依赖" },
    { id: "monorepo", label: "monorepo 包" },
  ],
});
const types = entity({
  id: "types",
  label: "src/types.ts",
  description: "共享类型词汇：AgentMessage、AgentTool、AgentEvent",
  tags: [
    { id: "core", label: "核心" },
    { id: "type-only", label: "纯类型" },
  ],
});
const agentLoop = entity({
  id: "agent-loop",
  label: "src/agent-loop.ts",
  description: "无状态循环：流式调用、工具执行、消息轮询",
  tags: [
    { id: "core", label: "核心" },
    { id: "memory", label: "内存态" },
  ],
});
const agent = entity({
  id: "agent",
  label: "src/agent.ts",
  description: "有状态封装：事件屏障、队列、生命周期",
  tags: [
    { id: "core", label: "核心" },
    { id: "memory", label: "内存态" },
  ],
});
const streamFn = entity({
  id: "stream-fn",
  label: "src/stream-fn.ts",
  description: "默认 StreamFn 注入槽位",
  tags: [{ id: "memory", label: "内存态" }],
});
const proxy = entity({
  id: "proxy",
  label: "src/proxy.ts",
  description: "经 SSE 后端转发的 StreamFn 实现",
  tags: [
    { id: "memory", label: "内存态" },
    { id: "browser", label: "浏览器场景" },
  ],
});
const harnessRuntime = entity({
  id: "harness-runtime",
  label: "harness/runtime",
  description: "Harness 与 Lane：命令队列与 operation 准入",
  tags: [{ id: "persisted", label: "持久化" }],
});
const harnessDrive = entity({
  id: "harness-drive",
  label: "runtime/drive",
  description: "driveOperation 状态机，崩溃后可恢复",
  tags: [{ id: "persisted", label: "持久化" }],
});
const harnessExecution = entity({
  id: "harness-execution",
  label: "harness/execution",
  description: "LLM 流边界与工具管线，副作用 Gate",
  tags: [{ id: "persisted", label: "持久化" }],
});
const harnessSession = entity({
  id: "harness-session",
  label: "harness/session",
  description: "Session 持久化：意图先落盘再执行",
  tags: [{ id: "persisted", label: "持久化" }],
});
const compaction = entity({
  id: "compaction",
  label: "harness/compaction",
  description: "上下文压缩与分支摘要",
  tags: [{ id: "persisted", label: "持久化" }],
});
const search = entity({
  id: "search",
  label: "src/search",
  description: "SessionSearchService 契约，无内置实现",
  tags: [{ id: "contract-tag", label: "契约" }],
});
export const overview = architecture({
  id: "package-architecture",
  title: "架构总览：内存态循环与持久化 Harness",
  partitions: [
    {
      id: "memory-agent",
      label: "内存态 Agent 循环（src/agent*.ts）",
      position: { x: 0, y: 0 },
      size: { width: 608, height: 406 },
    },
    {
      id: "harness",
      label: "持久化 Harness（src/harness/）",
      position: { x: 640, y: 0 },
      size: { width: 508, height: 806 },
    },
  ],
  nodes: [
    {
      entity: agent,
      role: facade,
      partition: "memory-agent",
      position: { x: 0, y: 0 },
      size: { width: 220, height: 104 },
    },
    {
      entity: streamFn,
      role: llm,
      partition: "memory-agent",
      position: { x: 340, y: 0 },
      size: { width: 220, height: 104 },
    },
    {
      entity: agentLoop,
      role: loop,
      partition: "memory-agent",
      position: { x: 0, y: 200 },
      size: { width: 220, height: 104 },
    },
    {
      entity: proxy,
      role: llm,
      partition: "memory-agent",
      position: { x: 340, y: 200 },
      size: { width: 220, height: 104 },
    },
    {
      entity: harnessRuntime,
      role: persistent,
      partition: "harness",
      position: { x: 120, y: 0 },
      size: { width: 220, height: 104 },
    },
    {
      entity: harnessDrive,
      role: persistent,
      partition: "harness",
      position: { x: 120, y: 200 },
      size: { width: 220, height: 104 },
    },
    {
      entity: harnessExecution,
      role: persistent,
      partition: "harness",
      position: { x: 0, y: 400 },
      size: { width: 220, height: 104 },
    },
    {
      entity: compaction,
      role: persistent,
      partition: "harness",
      position: { x: 240, y: 400 },
      size: { width: 220, height: 104 },
    },
    {
      entity: harnessSession,
      role: persistent,
      partition: "harness",
      position: { x: 120, y: 600 },
      size: { width: 220, height: 104 },
    },
    { entity: piAi, role: llm, position: { x: 120, y: 850 }, size: { width: 220, height: 104 } },
    { entity: types, role: vocab, position: { x: 440, y: 850 }, size: { width: 220, height: 104 } },
    {
      entity: search,
      role: vocab,
      position: { x: 760, y: 850 },
      size: { width: 220, height: 104 },
    },
  ],
  relations: [
    { id: "calls-loop", from: agent, to: agentLoop, label: "runAgentLoop" },
    { id: "default-fn", from: streamFn, to: agentLoop, label: "缺省注入" },
    { id: "proxy-fn", from: proxy, to: agentLoop, label: "代理 StreamFn" },
    { id: "dispatch-drive", from: harnessRuntime, to: harnessDrive, label: "drive(operation)" },
    { id: "drive-exec", from: harnessDrive, to: harnessExecution, label: "生成与工具管线" },
    { id: "drive-summary", from: harnessDrive, to: compaction, label: "summary 状态" },
    { id: "summary-exec", from: compaction, to: harnessExecution, label: "经执行层生成摘要" },
    { id: "exec-persist", from: harnessExecution, to: harnessSession, label: "每步意图先持久化" },
    { id: "loop-types", from: agentLoop, to: types, label: "共享类型" },
    { id: "loop-ai", from: agentLoop, to: piAi, label: "事件流与校验" },
    { id: "types-ai", from: types, to: piAi, label: "扩展 Message/Tool" },
    { id: "exec-ai", from: harnessExecution, to: piAi, label: "provider 事件流" },
    { id: "session-types", from: harnessSession, to: types, label: "Entry 引用 AgentMessage" },
  ],
});
