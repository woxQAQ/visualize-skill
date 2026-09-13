# Codex 展示

当前 Codex 任务提供了 visualization 可写目录，或宿主说明支持原生可视化内容引用时，使用此流程。其他环境或用户明确要求独立文件时，按 [SKILL.md](../SKILL.md) 生成 `page` 并提供文件链接。

生成嵌入片段，`<skill>` 是 Skill 的绝对路径：

```sh
node "<skill>/src/cli.ts" diagram.ts --format fragment -o "<output>/diagram.html"
```

`<output>` 优先使用当前任务提供的可写 visualization 目录，否则使用任务工作目录下的 `output/`。片段包含图表、样式和交互，配色继承 Codex 主题，不包装成完整页面。

确认输出是 HTML 片段，没有 `<!doctype>`、`<html>`、`<head>` 或 `<body>` 页面外壳。在同一轮最终回复中，用实际生成文件的绝对路径输出以下内容引用，独占一行，不加代码围栏：

```text
visualize{"path":"<absolute-path>/diagram.html"}
```

每张图各用一个内容引用，背景和结论写在正常回复中。仅生成文件、给出 Markdown 文件链接或打开浏览器预览，都不等于完成对话内展示。

浏览器预览与对话内展示是两个独立步骤。浏览器拒绝 `file://` 只能说明该预览入口不可用，不应因此改用 `page` 或省略内容引用。能预览时检查主题、窄容器和悬停强调；无法预览时说明未完成视觉核验，仍交付已生成的片段引用。需要脱离 Codex 打开或分享时，从同一声明另行生成 `page` 文件。
