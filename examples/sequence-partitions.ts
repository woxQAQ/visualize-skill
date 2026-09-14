import { sequence } from "../src/index.ts";
import { generation } from "./sequence.ts";

export default sequence({
  id: "generation-partitions",
  title: "生成时序：按职责划分参与者",
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
