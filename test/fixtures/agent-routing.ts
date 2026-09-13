import { entity, role, architecture, swimlane } from "../../src/index.ts";

// Package diagram geometry reproduces shared corridors and a crowded local connection.

// 职责（每张图最多 6 种）
const entry = role({ id: "entry", label: "调用入口" });
const orchestration = role({ id: "orchestration", label: "回合编排" });
const execution = role({ id: "execution", label: "效果执行" });
const persistence = role({ id: "persistence", label: "持久化" });
const external = role({ id: "external", label: "外部依赖" });
const notification = role({ id: "notification", label: "事件通知" });

// 跨图复用的共享对象
const hostApp = entity({
  id: "host-app",
  label: "宿主应用",
  description: "TUI、服务端或测试等调用方",
  tags: [{ id: "caller", label: "调用方" }],
});
const agent = entity({
  id: "agent",
  label: "Agent",
  description: "内存态封装（agent.ts）：状态、中断与订阅",
  tags: [
    { id: "in-memory", label: "内存层" },
    { id: "src", label: "src/" },
  ],
});
const agentLoop = entity({
  id: "agent-loop",
  label: "runAgentLoop",
  description: "回合循环：编排流式请求与工具执行",
  tags: [
    { id: "in-memory", label: "内存层" },
    { id: "src", label: "src/" },
  ],
});
const provider = entity({
  id: "provider",
  label: "pi-ai 模型层",
  description: "模型提供方（@earendil-works/pi-ai）：StreamFn 流式接口",
  tags: [{ id: "monorepo-dep", label: "仓库内依赖" }],
});
const tools = entity({
  id: "tools",
  label: "内置工具与执行环境",
  description: "bash、read、write、edit，基于 ExecutionEnv",
  tags: [
    { id: "harness", label: "harness/" },
    { id: "builtin", label: "内置" },
  ],
});
const eventBus = entity({
  id: "event-bus",
  label: "事件与订阅",
  description: "Agent.subscribe 与 HarnessEventBus",
  tags: [{ id: "events", label: "事件" }],
});
const lane = entity({
  id: "lane",
  label: "Lane 会话分支",
  description: "accept 与 drive 拆分，驱动单个对话分支",
  tags: [
    { id: "harness", label: "harness/" },
    { id: "durable", label: "持久化运行时" },
  ],
});
const drive = entity({
  id: "drive",
  label: "Drive 过程",
  description: "无副作用的操作状态机驱动（driveOperation）",
  tags: [
    { id: "harness", label: "harness/" },
    { id: "durable", label: "持久化运行时" },
  ],
});
const executionLayer = entity({
  id: "execution-layer",
  label: "执行层（execution/）",
  description: "assistant 流式与工具调用的效果执行",
  tags: [{ id: "harness", label: "harness/" }],
});
const storage = entity({
  id: "storage",
  label: "会话存储（session/）",
  description: "Entry 与 Operation 持久化：Memory、JSONL",
  tags: [
    { id: "harness", label: "harness/" },
    { id: "storage", label: "存储" },
  ],
});
const compaction = entity({
  id: "compaction",
  label: "上下文压缩（compaction/）",
  description: "令牌估算、切点选择与摘要生成",
  tags: [{ id: "harness", label: "harness/" }],
});

// 泳道活动对象（表示流程活动，与执行者分离）
const submitPrompt = entity({
  id: "submit-prompt",
  label: "提交 prompt",
  description: "Lane.prompt()",
});
const acceptOp = entity({
  id: "accept-op",
  label: "接纳操作",
  description: "写入操作意图与元数据",
});
const commitCheckpoint = entity({
  id: "commit-checkpoint",
  label: "提交初始检查点",
  description: "before_run 钩子后落盘",
});
const driveMachine = entity({
  id: "drive-machine",
  label: "驱动状态机",
  description: "按 operation.state 分派过程",
});
const streamGen = entity({
  id: "stream-gen",
  label: "流式生成回复",
  description: "streamHarnessAssistant",
});
const commitFrames = entity({
  id: "commit-frames",
  label: "提交消息帧",
  description: "帧前缀支持崩溃恢复",
});
const execTool = entity({
  id: "exec-tool",
  label: "执行工具调用",
  description: "意图先行，支持安全重放",
});
const commitToolResult = entity({
  id: "commit-tool-result",
  label: "提交工具结果",
  description: "结果 Entry 落盘",
});
const settlePublish = entity({
  id: "settle-publish",
  label: "结算并发布事件",
  description: "run_end 与操作结果",
});
const receiveResult = entity({
  id: "receive-result",
  label: "接收结果",
  description: "事件总线或 watch 快照",
});

export const agentOverview = architecture({
  id: "package-overview",
  title: "包结构：内存层与持久化运行时",
  partitions: [
    {
      id: "in-memory",
      label: "内存层（无持久化）",
      position: { x: 0, y: 160 },
      size: { width: 250, height: 360 },
    },
    {
      id: "harness",
      label: "持久化运行时（harness/）",
      position: { x: 300, y: 160 },
      size: { width: 740, height: 640 },
    },
  ],
  nodes: [
    { entity: hostApp, role: entry, position: { x: 480, y: 0 }, size: { width: 240, height: 96 } },
    {
      entity: agent,
      role: entry,
      partition: "in-memory",
      position: { x: 0, y: 0 },
      size: { width: 200, height: 112 },
    },
    {
      entity: agentLoop,
      role: orchestration,
      partition: "in-memory",
      position: { x: 0, y: 152 },
      size: { width: 200, height: 112 },
    },
    {
      entity: lane,
      role: entry,
      partition: "harness",
      position: { x: 0, y: 0 },
      size: { width: 180, height: 124 },
    },
    {
      entity: drive,
      role: orchestration,
      partition: "harness",
      position: { x: 240, y: 0 },
      size: { width: 180, height: 124 },
    },
    {
      entity: executionLayer,
      role: execution,
      partition: "harness",
      position: { x: 460, y: 0 },
      size: { width: 220, height: 124 },
    },
    {
      entity: compaction,
      role: orchestration,
      partition: "harness",
      position: { x: 0, y: 176 },
      size: { width: 180, height: 124 },
    },
    {
      entity: storage,
      role: persistence,
      partition: "harness",
      position: { x: 240, y: 176 },
      size: { width: 180, height: 124 },
    },
    {
      entity: tools,
      role: execution,
      partition: "harness",
      position: { x: 460, y: 176 },
      size: { width: 220, height: 124 },
    },
    {
      entity: eventBus,
      role: notification,
      partition: "harness",
      position: { x: 240, y: 352 },
      size: { width: 180, height: 124 },
    },
    {
      entity: provider,
      role: external,
      position: { x: 480, y: 880 },
      size: { width: 240, height: 112 },
    },
  ],
  relations: [
    { id: "host-agent", from: hostApp, to: agent, label: "prompt() / subscribe()" },
    { id: "host-lane", from: hostApp, to: lane, label: "createAgentHarness" },
    { id: "agent-loop-call", from: agent, to: agentLoop, label: "驱动回合循环" },
    { id: "agent-events", from: agent, to: eventBus, label: "发布 AgentEvent" },
    { id: "loop-provider", from: agentLoop, to: provider, label: "StreamFn 流式请求" },
    { id: "lane-drive", from: lane, to: drive, label: "accept 后驱动" },
    { id: "lane-events", from: lane, to: eventBus, label: "发布 HarnessEvent" },
    { id: "drive-execution", from: drive, to: executionLayer, label: "生成与工具执行" },
    { id: "drive-storage", from: drive, to: storage, label: "提交状态转移" },
    { id: "drive-compaction", from: drive, to: compaction, label: "压缩与分支摘要" },
    {
      id: "execution-provider",
      from: executionLayer,
      to: provider,
      label: "streamHarnessAssistant",
    },
    { id: "execution-tools", from: executionLayer, to: tools, label: "执行内置工具" },
    { id: "events-host", from: eventBus, to: hostApp, label: "通知订阅者 / watch" },
  ],
});

export const agentFlow = swimlane({
  id: "durable-flow",
  title: "持久化运行时：一次操作如何在负责方之间流转",
  width: 1100,
  headerWidth: 160,
  lanes: [
    { id: "host", label: "宿主应用", height: 176 },
    { id: "runtime", label: "Lane 与 Drive", height: 196 },
    { id: "store", label: "会话存储", height: 196 },
    { id: "model", label: "模型提供方", height: 186 },
    { id: "tool-exec", label: "工具执行", height: 186 },
  ],
  nodes: [
    {
      entity: submitPrompt,
      role: entry,
      lane: "host",
      position: { x: 40, y: 20 },
      size: { width: 180, height: 104 },
    },
    {
      entity: receiveResult,
      role: entry,
      lane: "host",
      position: { x: 640, y: 20 },
      size: { width: 180, height: 104 },
    },
    {
      entity: acceptOp,
      role: orchestration,
      lane: "runtime",
      position: { x: 40, y: 35 },
      size: { width: 180, height: 104 },
    },
    {
      entity: driveMachine,
      role: orchestration,
      lane: "runtime",
      position: { x: 330, y: 35 },
      size: { width: 200, height: 104 },
    },
    {
      entity: settlePublish,
      role: notification,
      lane: "runtime",
      position: { x: 640, y: 35 },
      size: { width: 180, height: 104 },
    },
    {
      entity: commitCheckpoint,
      role: persistence,
      lane: "store",
      position: { x: 40, y: 35 },
      size: { width: 200, height: 104 },
    },
    {
      entity: commitFrames,
      role: persistence,
      lane: "store",
      position: { x: 330, y: 35 },
      size: { width: 200, height: 104 },
    },
    {
      entity: commitToolResult,
      role: persistence,
      lane: "store",
      position: { x: 620, y: 35 },
      size: { width: 200, height: 104 },
    },
    {
      entity: streamGen,
      role: external,
      lane: "model",
      position: { x: 330, y: 25 },
      size: { width: 220, height: 104 },
    },
    {
      entity: execTool,
      role: execution,
      lane: "tool-exec",
      position: { x: 330, y: 25 },
      size: { width: 200, height: 104 },
    },
  ],
  relations: [
    { id: "f-submit-accept", from: submitPrompt, to: acceptOp, label: "Lane.prompt()" },
    { id: "f-accept-ckpt", from: acceptOp, to: commitCheckpoint, label: "commit" },
    { id: "f-ckpt-drive", from: commitCheckpoint, to: driveMachine, label: "assistant.ready" },
    { id: "f-drive-stream", from: driveMachine, to: streamGen, label: "streamFn 请求" },
    { id: "f-stream-frames", from: streamGen, to: commitFrames, label: "持续提交消息帧" },
    { id: "f-stream-drive", from: streamGen, to: driveMachine, label: "助手消息完成" },
    { id: "f-drive-tool", from: driveMachine, to: execTool, label: "包含工具调用" },
    { id: "f-tool-result", from: execTool, to: commitToolResult, label: "commit 结果" },
    { id: "f-result-drive", from: commitToolResult, to: driveMachine, label: "继续回合" },
    { id: "f-drive-settle", from: driveMachine, to: settlePublish, label: "无更多工作" },
    { id: "f-settle-receive", from: settlePublish, to: receiveResult, label: "run_end / watch" },
  ],
});
