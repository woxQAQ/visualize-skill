import type { ChartMeta } from "../types.ts";
import type { ArchitectureNode, ArchitecturePartition, ArchitectureDirection } from "./index.ts";
import type { Rect, TextLayout, NodeLayout, EdgeLayout, Relation } from "../shared/model.ts";

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
  /** Automatic layering direction resolved by the SDK; always present after normalization. */
  readonly direction: ArchitectureDirection;
  /**
   * Declare 1 to 12 nodes, with each entity appearing exactly once; nodes reference their
   * partition by ID. Optional positions express intended placement or refine automatic layout.
   */
  readonly nodes: readonly ArchitectureNode<E, R>[];
  /**
   * Groups referenced by node.partition; ungrouped nodes remain in chart content.
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
