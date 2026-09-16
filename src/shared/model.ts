import type { Entity, RelationInput, RelationSide, RelationVariant } from "../types.ts";

/** Internal connection with entity references and visual defaults resolved by the SDK. */
export interface Relation extends Omit<RelationInput, "from" | "to" | "variant"> {
  readonly from: string;
  readonly to: string;
  readonly variant: RelationVariant;
}

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
