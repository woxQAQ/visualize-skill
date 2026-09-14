import type {
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
  /**
   * Finite positive outer lane height in canvas units; must fit its title, activity nodes and
   * vertical padding.
   */
  readonly height: number;
}

/**
 * Explicitly positioned activity belonging to exactly one lane; inherited fields follow
 * Participant.
 */
export interface SwimlaneNode<E = string, R = string> extends Participant<E, R> {
  /**
   * Required ID in this chart's lanes; a lane is a container, not an entity or relation endpoint.
   */
  readonly lane: string;
  /**
   * Offset from the lane content origin, to the right of its title column and inside the content
   * padding.
   */
  readonly position: Position;
}

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
  /** Nonempty display title for the figure and standalone page; plain text, not markup. */
  readonly title: string;
  /**
   * Total lane width in canvas units, including the shared title column and content padding; must
   * leave room for nodes.
   */
  readonly width: number;
  /**
   * Shared title-column width in canvas units; must exceed 32 and fit wrapped lane labels. Always
   * present after normalization.
   */
  readonly headerWidth: number;
  /** Nonempty list in top-to-bottom order; each lane must contain at least one activity node. */
  readonly lanes: readonly Lane[];
  /**
   * Declare 1 to 12 nodes, with each entity appearing exactly once; positions are explicit. Every
   * node references one lane.
   */
  readonly nodes: readonly SwimlaneNode<E, R>[];
  /**
   * Up to 16 directed relations with unique IDs and endpoints present in nodes; an empty array is
   * allowed. Cross-lane connections are allowed.
   */
  readonly relations: readonly Relation[];
}

/**
 * Input to swimlane(); declare lane heights, one shared width and activity offsets within each
 * lane.
 */
export interface SwimlaneOptions {
  /**
   * Chart identifier used in diagnostics and generated HTML IDs. Use a stable identifier matching
   * [a-z][a-z0-9-]*.
   */
  readonly id: string;
  /** Nonempty display title for the figure and standalone page; plain text, not markup. */
  readonly title: string;
  /**
   * Total lane width in canvas units, including the shared title column and content padding; must
   * leave room for nodes.
   */
  readonly width: number;
  /**
   * Defaults to 144 when omitted. Shared title-column width in canvas units; must exceed 32 and
   * fit wrapped lane labels.
   */
  readonly headerWidth?: number;
  /** Nonempty list in top-to-bottom order; each lane must contain at least one activity node. */
  readonly lanes: readonly Lane[];
  /**
   * Declare 1 to 12 nodes, with each entity appearing exactly once; positions are explicit. Supply
   * full entity and role definitions and a lane ID.
   */
  readonly nodes: readonly SwimlaneNode<EntityInput, Role>[];
  /**
   * Up to 16 directed relations with unique IDs and endpoints present in nodes; an empty array is
   * allowed. Endpoints accept entity definitions or IDs; cross-lane connections are allowed.
   */
  readonly relations: readonly RelationInput[];
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
  /** Sum of declared lane heights plus outer canvas margins. */
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
