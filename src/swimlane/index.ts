import type {
  ChartMeta,
  EntityInput,
  Role,
  Position,
  Appearance,
  RelationInput,
} from "../types.ts";

/**
 * A responsible party in a swimlane diagram; array order determines vertical position and every
 * lane needs an activity.
 */
export interface Lane {
  /** Unique within the chart's lanes. Use a stable identifier matching [a-z][a-z0-9-]*. */
  readonly id: string;
  /**
   * Responsible party name. Trimmed, nonempty single-line text with no tabs; at most 48 Unicode
   * code points.
   */
  readonly label: string;
}

/**
 * Automatically placed activity belonging to exactly one lane; inherited fields follow
 * Appearance.
 */
export interface SwimlaneNode<E = EntityInput, R = Role> extends Appearance<E, R> {
  /**
   * Required ID in this chart's lanes; a lane is a container, not an entity or relation endpoint.
   */
  readonly lane: string;
  /**
   * Offset from the lane content origin, to the right of its title column and inside the content
   * padding. Omit for automatic placement.
   */
  readonly position?: Position;
}

/**
 * Input to swimlane(); declare responsible parties, activities and relations. Geometry is computed.
 */
export interface SwimlaneOptions {
  /**
   * Chart identifier used in diagnostics and generated HTML IDs. Use a stable identifier matching
   * [a-z][a-z0-9-]*.
   */
  readonly id: string;
  /** Shared title and optional subtitle; plain text, not markup. */
  readonly meta: ChartMeta;
  /** Nonempty list in top-to-bottom order; each lane must contain at least one activity node. */
  readonly lanes: readonly Lane[];
  /**
   * Declare 1 to 12 nodes, with each entity appearing exactly once; supply full entity and role definitions
   * and a lane ID. Optional positions express intended placement or refine automatic layout.
   */
  readonly nodes: readonly SwimlaneNode[];
  /**
   * Up to 16 directed relations with unique IDs and endpoints present in nodes; an empty array is
   * allowed. Endpoints accept entity definitions or IDs; cross-lane connections are allowed.
   */
  readonly relations: readonly RelationInput[];
}
