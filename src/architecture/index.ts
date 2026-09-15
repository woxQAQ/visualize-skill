import type {
  ChartMeta,
  EntityInput,
  Role,
  Position,
  Participant,
  Relation,
  RelationInput,
  Rect,
  TextLayout,
  NodeLayout,
  EdgeLayout,
} from "../shared/model.ts";

/**
 * Automatically placed architecture entity with an optional position correction.
 * Inherited fields follow Participant.
 */
export interface ArchitectureNode<E = string, R = string> extends Participant<E, R> {
  /**
   * Offset from the partition content origin after its header and padding, or from the chart
   * content origin when ungrouped. Omit for automatic placement.
   */
  readonly position?: Position;
  /**
   * Optional ID in this chart's partitions; omission places the node directly in the chart content
   * area.
   */
  readonly partition?: string;
}

/** A positioned container for related architecture nodes, not an entity or a relation endpoint. */
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

/**
 * Normalized architecture declaration. E/R are full definitions in SDK output and identifier
 * strings in semantic data.
 */
export interface ArchitectureChart<E = string, R = string> {
  /** Discriminator selecting architecture validation, layout and rendering. */
  readonly kind: "architecture";
  /**
   * Chart identifier used in diagnostics and generated HTML IDs. Use a stable identifier matching
   * [a-z][a-z0-9-]*.
   */
  readonly id: string;
  /** Shared title and optional subtitle; plain text, not markup. */
  readonly meta: ChartMeta;
  /**
   * Declare 1 to 12 nodes, with each entity appearing exactly once.
   * Optional positions are corrections after layout diagnostics.
   */
  readonly nodes: readonly ArchitectureNode<E, R>[];
  /**
   * Groups referenced by node.partition; every declared partition must contain at least one node.
   * Empty when no groups are declared.
   */
  readonly partitions: readonly ArchitecturePartition[];
  /**
   * Up to 16 directed relations with unique IDs and endpoints present in nodes; an empty array is
   * allowed.
   */
  readonly relations: readonly Relation[];
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
   * definitions. Optional positions are corrections after layout diagnostics.
   */
  readonly nodes: readonly ArchitectureNode<EntityInput, Role>[];
  /**
   * Groups referenced by node.partition; every declared partition must contain at least one node.
   * Omission normalizes to an empty array.
   */
  readonly partitions?: readonly ArchitecturePartition[];
  /**
   * Up to 16 directed relations with unique IDs and endpoints present in nodes; an empty array is
   * allowed. Endpoints accept entity definitions or IDs.
   */
  readonly relations: readonly RelationInput[];
}

/**
 * Computed partition frame and heading used for member placement, obstacle generation and SVG
 * rendering.
 */
export interface ArchitecturePartitionLayout extends Rect {
  /** Original ArchitecturePartition.id, retained for membership lookup. */
  id: string;
  /** Wrapped partition label. */
  title: TextLayout;
  /** Reserved title-area height; member positions start below it plus content padding. */
  headerHeight: number;
}

/** Computed architecture geometry returned by compile(); derived output rather than SDK input. */
export interface ArchitectureScene {
  /** Discriminator selecting architecture SVG rendering. */
  kind: "architecture";
  /** Original chart ID used to scope rendered elements. */
  id: string;
  /** Computed canvas width including outer margins. */
  width: number;
  /** Computed canvas height including outer margins. */
  height: number;
  /** Computed node boxes and text in chart.nodes order. */
  nodes: NodeLayout[];
  /** Computed group frames and headings in chart.partitions order. */
  partitions: ArchitecturePartitionLayout[];
  /** Routed relations in declaration order; each path and label has already been placed. */
  edges: EdgeLayout[];
}
