import { mkdir, writeFile } from "node:fs/promises";
import { render } from "../src/index.ts";
import { generation } from "./system.ts";

const html = render(generation);
await mkdir("output", { recursive: true });
await writeFile("output/sequence.html", html, "utf8");
