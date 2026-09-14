/**
 * Structured failure from declaration parsing, semantic validation or layout; use the code and
 * path to identify what needs correction.
 */
export interface Diagnostic {
  /**
   * Machine-readable error category, such as UNKNOWN_ENDPOINT; use it instead of matching message
   * text.
   */
  code: string;
  /**
   * Diagnostic location describing the offending input or computed value; not a filesystem path or
   * a guaranteed JSON Pointer.
   */
  path: string;
  /** Human-readable explanation of the failure; currently emitted in Chinese. */
  message: string;
  /** Concrete correction suggested by the validator or layout engine. */
  hint: string;
}
export type AddDiagnostic = (code: string, path: string, message: string, hint: string) => void;

export class DiagnosticError extends Error {
  readonly diagnostics: readonly Diagnostic[];
  constructor(diagnostics: readonly Diagnostic[]) {
    super(diagnostics.map((d) => `${d.path}: ${d.message}`).join("\n"));
    this.name = "DiagnosticError";
    this.diagnostics = diagnostics;
  }
}

export function fail(code: string, path: string, message: string, hint: string): never {
  throw new DiagnosticError([{ code, path, message, hint }]);
}

export function fields(
  value: unknown,
  allowed: readonly string[],
  path: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_OBJECT", path, "需要一个对象。", "按 API 文档声明内容字段。");
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key))
      fail(
        "UNKNOWN_FIELD",
        `${path}.${key}`,
        `不支持字段 ${key}。`,
        `可用字段：${allowed.join(", ")}。外观由设计系统控制。`,
      );
  }
}

export function string(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim())
    fail("INVALID_TEXT", path, "需要非空字符串。", "补充有意义的名称或关系描述。");
  // eslint-disable-next-line no-control-regex -- Reject non-displayable controls while allowing tabs and line breaks.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
    fail(
      "INVALID_TEXT",
      path,
      "文字包含不可显示的控制字符。",
      "删除控制字符；换行和制表符可以保留。",
    );
  return value;
}

export function identifier(value: unknown, path: string): string {
  const id = string(value, path);
  if (!/^[a-z][a-z0-9-]*$/.test(id))
    fail(
      "INVALID_ID",
      path,
      "标识符必须以小写字母开头，只包含小写字母、数字和连字符。",
      "使用稳定的语义名称，例如 layout-engine。",
    );
  return id;
}

export function array(value: unknown, path: string, { empty = false } = {}): readonly unknown[] {
  if (!Array.isArray(value) || (!empty && !value.length))
    fail(
      "INVALID_ARRAY",
      path,
      "需要数组，且此处不能省略必要内容。",
      "添加内容；只在文档允许时使用空数组。",
    );
  return value;
}

export function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
