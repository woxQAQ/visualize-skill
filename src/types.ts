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
   * Nonempty display name; layout wraps it within the computed node width and rejects text that
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
 * Entity reference resolved by ID for relation endpoints or partition members; passing an object
 * does not add it to the chart nodes or participants.
 */
export type EntityRef = string | EntityInput;

/**
 * One entity appearance in a chart, with its own responsibility and color category.
 */
export interface Participant<E = EntityInput, R = Role> {
  /**
   * Entity definition; an entity may appear only once per chart.
   */
  readonly entity: E;
  /**
   * Role definition controlling this appearance's legend category and color.
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

/** Directed connection for architecture and swimlane charts. */
export interface RelationInput {
  /** Unique within the chart's relations. Use a stable identifier matching [a-z][a-z0-9-]*. */
  readonly id: string;
  /**
   * Source entity definition or ID; its ID must appear in chart.nodes. Partitions and lanes
   * cannot be endpoints.
   */
  readonly from: EntityRef;
  /** Target entity definition or ID already in chart.nodes; equal endpoints create a self-loop. */
  readonly to: EntityRef;
  /** Nonempty description rendered along the route; labels that cannot fit produce a diagnostic. */
  readonly label: string;
  /**
   * Visual preset, defaulting to default when omitted. return is a visual style here, without
   * sequence call/response semantics.
   */
  readonly variant?: RelationVariant;
  /**
   * Constrain the source endpoint to this rectangle side midpoint; omit to let routing choose.
   * Self-loops need different sides. If no route satisfies the constraint, rendering fails with a diagnostic.
   */
  readonly fromSide?: RelationSide;
  /** Constrain the target endpoint to this rectangle side midpoint; omit to let routing choose. */
  readonly toSide?: RelationSide;
}
