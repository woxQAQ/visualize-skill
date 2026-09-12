# Repository Guidelines

## Project Structure & Module Organization

- `src/index.ts` exposes the SDK; `sdk.ts` and `model.ts` define declarations and semantic data.
- `src/layout/` computes diagram geometry and routing. Validation and rendering live in separate `src/` modules.
- `src/templates/` contains HTML templates, CSS, and browser interaction JavaScript.
- `test/` contains runtime tests and TypeScript contract checks.
- `examples/` contains runnable diagrams; generated HTML goes into ignored `output/`.
- `SKILL.md` guides content authors, `references/` documents APIs by topic, and `docs/architecture.md` explains implementation decisions.

## Development Commands

Use Node.js 22.18+ and the pnpm version declared in `package.json`. Enter the Nix-managed environment with `devenv shell`; do not install tools through Homebrew. Report missing dependencies.

- `pnpm install --frozen-lockfile`: install development dependencies.
- `pnpm typecheck`: run strict TypeScript checks without emitting files.
- `pnpm test`: type-check, then run all Node tests.
- `pnpm example`: generate the architecture diagram fragment.
- `pnpm example:sequence`: generate the sequence diagram fragment.
- `pnpm example:swimlane`: generate the swimlane diagram fragment.
- `node src/cli.ts examples/architecture.ts --check`: validate declarations and layout without writing HTML.

There is no build step. Node runs TypeScript source directly; diagram generation requires no third-party runtime dependencies.

## Coding Style & Naming Conventions

Follow existing two-space indentation, single quotes, and semicolons. Use explicit `.ts` extensions for local imports and `import type` for type-only imports. Keep TypeScript compatible with type stripping. Browser JavaScript uses JSDoc and participates in strict checking.

Use lowercase hyphenated declaration identifiers, such as `order-api`. Preserve immutable declarations and explicit geometry in `compile()`. Rendering prepares separate compact layouts for container widths without shrinking text. `ArchitecturePartition` belongs only to architecture diagrams and groups components by shared responsibility or membership; it is not an entity or relation endpoint. Each diagram type owns its organization model. Avoid speculative abstractions and dependencies. Use `pnpm lint` and `pnpm fmt:check` for the configured lint and format checks.

## Testing Guidelines

Use `node:test` and `node:assert/strict` in `test/*.test.ts`, with descriptive behavior-based test names. Add type rejection cases to `test/contracts.ts` when changing declaration contracts. No coverage percentage is enforced; cover changed behavior, diagnostics, and relevant edge cases.

For rendering or interaction changes, regenerate examples and inspect them in a browser. Preserve distribution tests that run a copied Skill without dependencies or build artifacts.

## Commit & Pull Request Guidelines

Existing subjects are `init` and `update`; no detailed convention is established. Use concise, descriptive imperative subjects. Keep changes focused and preserve unrelated edits.

PR descriptions should explain the problem, resulting behavior, and validation performed. Link relevant issues when available; include screenshots for visible changes. Update author-facing references when API behavior changes.
