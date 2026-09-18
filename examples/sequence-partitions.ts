import { mkdir, writeFile } from "node:fs/promises";
import { sequence, render } from "../src/index.ts";
import { generation } from "./system.ts";

const partitions = sequence({
  id: "sequence-partitions",
  meta: { title: "生成时序：按阶段划分消息" },
  participants: generation.participants,
  partitions: [
    { id: "validation", label: "声明检查" },
    { id: "presentation", label: "图形生成" },
  ],
  messages: generation.messages.map((message) => ({
    ...message,
    ...(message.id === "check" || message.id === "checked"
      ? { partition: "validation" }
      : ["place", "placed", "paint", "assemble-properties", "properties-ready", "painted"].includes(
            message.id,
          )
        ? { partition: "presentation" }
        : {}),
  })),
});

const html = render(partitions);
await mkdir("output", { recursive: true });
await writeFile("output/sequence-partitions.html", html, "utf8");
