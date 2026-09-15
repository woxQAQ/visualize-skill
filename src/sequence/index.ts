import type {
  ChartMeta,
  EntityInput,
  Role,
  EntityRef,
  Participant,
  Rect,
  TextLayout,
  NodeLayout,
  ConnectionLayout,
} from "../shared/model.ts";

/**
 * Entity header and lifeline in a sequence diagram; array order determines horizontal placement.
 */
export interface SequenceParticipant<E = string, R = string> extends Participant<E, R> {
  /**
   * Optional ID in this chart's partitions; all participants using the same ID must be contiguous.
   */
  readonly partition?: string;
}

/**
 * Group of consecutive sequence participants. Geometry is derived from members and message extent.
 */
export interface SequencePartition {
  /** Unique within the chart's partitions. Use a stable identifier matching [a-z][a-z0-9-]*. */
  readonly id: string;
  /** Trimmed, nonempty single-line text with no tabs; at most 48 Unicode code points. */
  readonly label: string;
}

/** Message behaviors controlling response validation, execution bars and arrow shape. */
export const messageKinds = ["sync", "async", "reply"] as const;

/** sync waits for a reply; async does not wait; reply responds to an earlier message. */
export type MessageKind = (typeof messageKinds)[number];

/** Visual emphasis presets, independent of message behavior. */
export const messageVariants = ["default", "emphasis", "security"] as const;

/** Controls color, stroke width and label weight without changing message behavior. */
export type MessageVariant = (typeof messageVariants)[number];

/**
 * Normalized ordered sequence event. Synchronous calls use one stack; asynchronous messages do not
 * create activations.
 */
export interface Message {
  /** Unique within the chart's messages. Use a stable identifier matching [a-z][a-z0-9-]*. */
  readonly id: string;
  /**
   * Sender entity ID; must appear in participants. A nested synchronous call must originate from
   * the currently executing receiver.
   */
  readonly from: string;
  /** Receiver entity ID present in participants; equal endpoints represent a self-message. */
  readonly to: string;
  /** Nonempty event description; layout adds its own sequence number, so do not prefix a number. */
  readonly label: string;
  /** sync requires a reply; async allows an optional reply; reply responds to an earlier message. */
  readonly kind: MessageKind;
  /** Visual emphasis only; does not affect response rules, execution bars or arrow shape. */
  readonly variant: MessageVariant;
  /**
   * Required for kind reply and forbidden for every other kind: ID of an earlier sync or async
   * message. Reverse its endpoints; allow one response per message and close synchronous calls
   * innermost first.
   */
  readonly replyTo?: string;
}

/**
 * Input event for sequence(); endpoints resolve by entity ID and do not register new participants.
 */
export interface MessageInput {
  /** Unique within the chart's messages. Use a stable identifier matching [a-z][a-z0-9-]*. */
  readonly id: string;
  /** Sender entity definition or ID; its ID must already appear in participants. */
  readonly from: EntityRef;
  /**
   * Receiver entity definition or ID; its ID must already appear in participants. Self-messages
   * are allowed.
   */
  readonly to: EntityRef;
  /**
   * Nonempty event description without a manual sequence number; numbering is generated during
   * layout.
   */
  readonly label: string;
  /**
   * Defaults to sync. sync requires a reply; async allows an optional reply; reply responds to an
   * earlier message. Awaited operations are sync even when implemented with async functions.
   */
  readonly kind?: MessageKind;
  /** Defaults to default. Controls visual emphasis independently of kind. */
  readonly variant?: MessageVariant;
  /**
   * Required for kind reply and forbidden for every other kind: ID of an earlier sync or async
   * message. Reverse its endpoints; allow one response per message and close synchronous calls
   * innermost first.
   */
  readonly replyTo?: string;
}

/**
 * Normalized sequence declaration. E/R are full definitions in SDK output and identifier strings
 * in semantic data.
 */
export interface SequenceChart<E = string, R = string> {
  /** Discriminator selecting sequence validation, layout and rendering. */
  readonly kind: "sequence";
  /**
   * Chart identifier used in diagnostics and generated HTML IDs. Use a stable identifier matching
   * [a-z][a-z0-9-]*.
   */
  readonly id: string;
  /** Shared title and optional subtitle; plain text, not markup. */
  readonly meta: ChartMeta;
  /**
   * Declare 1 to 6 participants in left-to-right order, each entity once; keep partition members
   * contiguous.
   */
  readonly participants: readonly SequenceParticipant<E, R>[];
  /**
   * Groups referenced by participant.partition; every group must contain a contiguous, nonempty
   * run of participants. Empty when no groups are declared.
   */
  readonly partitions: readonly SequencePartition[];
  /**
   * Declare 1 to 32 messages in execution order with unique IDs; close every synchronous call with
   * a response.
   */
  readonly messages: readonly Message[];
}

/**
 * Input to sequence(); declare event order and participant order; header sizes and positions are computed.
 */
export interface SequenceOptions {
  /**
   * Chart identifier used in diagnostics and generated HTML IDs. Use a stable identifier matching
   * [a-z][a-z0-9-]*.
   */
  readonly id: string;
  /** Shared title and optional subtitle; plain text, not markup. */
  readonly meta: ChartMeta;
  /**
   * Declare 1 to 6 participants in left-to-right order, each entity once; keep partition members
   * contiguous. Supply full entity and role definitions.
   */
  readonly participants: readonly SequenceParticipant<EntityInput, Role>[];
  /**
   * Groups referenced by participant.partition; every group must contain a contiguous, nonempty
   * run of participants. Omission normalizes to an empty array.
   */
  readonly partitions?: readonly SequencePartition[];
  /**
   * Declare 1 to 32 messages in execution order with unique IDs; close every synchronous call with
   * a response.
   */
  readonly messages: readonly MessageInput[];
}

/**
 * Computed message route with execution coordinates; inherited label text includes the generated
 * event number.
 */
export interface SequenceEdgeLayout extends ConnectionLayout {
  /** Original message behavior used to select line dashes and arrow shape. */
  kind: MessageKind;
  /** Original visual emphasis used to select color, stroke width and label weight. */
  variant: MessageVariant;
  /**
   * Absolute receiver arrival coordinate; equals lineY for ordinary messages and lies below it for
   * self-messages.
   */
  arrivalY: number;
  /**
   * Absolute sender departure coordinate; synchronous responses also end the corresponding
   * activation at this height.
   */
  lineY: number;
}

/**
 * Computed execution bar opened on a synchronous call receiver and closed by its matching
 * response; nested bars shift horizontally.
 */
export interface Activation extends Rect {
  /** Generated geometry identifier formed as <callId>-activation. */
  id: string;
  /** ID of the synchronous message that opened this bar. */
  callId: string;
  /** Receiver entity ID; identifies the participant lifeline carrying this bar. */
  entity: string;
}

/** Computed sequence geometry returned by compile(); all coordinates share the same SVG canvas. */
export interface SequenceScene {
  /** Discriminator selecting sequence SVG rendering. */
  kind: "sequence";
  /** Original chart ID used to scope rendered elements. */
  id: string;
  /** Computed canvas width including participants, message extents and margins. */
  width: number;
  /** Computed canvas height including headers, all messages and margins. */
  height: number;
  /** Participant header boxes in declaration order; node IDs are participant entity IDs. */
  nodes: NodeLayout[];
  /** Group frames enclosing member headers and their full lifeline extent. */
  partitions: SequencePartitionLayout[];
  /** Message routes in execution order, with numbered labels. */
  edges: SequenceEdgeLayout[];
  /**
   * Completed synchronous execution bars with positive height; asynchronous messages create none.
   */
  activations: Activation[];
  /** One vertical line per participant in nodes order; coordinates are absolute canvas units. */
  lifelines: {
    /** Horizontal center of the corresponding participant header. */
    x: number;
    /** Start coordinate at the bottom edge of the participant header. */
    y1: number;
    /** End coordinate below the final message; shared by all lifelines in the scene. */
    y2: number;
  }[];
}

/**
 * Computed frame for a contiguous participant group; extends from above the headers through the
 * message area.
 */
export interface SequencePartitionLayout extends Rect {
  /** Original SequencePartition.id used to identify the rendered group. */
  id: string;
  /** Wrapped participant-group label. */
  title: TextLayout;
}
