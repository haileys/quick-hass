import GLib from "gi://GLib";

import { HassSocket } from "./hass/socket.js";
import { newEntity } from "./hass/entity";

export class HomeAssistant {
    constructor(config) {
        this.states = new Map();
        this.entities = new Map();
        this.socket = new HassSocket(config.url, config.token);
        this.socket.onAuthenticated = () => {
            this.getStates();
            this.subscribeEvents();
        };
    }

    scheduleStateReload() {
        if (this.stateReloadScheduled) {
            return;
        }

        this.stateReloadScheduled = true;

        const task = () => {
            this.stateReloadScheduled = false;
            this.getStates();
        };

        setTimeout(task, 0);
    }

    sendMessage(msg, callback) {
        return this.socket.sendMessage(msg, callback);
    }

    subscribeEvents() {
        this.socket.subscribeEvents("state_changed", (msg) => {
            if (msg.type === "event") {
                this.onStateChanged(msg.event.data);
            }
        });
    }

    getStates() {
        this.socket.sendMessage({ type: "get_states" }, (msg) => {
            for (let entity of msg.result) {
                this.receiveEntityState(entity.entity_id, entity);
            }
        });
    }

    onStateChanged(data) {
        this.receiveEntityState(data.entity_id, data.new_state);
    }

    receiveEntityState(entityId, entityState) {
        const entity = this.entities.get(entityId);

        if (entity) {
            entity.receiveState(entityState);
        }
    }

    getEntity(id) {
        if (this.entities.has(id)) {
            return this.entities.get(id);
        } else {
            const entity = newEntity(this, id);
            this.entities.set(id, entity);
            this.scheduleStateReload();
            return entity;
        }
    }
}
