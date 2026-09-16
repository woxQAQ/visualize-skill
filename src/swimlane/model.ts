import type { ChartMeta } from "../types.ts";
import type { Lane, SwimlaneNode } from "./index.ts";
import type { Rect, TextLayout, NodeLayout, EdgeLayout, Relation } from "../shared/model.ts";

/**
 * Normalized swimlane declaration. E/R are full definitions in SDK output and identifier strings
 * in semantic data.
 */
export interface SwimlaneChart<E = string, R = string> {
  /** Discriminator selecting swimlane validation, layout and rendering. */
  readonly kind: "swimlane";
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
   * Declare 1 to 12 nodes, with each entity appearing exactly once; every node references one lane.
   * Optional positions express intended placement or refine automatic layout.
   */
  readonly nodes: readonly SwimlaneNode<E, R>[];
  /**
   * Up to 16 directed relations with unique IDs and endpoints present in nodes; an empty array is
   * allowed. Cross-lane connections are allowed.
   */
  readonly relations: readonly Relation[];
}

/**
 * Computed outer lane rectangle and title column; inherited width includes both title and activity
 * areas.
 */
export interface LaneLayout extends Rect {
  /** Original Lane.id used for membership lookup. */
  id: string;
  /** Wrapped responsible-party label. */
  title: TextLayout;
  /**
   * Title-column width shared by all lanes; activity coordinates begin after this column plus
   * padding.
   */
  headerWidth: number;
}

/**
 * Computed swimlane geometry returned by compile(); relations are routed inside the combined lane
 * content area.
 */
export interface SwimlaneScene {
  /** Discriminator selecting swimlane SVG rendering. */
  kind: "swimlane";
  /** Original chart ID used to scope rendered elements. */
  id: string;
  /** Shared lane width plus the outer canvas margins. */
  width: number;
  /** Sum of computed lane heights plus outer canvas margins. */
  height: number;
  /**
   * Computed activity boxes in chart.nodes order, with local offsets resolved to canvas
   * coordinates.
   */
  nodes: NodeLayout[];
  /** Computed lane rectangles in top-to-bottom declaration order, with adjacent boundaries. */
  lanes: LaneLayout[];
  /** Routed activity relations in declaration order, including any cross-lane connections. */
  edges: EdgeLayout[];
}
