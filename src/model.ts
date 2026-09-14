import type { ArchitectureChart, ArchitectureScene } from "./architecture/index.ts";
import type { SequenceChart, SequenceScene } from "./sequence/index.ts";
import type { SwimlaneChart, SwimlaneScene } from "./swimlane/index.ts";
import type { Entity, Role } from "./shared/model.ts";

/** Semantic chart union; entity and role references are identifier strings. */
export type Chart = ArchitectureChart | SequenceChart | SwimlaneChart;

/**
 * SDK-created chart with full entity and role definitions; render and compile reject unregistered
 * hand-built objects.
 */
export type Diagram =
  | ArchitectureChart<Entity, Role>
  | SequenceChart<Entity, Role>
  | SwimlaneChart<Entity, Role>;

/**
 * Serializable single-chart data produced by compile(): definitions are stored once and the chart
 * references them by ID.
 */
export interface SemanticDiagram {
  /** Semantic format version; currently the literal 1. */
  readonly version: 1;
  /**
   * Normalized entity definitions collected from appearances and sorted by ID; chart entity
   * references resolve here.
   */
  readonly entities: readonly Entity[];
  /**
   * Role definitions collected from appearances and sorted by ID; ordering determines palette
   * assignment.
   */
  readonly roles: readonly Role[];
  /** Exactly one chart with entity and role references converted to identifier strings. */
  readonly chart: Chart;
}

/** Computed geometry union returned by compile; select a renderer using kind. */
export type Scene = ArchitectureScene | SequenceScene | SwimlaneScene;
