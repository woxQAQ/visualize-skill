import type { ChartMeta } from "../types.ts";
import type {
  SequenceParticipant,
  SequencePartition,
  MessageInput,
  MessageKind,
  MessageVariant,
} from "./index.ts";
import type { Rect, TextLayout, NodeLayout, ConnectionLayout } from "../shared/model.ts";

/** Internal event with endpoint references and message defaults resolved by the SDK. */
export interface Message extends Omit<MessageInput, "from" | "to" | "kind" | "variant"> {
  readonly from: string;
  readonly to: string;
  readonly kind: MessageKind;
  readonly variant: MessageVariant;
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
 * Computed message route with execution coordinates; inherited label text includes the generated
 * event number.
 */
export interface SequenceEdgeLayout extends ConnectionLayout {
  /** Original message behavior used to select default color, line dashes and arrow shape. */
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
