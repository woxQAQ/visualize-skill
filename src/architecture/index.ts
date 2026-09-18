import type {
  ChartMeta,
  EntityInput,
  Role,
  Position,
  Alignment,
  Appearance,
  RelationInput,
} from "../types.ts";

/**
 * A component at the diagram's chosen abstraction level, with optional local placement.
 * Select nodes to explain responsibilities and dependencies, rather than enumerate execution steps.
 * Inherited fields follow Appearance.
 */
export interface ArchitectureNode<E = EntityInput, R = Role> extends Appearance<E, R> {
  /**
   * Optional ID of the partition in this chart that contains the node; ungrouped nodes sit in the
   * chart content area.
   */
  readonly partition?: string;
  /**
   * Offset from the partition content origin after its header and padding, or from the chart
   * content origin when ungrouped. Omit for automatic placement.
   */
  readonly position?: Position;
  /**
   * Center alignment with a sibling node in the same partition or chart content area; the layout
   * derives the coordinate on the given axis. Cannot combine with position.
   */
  readonly align?: Alignment;
}

/**
 * A shared responsibility, ownership or deployment boundary containing related components.
 * Use partitions when the boundary explains the architecture, not merely to decorate a group.
 * A partition is not an entity or a relation endpoint.
 */
export interface ArchitecturePartition {
  /** Unique within the chart's partitions. Use a stable identifier matching [a-z][a-z0-9-]*. */
  readonly id: string;
  /** Trimmed, nonempty single-line text with no tabs; at most 48 Unicode code points. */
  readonly label: string;
  /**
   * Offset of the outer partition box from the chart content origin, inside the canvas margin.
   * Omit for automatic placement; the frame always grows to contain its members.
   */
  readonly position?: Position;
}

/** Automatic layering directions for architecture charts; validated by the SDK. */
export const architectureDirections = ["vertical", "horizontal"] as const;

/**
 * Selects the automatic layering direction: vertical stacks dependency levels top to bottom,
 * horizontal arranges them left to right.
 */
export type ArchitectureDirection = (typeof architectureDirections)[number];

/**
 * A structural view of responsibilities, boundaries and component dependencies, not a timeline.
 * Automatic placement stacks dependency levels according to direction, within partitions and at
 * the root. This is an initial arrangement, not a recommended reading direction: use position for
 * mixed layouts when they better express peer responsibilities or fit the display width.
 * Use the SDK constructor to normalize defaults and register a renderable diagram.
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
   * Automatic layering direction, defaulting to vertical when omitted; horizontal suits peer
   * responsibilities compared side by side.
   */
  readonly direction?: ArchitectureDirection;
  /**
   * Declare 1 to 12 nodes, with each entity appearing exactly once; supply full entity and role
   * definitions. Optional positions and center alignments express intended placement or refine
   * automatic layout.
   * Assign partition IDs to group nodes; chart.nodes order determines member layout order.
   */
  readonly nodes: readonly ArchitectureNode[];
  /**
   * Boundaries referenced by node.partition; every partition must contain at least one node.
   * Omission normalizes to an empty array.
   */
  readonly partitions?: readonly ArchitecturePartition[];
  /**
   * Up to 16 directed relations with unique IDs and endpoints present in nodes; an empty array is
   * allowed. Endpoints accept entity definitions or IDs. Label dependencies with the capability or
   * contract being used; use sequence or swimlane diagrams for execution order.
   */
  readonly relations: readonly RelationInput[];
}
