export interface Tag { readonly id: string; readonly label: string }
export interface EntityInput {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tags?: readonly Tag[];
}
export interface Entity extends EntityInput { readonly tags: readonly Tag[] }
export interface Role { readonly id: string; readonly label: string }
export interface Position { readonly x: number; readonly y: number }
export interface Size { readonly width: number; readonly height: number }
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
export interface Partition {
  readonly id: string;
  readonly label: string;
  readonly position: Position;
  readonly size: Size;
}
export interface Relation {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
}
export type RelationInput = Omit<Relation, 'from' | 'to'> & { readonly from: EntityRef; readonly to: EntityRef };
export interface Call extends Relation { readonly kind: 'call' }
export interface Return extends Relation { readonly kind: 'return'; readonly replyTo: string }
export interface Alternative {
  readonly id: string;
  readonly kind: 'alternative';
  readonly branches: readonly { readonly label: string; readonly steps: readonly Step[] }[];
}
export type Step = Call | Return | Alternative;
export type StepInput = (RelationInput & { readonly replyTo?: string }) | {
  readonly id: string;
  readonly kind: 'alternative';
  readonly branches: readonly { readonly label: string; readonly steps: readonly StepInput[] }[];
};
export interface ArchitectureChart<E = string, R = string> {
  readonly kind: 'architecture';
  readonly id: string;
  readonly title: string;
  readonly nodes: readonly ArchitectureNode<E, R>[];
  readonly partitions: readonly Partition[];
  readonly relations: readonly Relation[];
}
export interface SequenceChart<E = string, R = string> {
  readonly kind: 'sequence';
  readonly id: string;
  readonly title: string;
  readonly participants: readonly Participant<E, R>[];
  readonly steps: readonly Step[];
}
export type Chart = ArchitectureChart | SequenceChart;
export type Diagram = ArchitectureChart<Entity, Role> | SequenceChart<Entity, Role>;
export interface ArchitectureOptions {
  readonly id: string;
  readonly title: string;
  readonly nodes: readonly ArchitectureNode<EntityInput, Role>[];
  readonly partitions?: readonly Partition[];
  readonly relations: readonly RelationInput[];
}
export interface SequenceOptions {
  readonly id: string;
  readonly title: string;
  readonly participants: readonly Participant<EntityInput, Role>[];
  readonly steps: readonly StepInput[];
}

export type Inline =
  | { readonly kind: 'text' | 'code'; readonly text: string }
  | { readonly kind: 'strong' | 'emphasis'; readonly children: readonly Inline[] }
  | { readonly kind: 'link'; readonly href: string; readonly title?: string; readonly children: readonly Inline[] }
  | { readonly kind: 'break' };
export type TableAlignment = 'left' | 'center' | 'right' | null;
export type MarkdownBlock =
  | { readonly kind: 'paragraph'; readonly children: readonly Inline[] }
  | { readonly kind: 'heading'; readonly level: number; readonly children: readonly Inline[] }
  | { readonly kind: 'codeBlock'; readonly language: string; readonly text: string }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly start: number; readonly tight: boolean; readonly items: readonly (readonly MarkdownBlock[])[] }
  | { readonly kind: 'blockquote'; readonly children: readonly MarkdownBlock[] }
  | { readonly kind: 'table'; readonly align: readonly TableAlignment[]; readonly header: readonly (readonly Inline[])[]; readonly rows: readonly (readonly (readonly Inline[])[])[] }
  | { readonly kind: 'thematicBreak' };
export type Block<C = Chart> =
  | { readonly kind: 'markdown'; readonly content: readonly MarkdownBlock[] }
  | { readonly kind: 'diagram'; readonly content: C };
export interface SemanticDocument {
  readonly version: 1;
  readonly entities: readonly Entity[];
  readonly roles: readonly Role[];
  readonly blocks: readonly Block[];
}

export type Point = [x: number, y: number];
export interface Rect { x: number; y: number; width: number; height: number }
export interface TextLayout { lines: string[]; width: number; height: number; size: number }
export interface NodeLayout extends Rect {
  id: string;
  role: string;
  contentHeight: number;
  title: TextLayout;
  detail: TextLayout | null;
}
export interface PartitionLayout extends Rect {
  id: string;
  title: TextLayout;
  headerHeight: number;
}
export interface EdgeLayout {
  id: string;
  from: string;
  to: string;
  points: Point[];
  path: string;
  label: TextLayout;
  labelX: number;
  labelY: number;
  dashed?: boolean;
}
export interface SequenceEdgeLayout extends EdgeLayout { arrivalY: number; lineY: number }
export interface Activation extends Rect { id: string; callId: string; entity: string }
export interface Fragment extends Rect { id: string; operator: 'alt'; branches: { y: number; label: TextLayout }[] }
export interface ArchitectureScene {
  kind: 'architecture'; id: string; width: number; height: number;
  nodes: NodeLayout[]; partitions: PartitionLayout[]; edges: EdgeLayout[];
}
export interface SequenceScene {
  kind: 'sequence'; id: string; width: number; height: number;
  nodes: NodeLayout[]; edges: SequenceEdgeLayout[]; fragments: Fragment[]; activations: Activation[];
  lifelines: { x: number; y1: number; y2: number }[];
}
export type Scene = ArchitectureScene | SequenceScene;
export interface Color { ink: string; fill: string }
export interface LayoutContext { entities: Map<string, Entity>; colors: Map<string, Color> }
