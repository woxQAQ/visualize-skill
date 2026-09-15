import { mkdir, writeFile } from "node:fs/promises";
import { sequence, render } from "../src/index.ts";
import { generation } from "./system.ts";

const partitions = sequence({
  id: "generation-partitions",
  meta: { title: "生成时序：按职责划分参与者" },
  participants: generation.participants.map((participant, index) => ({
    ...participant,
    ...(index === 0 ? {} : { partition: index < 3 ? "validation" : "presentation" }),
  })),
  partitions: [
    { id: "validation", label: "声明检查" },
    { id: "presentation", label: "图形生成" },
  ],
  messages: generation.messages,
});

const html = render(partitions);
await mkdir("output", { recursive: true });
await writeFile("output/sequence-partitions.html", html, "utf8");
