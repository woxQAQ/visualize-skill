export interface Tag {
  readonly id: string;
  readonly label: string;
}
export interface EntityInput {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tags?: readonly Tag[];
}
export interface Entity extends EntityInput {
  readonly tags: readonly Tag[];
}
export interface Role {
  readonly id: string;
  readonly label: string;
}
export interface Position {
  readonly x: number;
  readonly y: number;
}
export interface Size {
  readonly width: number;
  readonly height: number;
}
export type EntityRef = string | EntityInput;

export interface Participant<E = string, R = string> {
  readonly entity: E;
  readonly role: R;
  readonly size: Size;
}
export interface ArchitectureNode<E = string, R = string> extends Participant<E, R> {
  readonly position: Position;
  readonly partition?: string;
}
export interface ArchitecturePartition {
  readonly id: string;
  readonly label: string;
  readonly position: Position;
  readonly size: Size;
}
export const relationVariants = [
  "default",
  "emphasis",
  "security",
  "dashed",
  "external",
  "return",
] as const;
export type RelationVariant = (typeof relationVariants)[number];
export const relationSides = ["top", "right", "bottom", "left"] as const;
export type RelationSide = (typeof relationSides)[number];

export interface Relation {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly variant: RelationVariant;
  readonly fromSide?: RelationSide;
  readonly toSide?: RelationSide;
}
export type RelationInput = Omit<Relation, "from" | "to" | "variant"> & {
  readonly from: EntityRef;
  readonly to: EntityRef;
  readonly variant?: RelationVariant;
};
export interface Call extends Omit<Relation, "fromSide" | "toSide"> {
  readonly kind: "call";
}
export interface Return extends Omit<Relation, "fromSide" | "toSide"> {
  readonly kind: "return";
  readonly replyTo: string;
}
export interface Alternative {
  readonly id: string;
  readonly kind: "alternative";
  readonly branches: readonly { readonly label: string; readonly messages: readonly Message[] }[];
}
export type Message = Call | Return | Alternative;
export type MessageInput =
  | (Omit<RelationInput, "fromSide" | "toSide"> & { readonly replyTo?: string })
  | {
      readonly id: string;
      readonly kind: "alternative";
      readonly branches: readonly {
        readonly label: string;
        readonly messages: readonly MessageInput[];
      }[];
    };
export interface ArchitectureChart<E = string, R = string> {
  readonly kind: "architecture";
  readonly id: string;
  readonly title: string;
  readonly nodes: readonly ArchitectureNode<E, R>[];
  readonly partitions: readonly ArchitecturePartition[];
  readonly relations: readonly Relation[];
}
export interface SequenceChart<E = string, R = string> {
  readonly kind: "sequence";
  readonly id: string;
  readonly title: string;
  readonly participants: readonly Participant<E, R>[];
  readonly messages: readonly Message[];
}
export interface Lane {
  readonly id: string;
  readonly label: string;
  readonly height: number;
}
export interface SwimlaneNode<E = string, R = string> extends Participant<E, R> {
  readonly lane: string;
  readonly position: Position;
}
export interface SwimlaneChart<E = string, R = string> {
  readonly kind: "swimlane";
  readonly id: string;
  readonly title: string;
  readonly width: number;
  readonly headerWidth: number;
  readonly lanes: readonly Lane[];
  readonly nodes: readonly SwimlaneNode<E, R>[];
  readonly relations: readonly Relation[];
}
export type Chart = ArchitectureChart | SequenceChart | SwimlaneChart;
export type Diagram =
  | ArchitectureChart<Entity, Role>
  | SequenceChart<Entity, Role>
  | SwimlaneChart<Entity, Role>;
export interface ArchitectureOptions {
  readonly id: string;
  readonly title: string;
  readonly nodes: readonly ArchitectureNode<EntityInput, Role>[];
  readonly partitions?: readonly ArchitecturePartition[];
  readonly relations: readonly RelationInput[];
}
export interface SequenceOptions {
  readonly id: string;
  readonly title: string;
  readonly participants: readonly Participant<EntityInput, Role>[];
  readonly messages: readonly MessageInput[];
}
export interface SwimlaneOptions {
  readonly id: string;
  readonly title: string;
  readonly width: number;
  readonly headerWidth?: number;
  readonly lanes: readonly Lane[];
  readonly nodes: readonly SwimlaneNode<EntityInput, Role>[];
  readonly relations: readonly RelationInput[];
}

export interface SemanticDiagram {
  readonly version: 1;
  readonly entities: readonly Entity[];
  readonly roles: readonly Role[];
  readonly chart: Chart;
}

export type Point = [x: number, y: number];
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface TextLayout {
  lines: string[];
  width: number;
  height: number;
  size: number;
}
export interface NodeLayout extends Rect {
  id: string;
  role: string;
  contentHeight: number;
  title: TextLayout;
  detail: TextLayout | null;
}
export interface ArchitecturePartitionLayout extends Rect {
  id: string;
  title: TextLayout;
  headerHeight: number;
}
export interface EdgeLayout {
  id: string;
  from: string;
  to: string;
  variant: RelationVariant;
  fromSide?: RelationSide;
  toSide?: RelationSide;
  points: Point[];
  path: string;
  label: TextLayout;
  labelX: number;
  labelY: number;
  returning?: boolean;
}
export interface SequenceEdgeLayout extends EdgeLayout {
  arrivalY: number;
  lineY: number;
}
export interface Activation extends Rect {
  id: string;
  callId: string;
  entity: string;
}
export interface Fragment extends Rect {
  id: string;
  operator: "alt";
  branches: { y: number; label: TextLayout }[];
}
export interface ArchitectureScene {
  kind: "architecture";
  id: string;
  width: number;
  height: number;
  nodes: NodeLayout[];
  partitions: ArchitecturePartitionLayout[];
  edges: EdgeLayout[];
}
export interface SequenceScene {
  kind: "sequence";
  id: string;
  width: number;
  height: number;
  nodes: NodeLayout[];
  edges: SequenceEdgeLayout[];
  fragments: Fragment[];
  activations: Activation[];
  lifelines: { x: number; y1: number; y2: number }[];
}
export interface LaneLayout extends Rect {
  id: string;
  title: TextLayout;
  headerWidth: number;
}
export interface SwimlaneScene {
  kind: "swimlane";
  id: string;
  width: number;
  height: number;
  nodes: NodeLayout[];
  lanes: LaneLayout[];
  edges: EdgeLayout[];
}
export type Scene = ArchitectureScene | SequenceScene | SwimlaneScene;
export interface Color {
  ink: string;
  fill: string;
}
export interface LayoutContext {
  entities: Map<string, Entity>;
  colors: Map<string, Color>;
}
