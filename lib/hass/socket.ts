import Soup from "gi://Soup?version=3.0";
import GLib from "gi://GLib";

import type { EntityState, StateChangedEvent } from "./types.js";
import { HomeAssistant as HomeAssistantConfig } from "../../config.js";

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

export type AnyMessage = MessagePairs["msg"];
export type AnyReply = MessagePairs["reply"] & { id: number };
export type MessageReply<M extends AnyMessage> = Extract<MessagePairs, { msg: { type: M["type"] } }>["reply"];

export class HassSocket {
    config: HomeAssistantConfig;
    decoder = new TextDecoder();
    connection: null | Soup.WebsocketConnection = null;
    msgId = 1;
    msgHandlers: { [id: number]: { callback?: Function, oneshot: boolean } } = {};

    constructor(config: HomeAssistantConfig) {
        this.config = config;
        this.connect();
    }

    connect() {
        const session = new Soup.Session();

        const message = new Soup.Message({
            method: "GET", uri: GLib.Uri.parse(this.config.url, GLib.UriFlags.NONE),
        });

        session.websocket_connect_async(message, null, [], 0, null, (_session, result) => {
            try {
                const connection = session.websocket_connect_finish(result);
                this.onConnection(connection);
            } catch (err) {
                console.warn(`error connecting to: ${this.config.url}: ${err}`);
                this.reconnectLater();
            }
        });
    }

    reconnectLater() {
        setTimeout(() => { this.connect(); }, 1000);
    }

    onConnectionBroken(previousConnection: null | Soup.WebsocketConnection) {
        if (this.connection === previousConnection) {
            this.connection = null;
            this.reconnectLater();
        }
    }

    onConnection(connection: Soup.WebsocketConnection) {
        connection.connect("closed", () => {
            console.warn(`connection closed: ${this.config.url}`);
            this.onConnectionBroken(connection);
        });

        connection.connect('error', (self, err) => {
            console.warn(`connection error: ${this.config.url}: ${err}`);
            this.onConnectionBroken(connection);
        });

        connection.connect('message', (self, type, data) => {
            if (type !== Soup.WebsocketDataType.TEXT) {
                return;
            }

            const str = this.decoder.decode(data.toArray());
            const msg = JSON.parse(str);

            if (msg.type === "auth_required") {
                this.sendRaw({ type: "auth", access_token: this.config.token });
                return;
            }

            if (msg.type === "auth_ok") {
                this.onAuthenticated();
                return;
            }

            this.onMessage(msg);
        });

        this.connection = connection;
    }

    sendRaw(msg: object) {
        if (this.connection) {
            this.connection.send_text(JSON.stringify(msg));
        } else {
            throw new Error("not connected!");
        }
    }

    sendMessage<M extends AnyMessage>(msg: M, callback?: (reply: MessageReply<M>) => void) {
        const id = this.msgId++;
        this.sendRaw({ id, ...msg });
        this.msgHandlers[id] = { callback, oneshot: true };
        return id;
    }

    subscribeEvents(event_type: string, callback?: (event: EventData) => void) {
        const id = this.msgId++;
        this.sendRaw({ id, type: "subscribe_events", event_type });
        this.msgHandlers[id] = { callback, oneshot: false };
    }

    onAuthenticated() {}

    onMessage(msg: AnyReply) {
        const handler = this.msgHandlers[msg.id];

        if (!handler) {
            console.warn("no handler for message? " + JSON.stringify(msg));
            return;
        }

        try {
            const callback = handler.callback;
            if (callback) {
                callback(msg);
            } else {
                console.warn("no callback for message? " + JSON.stringify(msg));
            }
        } finally {
            if (handler.oneshot) {
                delete this.msgHandlers[msg.id];
            }
        }
    }
}
