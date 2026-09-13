# Codex 展示

仅在支持原生可视化内容引用的 Codex 对话中使用此流程；其他环境按 [SKILL.md](../SKILL.md) 生成独立页面并提供文件链接。

生成嵌入片段，`<skill>` 是 Skill 的绝对路径：

```sh
node "<skill>/src/cli.ts" diagram.ts --format fragment -o "<output>/diagram.html"
```

`<output>` 优先使用当前任务提供的可写 visualization 目录，否则使用任务工作目录下的 `output/`。片段包含图表、样式和交互，配色继承 Codex 主题，不包装成完整页面。

在同一轮最终回复中，用绝对路径输出以下内容引用，独占一行：

```text
visualize{"path":"<absolute-path>/diagram.html"}
```

每张图各用一个内容引用。背景和结论写在正常回复中。检查实际嵌入效果，包括主题、窄容器和悬停强调；需要脱离 Codex 打开或分享时，从同一声明另行生成 `page` 文件。
