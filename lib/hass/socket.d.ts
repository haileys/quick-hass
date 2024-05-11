import type { EntityState, StateChangedEvent } from "./types";

export type EventData =
    | { type: "event", event: { data: StateChangedEvent } }
    | { type: "other" }
    ;

export type GetStatesMsg = { type: "get_states" };
export type GetStatesReply = { result: EntityState[] };

export type CallServiceMsg = { type: "call_service" };
export type CallServiceReply = {};

export type MessagePairs =
    | { msg: GetStatesMsg, reply: GetStatesReply }
    | { msg: CallServiceMsg, reply: CallServiceReply }
    ;

type AnyMessage = MessagePairs["msg"];
type MessageReply<M extends AnyMessage> = Extract<MessagePairs, { msg: { type: M["type"] } }>["reply"];

export class HassSocket {
    constructor(url: string, token: string);
    onAuthenticated(): void;
    sendMessage<M extends AnyMessage>(message: M, callback?: (reply: MessageReply<M>) => void): void;
    subscribeEvents(event_type: string, callback?: (event: EventData) => void): void;
}
