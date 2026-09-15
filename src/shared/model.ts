/** Shared display metadata for every chart; geometry and identity remain separate. */
export interface ChartMeta {
  /** Nonempty display title for the figure, SVG accessibility label and standalone page. */
  readonly title: string;
  /** Optional nonempty supporting text displayed below the title; plain text, not markup. */
  readonly subtitle?: string;
}

/**
 * Classification attached to an entity; reuse a tag ID only with the same label throughout a
 * chart.
 */
export interface Tag {
  /** Unique within one entity's tags. Use a stable identifier matching [a-z][a-z0-9-]*. */
  readonly id: string;
  /** Trimmed, nonempty single-line text with no tabs; at most 24 Unicode code points. */
  readonly label: string;
}

/**
 * Reusable entity identity supplied to entity() or a chart node; appearance and placement belong
 * to the node.
 */
export interface EntityInput {
  /**
   * Use a stable identifier matching [a-z][a-z0-9-]*. Reusing it requires an identical normalized
   * entity definition within the chart.
   */
  readonly id: string;
  /**
   * Nonempty display name; layout wraps it within the declared node width and rejects text that
   * does not fit.
   */
  readonly label: string;
  /**
   * Optional brief summary. Trimmed, nonempty single-line text with no tabs; at most 80 Unicode
   * code points; omit for no summary.
   */
  readonly description?: string;
  /**
   * Optional classification list, at most 8 tags with distinct IDs; omission normalizes to an
   * empty array.
   */
  readonly tags?: readonly Tag[];
}

/**
 * Entity after SDK normalization; inherited fields retain EntityInput semantics and the SDK
 * freezes the result.
 */
export interface Entity extends EntityInput {
  /** Normalized classification list, always present; empty when omitted from EntityInput. */
  readonly tags: readonly Tag[];
}

/**
 * A chart-local responsibility used for the legend and node colors; it does not determine entity
 * identity.
 */
export interface Role {
  /**
   * Use a stable identifier matching [a-z][a-z0-9-]*. Reuse only with the same label; a chart
   * supports at most 6 distinct roles.
   */
  readonly id: string;
  /** Nonempty responsibility name shown in the legend and entity details. */
  readonly label: string;
}

/**
 * Declared local coordinates in SVG canvas units; the containing node or partition defines the
 * origin.
 */
export interface Position {
  /** Finite, nonnegative horizontal offset from the local origin, increasing to the right. */
  readonly x: number;
  /** Finite, nonnegative vertical offset from the local origin, increasing downward. */
  readonly y: number;
}

/**
 * Endpoint reference resolved by ID; passing an object does not add it to the chart nodes or
 * participants.
 */
export type EntityRef = string | EntityInput;

/**
 * One entity appearance in a chart. E and R are full entity/role definitions in SDK input and
 * identifier strings in semantic data.
 */
export interface Participant<E = string, R = string> {
  /**
   * Entity definition at the SDK boundary, or its ID after semantic conversion; an entity may
   * appear only once per chart.
   */
  readonly entity: E;
  /**
   * Role definition at the SDK boundary, or its ID after semantic conversion; controls this
   * appearance's legend category and color.
   */
  readonly role: R;
}

/** Allowed visual presets for architecture and swimlane relations; validated by the SDK. */
export const relationVariants = [
  "default",
  "emphasis",
  "security",
  "dashed",
  "external",
  "return",
] as const;

/** Selects a relation appearance from the fixed design system; custom styles are not accepted. */
export type RelationVariant = (typeof relationVariants)[number];

/**
 * Rectangle sides available to relation routing; each side contributes its midpoint as an
 * endpoint.
 */
export const relationSides = ["top", "right", "bottom", "left"] as const;

/**
 * Optional hard endpoint constraint; the router reports failure rather than selecting another
 * side.
 */
export type RelationSide = (typeof relationSides)[number];

/**
 * Normalized directed connection for architecture and swimlane charts. Style presets do not impose
 * sequence call/response rules.
 */
export interface Relation {
  /** Unique within the chart's relations. Use a stable identifier matching [a-z][a-z0-9-]*. */
  readonly id: string;
  /**
   * Source entity ID; must appear in the current chart's nodes. It cannot refer to a partition or
   * lane.
   */
  readonly from: string;
  /** Target entity ID; must appear in nodes. Equal source and target IDs create a self-loop. */
  readonly to: string;
  /**
   * Nonempty relation description rendered along the route; layout rejects labels that cannot fit.
   */
  readonly label: string;
  /**
   * Visual preset from relationVariants, always present after normalization; return is a visual
   * style here, without replyTo semantics.
   */
  readonly variant: RelationVariant;
  /**
   * Constrain the source endpoint to this rectangle side midpoint; omit to let routing choose.
   * Self-loops need different sides.
   */
  readonly fromSide?: RelationSide;
  /**
   * Constrain the target endpoint to this rectangle side midpoint; omit to let routing choose.
   * Self-loops need different sides.
   */
  readonly toSide?: RelationSide;
}

/**
 * Input relation; inherited ID, label and side constraints follow Relation, while endpoint objects
 * resolve by ID.
 */
export type RelationInput = Omit<Relation, "from" | "to" | "variant"> & {
  /** Source entity definition or ID; its ID must already appear in the chart's nodes. */
  readonly from: EntityRef;
  /**
   * Target entity definition or ID; its ID must already appear in nodes. Self-loops are allowed.
   */
  readonly to: EntityRef;
  /**
   * Visual preset, defaulting to default when omitted; does not introduce sequence execution
   * semantics.
   */
  readonly variant?: RelationVariant;
};

/** Absolute SVG canvas coordinate pair: x increases rightward and y increases downward. */
export type Point = [x: number, y: number];

/**
 * Computed rectangle in absolute SVG canvas units; local input coordinates have already been
 * resolved.
 */
export interface Rect {
  /** Left edge measured from the canvas origin. */
  x: number;
  /** Top edge measured from the canvas origin, increasing downward. */
  y: number;
  /** Horizontal extent in canvas units. */
  width: number;
  /** Vertical extent in canvas units. */
  height: number;
}

/**
 * Computed text wrapping and metrics shared by layout and SVG rendering; do not estimate geometry
 * separately.
 */
export interface TextLayout {
  /** Lines in display order after wrapping; explicit paragraph breaks are retained. */
  lines: string[];
  /** Measured width of the widest line, not the width limit passed to wrapping. */
  width: number;
  /** Total text-block height: line count multiplied by the design system line height. */
  height: number;
  /** Font size in canvas units, used for both text measurement and SVG rendering. */
  size: number;
}

/**
 * Computed box and text for a node or sequence header. Its entity and role IDs resolve through
 * LayoutContext.
 */
export interface NodeLayout extends Rect {
  /** Original entity ID; used for semantic lookup and generated node links. */
  id: string;
  /** Role ID used as the key in LayoutContext.colors. */
  role: string;
  /**
   * Required content height including text, gaps and padding; must fit inside the inherited box
   * height.
   */
  contentHeight: number;
  /** Wrapped entity label used as the node title. */
  title: TextLayout;
  /**
   * Wrapped entity summary, or null when no summary is declared or this layout suppresses
   * summaries.
   */
  detail: TextLayout | null;
}

/**
 * Computed geometry shared by relations and sequence messages; style and execution semantics
 * belong to specialized layouts.
 */
export interface ConnectionLayout {
  /** Original relation or message ID, retained for rendering and interaction lookup. */
  id: string;
  /** Source entity ID; matches a node ID in the scene. */
  from: string;
  /** Target entity ID; matches a node ID in the scene. */
  to: string;
  /** Ordered absolute canvas points from source to target, including endpoints and any bends. */
  points: Point[];
  /** SVG path data derived from points; must describe the same route. */
  path: string;
  /** Wrapped display label; sequence layouts include the generated message number. */
  label: TextLayout;
  /** Absolute left coordinate of the label text block; the background adds its own padding. */
  labelX: number;
  /** Absolute top coordinate of the label text block, not the first text baseline. */
  labelY: number;
}

/**
 * Relation geometry for architecture and swimlane rendering, with the original style and optional
 * side constraints.
 */
export interface EdgeLayout extends ConnectionLayout {
  /** Normalized relation style used to choose stroke, label emphasis and arrow appearance. */
  variant: RelationVariant;
  /**
   * Original optional source-side constraint; omission does not expose which side routing
   * selected.
   */
  fromSide?: RelationSide;
  /**
   * Original optional target-side constraint; omission does not expose which side routing
   * selected.
   */
  toSide?: RelationSide;
}

/**
 * Theme-aware CSS color expressions assigned to a role by the design system; values may contain
 * CSS variables.
 */
export interface Color {
  /** Primary role color used for the node border and legend swatch. */
  ink: string;
  /** Role background color used for node and legend fills. */
  fill: string;
}

/**
 * Lookup tables derived from a SemanticDiagram for layout and rendering; keys are semantic
 * identifiers.
 */
export interface LayoutContext {
  /** Entity ID to normalized definition; supplies node labels, summaries and metadata. */
  entities: Map<string, Entity>;
  /** Role ID to palette entry; the sorted role list determines assignment within this chart. */
  colors: Map<string, Color>;
}
