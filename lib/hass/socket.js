import Soup from "gi://Soup?version=3.0";
import GLib from "gi://GLib";

export class HassSocket {
    session;
    decoder;
    connection = null;
    msgId = 1;
    msgHandlers = {};

    constructor(url, token) {
        this.url = url;
        this.token = token;
        this.reconnect();
    }

    reconnect() {
        this.session = new Soup.Session();
        this.decoder = new TextDecoder();

        const message = new Soup.Message({
            method: "GET", uri: GLib.Uri.parse(this.url, GLib.UriFlags.NONE),
        });

        this.session.websocket_connect_async(message, null, [], null, null, this.connectCallback.bind(this));
    }

    retryLater() {
        setTimeout(() => { this.reconnect(); }, 1000);
    }

    connectCallback(_session, res) {
        try {
            this.connection = this.session.websocket_connect_finish(res);
            console.log(`connected to: ${this.url}`);
        } catch (err) {
            console.warn(`error connecting to: ${this.url}: ${err}`);
            this.retryLater();
            return;
        }

        this.connection.connect("closed", () => {
            console.warn(`connection closed: ${this.url}`);
            this.retryLater();
        });

        this.connection.connect('error', (self, err) => {
            console.warn(`connection error: ${this.url}: ${err}`);
            this.retryLater();
        });

        this.connection.connect('message', (self, type, data) => {
            if (type !== Soup.WebsocketDataType.TEXT) {
                return;
            }

            const str = this.decoder.decode(data.toArray());
            const msg = JSON.parse(str);

            if (msg.type === "auth_required") {
                this.sendRaw({ type: "auth", access_token: this.token });
                return;
            }

            if (msg.type === "auth_ok") {
                this.onAuthenticated();
                return;
            }

            this.onMessage(msg);
        });

    }

    sendRaw(msg) {
        this.connection.send_text(JSON.stringify(msg));
    }

    sendMessage(msg, callback) {
        const id = this.msgId++;
        this.sendRaw({ id, ...msg });
        this.msgHandlers[id] = { callback, oneshot: true };
        return id;
    }

    subscribeEvents(event_type, callback) {
        const id = this.msgId++;
        this.sendRaw({ id, type: "subscribe_events", event_type });
        this.msgHandlers[id] = { callback, oneshot: false };
    }

    onAuthenticated() {}

    onMessage(msg) {
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
