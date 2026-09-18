import type { Diagram } from "./model.ts";
import type { Diagnostic } from "./diagnostics.ts";
import type { RelationVariant } from "./types.ts";
import type { MessageKind, MessageVariant } from "./sequence/index.ts";
import { compile } from "./render.ts";

/** Plain coordinate pair in absolute SVG canvas units. */
export interface GeometryPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Computed node rectangle in absolute canvas units, with the information needed to correct a
 * declared position: the center for alignment checks, the containing partition or lane, the local
 * origin that position is relative to, and the declared position itself.
 */
export interface GeometryNode {
  /** Entity ID matching the chart declaration. */
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Horizontal center: x + width / 2; align cy for straight horizontal relations. */
  readonly cx: number;
  /** Vertical center: y + height / 2; align cx for straight vertical relations. */
  readonly cy: number;
  /** ID of the containing partition or lane, when the node belongs to one. */
  readonly container?: string;
  /**
   * Canvas coordinate of the local origin that position is relative to; present only for charts
   * accepting node positions. A corrected local position is the desired absolute coordinate minus
   * this origin.
   */
  readonly origin?: GeometryPoint;
  /** Declared local position echoed from the chart, when present. */
  readonly position?: GeometryPoint;
}

/** Computed partition or lane frame in absolute canvas units. */
export interface GeometryContainer {
  /** Partition or lane ID matching the chart declaration. */
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Routed relation or message with its ordered points and placed label. */
export interface GeometryEdge {
  /** Relation or message ID matching the chart declaration. */
  readonly id: string;
  readonly from: string;
  readonly to: string;
  /** Ordered canvas points from source to target, including endpoints and any bends. */
  readonly points: readonly GeometryPoint[];
  /** Placed label block: absolute top-left, size and wrapped lines. */
  readonly label: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly lines: readonly string[];
  };
  readonly variant: RelationVariant | MessageVariant;
  /** Message behavior; present only for sequence charts. */
  readonly kind?: MessageKind;
}

/**
 * Read-only geometry report produced by inspect(); plain JSON-serializable data for correcting
 * positions, side constraints and labels without parsing the rendered HTML.
 */
export interface GeometryReport {
  readonly kind: "architecture" | "sequence" | "swimlane";
  readonly id: string;
  /**
   * Non-fatal layout judgments computed with the geometry, such as near-miss alignment and
   * avoidable bends; clear these before the visual review.
   */
  readonly warnings: readonly Diagnostic[];
  /** Computed canvas size including outer margins. */
  readonly canvas: { readonly width: number; readonly height: number };
  readonly nodes: readonly GeometryNode[];
  /** Partitions or lanes, depending on the chart kind. */
  readonly containers: readonly GeometryContainer[];
  readonly edges: readonly GeometryEdge[];
}

/**
 * Compile the diagram and report its computed geometry. Throws DiagnosticError on invalid
 * declarations or layouts, exactly like render().
 */
export function inspect(diagram: Diagram): GeometryReport {
  const { semantic, scene, warnings } = compile(diagram);
  const chart = semantic.chart;
  const declared = new Map(
    chart.kind === "sequence"
      ? chart.participants.map((node) => [node.entity, undefined] as const)
      : chart.nodes.map((node) => [node.entity, node.position] as const),
  );
  const containerOf = new Map(
    chart.kind === "architecture"
      ? chart.nodes.flatMap((node) =>
          node.partition === undefined ? [] : [[node.entity, node.partition] as const],
        )
      : chart.kind === "swimlane"
        ? chart.nodes.map((node) => [node.entity, node.lane] as const)
        : chart.participants.flatMap((node) =>
            node.partition === undefined ? [] : [[node.entity, node.partition] as const],
          ),
  );
  const nodes: GeometryNode[] = scene.nodes.map((node) => {
    const position = declared.get(node.id);
    const container = containerOf.get(node.id);
    return {
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      cx: node.x + node.width / 2,
      cy: node.y + node.height / 2,
      ...(container === undefined ? {} : { container }),
      ...(node.origin === undefined ? {} : { origin: { x: node.origin[0], y: node.origin[1] } }),
      ...(position === undefined ? {} : { position: { x: position.x, y: position.y } }),
    };
  });
  const containers: GeometryContainer[] = (
    scene.kind === "swimlane" ? scene.lanes : scene.partitions
  ).map(({ id, x, y, width, height }) => ({ id, x, y, width, height }));
  const geometryEdge = (edge: (typeof scene.edges)[number]): GeometryEdge => ({
    id: edge.id,
    from: edge.from,
    to: edge.to,
    points: edge.points.map(([x, y]) => ({ x, y })),
    label: {
      x: edge.labelX,
      y: edge.labelY,
      width: edge.label.width,
      height: edge.label.height,
      lines: [...edge.label.lines],
    },
    variant: edge.variant,
  });
  const edges: GeometryEdge[] =
    scene.kind === "sequence"
      ? scene.edges.map((edge) => ({ ...geometryEdge(edge), kind: edge.kind }))
      : scene.edges.map(geometryEdge);
  return {
    kind: scene.kind,
    id: scene.id,
    warnings,
    canvas: { width: scene.width, height: scene.height },
    nodes,
    containers,
    edges,
  };
}
