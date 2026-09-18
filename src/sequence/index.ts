import type { ChartMeta, EntityInput, Role, Appearance } from "../types.ts";

/**
 * Entity header and lifeline in a sequence diagram; array order determines horizontal placement.
 */
export interface SequenceParticipant<E = EntityInput, R = Role> extends Appearance<E, R> {
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

/** Message behaviors controlling response validation, execution bars, default color and arrow shape. */
export const messageKinds = ["sync", "async", "reply"] as const;

/** sync waits for a reply; async does not wait; reply responds to an earlier message. */
export type MessageKind = (typeof messageKinds)[number];

/** Visual emphasis presets, independent of message behavior. */
export const messageVariants = ["default", "emphasis", "security"] as const;

/** Controls color, stroke width and label weight without changing message behavior. */
export type MessageVariant = (typeof messageVariants)[number];

/**
 * Input event for sequence(); endpoints resolve by entity ID and do not register new participants.
 */
export interface MessageInput {
  /** Unique within the chart's messages. Use a stable identifier matching [a-z][a-z0-9-]*. */
  readonly id: string;
  /**
   * Sender entity ID; it must already appear in participants. A nested synchronous call must
   * originate from the currently executing receiver.
   */
  readonly from: string;
  /**
   * Receiver entity ID; it must already appear in participants. Self-messages are allowed.
   */
  readonly to: string;
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
  /** Defaults to default, which uses the kind's color. emphasis and security override that color. */
  readonly variant?: MessageVariant;
  /**
   * Required for kind reply and forbidden for every other kind: ID of an earlier sync or async
   * message. Reverse its endpoints; allow one response per message and close synchronous calls
   * innermost first.
   */
  readonly replyTo?: string;
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
  readonly participants: readonly SequenceParticipant[];
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
