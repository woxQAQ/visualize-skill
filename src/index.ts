/** Create reusable entity/role definitions and immutable chart declarations. */
export { entity, role, architecture, sequence, swimlane } from "./sdk.ts";
/** Render an HTML fragment or standalone page; invalid declarations or layouts throw DiagnosticError. */
export { render, renderPage } from "./render.ts";
/** Report the computed geometry of a valid diagram for layout correction; throws like render(). */
export { inspect } from "./inspect.ts";
export { DiagnosticError } from "./diagnostics.ts";
/** Neutral role referenced by appearances that omit one. */
export { defaultRole } from "./types.ts";

export type {
  ChartMeta,
  Alignment,
  AlignmentAxis,
  Appearance,
  Entity,
  EntityInput,
  Tag,
  Role,
  Position,
  RelationInput,
  RelationVariant,
  RelationSide,
} from "./types.ts";
export type {
  ArchitectureDirection,
  ArchitectureOptions,
  ArchitectureNode,
  ArchitecturePartition,
} from "./architecture/index.ts";
export type {
  SequenceOptions,
  SequenceParticipant,
  SequencePartition,
  MessageInput,
  MessageVariant,
  MessageKind,
} from "./sequence/index.ts";
export type { Diagnostic } from "./diagnostics.ts";
export type { Lane, SwimlaneNode, SwimlaneOptions } from "./swimlane/index.ts";
export type {
  GeometryContainer,
  GeometryEdge,
  GeometryNode,
  GeometryPoint,
  GeometryReport,
} from "./inspect.ts";
