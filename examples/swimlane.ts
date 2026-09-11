import { document, entity, role, swimlane } from "../src/index.ts";

const submission = role({ id: "submission", label: "提交申请" });
const review = role({ id: "review", label: "审核决定" });
const payment = role({ id: "payment", label: "付款执行" });
const submit = entity({
  id: "submit",
  label: "提交报销",
  tags: [{ id: "expense", label: "报销流程" }],
});
const revise = entity({ id: "revise", label: "补充材料" });
const approve = entity({ id: "approve", label: "审核申请", description: "检查凭证与报销额度" });
const pay = entity({ id: "pay", label: "安排付款" });
const archive = entity({ id: "archive", label: "归档凭证" });

export const expense = swimlane({
  id: "expense-flow",
  title: "报销流程：申请、审核与付款",
  width: 1000,
  headerWidth: 50,
  lanes: [
    { id: "employee", label: "申请人", height: 200 },
    { id: "manager", label: "审批人", height: 200 },
    { id: "finance", label: "财务", height: 200 },
  ],
  nodes: [
    {
      entity: submit,
      role: submission,
      lane: "employee",
      position: { x: 24, y: 40 },
      size: { width: 180, height: 80 },
    },
    {
      entity: revise,
      role: submission,
      lane: "employee",
      position: { x: 384, y: 40 },
      size: { width: 180, height: 80 },
    },
    {
      entity: approve,
      role: review,
      lane: "manager",
      position: { x: 24, y: 40 },
      size: { width: 180, height: 80 },
    },
    {
      entity: pay,
      role: payment,
      lane: "finance",
      position: { x: 384, y: 40 },
      size: { width: 180, height: 80 },
    },
    {
      entity: archive,
      role: payment,
      lane: "finance",
      position: { x: 704, y: 40 },
      size: { width: 180, height: 80 },
    },
  ],
  relations: [
    { id: "request-review", from: submit, to: approve, label: "提交审核" },
    { id: "request-changes", from: approve, to: revise, label: "材料不全" },
    { id: "resubmit", from: revise, to: approve, label: "重新提交" },
    { id: "approved", from: approve, to: pay, label: "审核通过" },
    { id: "paid", from: pay, to: archive, label: "付款完成" },
  ],
});

export default document()
  .markdown(`# 报销如何跨角色流转

每条泳道表示一个负责方，节点表示具体活动。沿箭头阅读：材料不全时退回补充，审核通过后交给财务付款。

点击 [审核申请](entity:approve) 可查看所属泳道和关联活动。`)
  .diagram(expense);
