import type {
  ChartMeta,
  EntityInput,
  EntityRef,
  Role,
  Position,
  Participant,
  RelationInput,
} from "../types.ts";

/**
 * Architecture entity with optional local placement.
 * Inherited fields follow Participant.
 */
export interface ArchitectureNode<E = EntityInput, R = Role> extends Participant<E, R> {
  /**
   * Offset from the partition content origin after its header and padding, or from the chart
   * content origin when ungrouped. Omit for automatic placement.
   */
  readonly position?: Position;
}

/** A positioned container for related architecture nodes, not an entity or a relation endpoint. */
export interface ArchitecturePartition<E = EntityRef> {
  /** Unique within the chart's partitions. Use a stable identifier matching [a-z][a-z0-9-]*. */
  readonly id: string;
  /** Trimmed, nonempty single-line text with no tabs; at most 48 Unicode code points. */
  readonly label: string;
  /**
   * Nonempty list of member entity references, each declared in chart.nodes. A node may belong to
   * at most one partition and may appear only once in this list. References normalize to IDs;
   * chart.nodes order determines member layout order.
   */
  readonly nodes: readonly E[];
  /**
   * Offset of the outer partition box from the chart content origin, inside the canvas margin.
   * Omit for automatic placement; the frame always grows to contain its members.
   */
  readonly position?: Position;
}

/**
 * Input to architecture(); use the SDK constructor to normalize defaults and register a renderable
 * diagram.
 */
export interface ArchitectureOptions {
  /**
   * Chart identifier used in diagnostics and generated HTML IDs. Use a stable identifier matching
   * [a-z][a-z0-9-]*.
   */
  readonly id: string;
  /** Shared title and optional subtitle; plain text, not markup. */
  readonly meta: ChartMeta;
  /**
   * Declare 1 to 12 nodes, with each entity appearing exactly once; supply full entity and role
   * definitions. Optional positions express intended placement or refine automatic layout.
   */
  readonly nodes: readonly ArchitectureNode[];
  /**
   * Groups declaring member entities or IDs through partition.nodes; references do not add nodes
   * to the chart. Omission normalizes to an empty array.
   */
  readonly partitions?: readonly ArchitecturePartition[];
  /**
   * Up to 16 directed relations with unique IDs and endpoints present in nodes; an empty array is
   * allowed. Endpoints accept entity definitions or IDs.
   */
  readonly relations: readonly RelationInput[];
}
