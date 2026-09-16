/** Create reusable entity/role definitions and immutable chart declarations. */
export { entity, role, architecture, sequence, swimlane } from "./sdk.ts";
/** Render an HTML fragment or standalone page; invalid declarations or layouts throw DiagnosticError. */
export { render, renderPage } from "./render.ts";
export { DiagnosticError } from "./diagnostics.ts";

export type {
  ChartMeta,
  Participant,
  Entity,
  EntityInput,
  EntityRef,
  Tag,
  Role,
  Position,
  RelationInput,
  RelationVariant,
  RelationSide,
} from "./types.ts";
export type {
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
