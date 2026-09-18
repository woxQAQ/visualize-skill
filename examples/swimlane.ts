import { mkdir, writeFile } from "node:fs/promises";
import { entity, role, swimlane, render } from "../src/index.ts";

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

const expense = swimlane({
  id: "expense-flow",
  meta: { title: "报销流程：申请、审核与付款" },
  lanes: [
    { id: "employee", label: "申请人" },
    { id: "manager", label: "审批人" },
    { id: "finance", label: "财务" },
  ],
  nodes: [
    {
      entity: submit,
      role: submission,
      lane: "employee",
    },
    {
      entity: revise,
      role: submission,
      lane: "employee",
    },
    {
      entity: approve,
      role: review,
      lane: "manager",
    },
    {
      entity: pay,
      role: payment,
      lane: "finance",
    },
    {
      entity: archive,
      role: payment,
      lane: "finance",
    },
  ],
  relations: [
    { id: "request-review", from: "submit", to: "approve", label: "提交审核" },
    { id: "request-changes", from: "approve", to: "revise", label: "材料不全" },
    { id: "resubmit", from: "revise", to: "approve", label: "重新提交" },
    { id: "approved", from: "approve", to: "pay", label: "审核通过" },
    { id: "paid", from: "pay", to: "archive", label: "付款完成" },
  ],
});

const html = render(expense);
await mkdir("output", { recursive: true });
await writeFile("output/swimlane.html", html, "utf8");
