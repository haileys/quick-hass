import { HassSocket, AnyMessage, MessageReply } from "./hass/socket.js";
import { StateChangedEvent, EntityId, EntityState } from "./hass/types";
import { newEntity, BaseEntity } from "./hass/entity";
import type { HomeAssistant as HomeAssistantConfig } from "../config";

export class HomeAssistant {
    entities: Map<string, BaseEntity>;
    socket: HassSocket;
    private stateReloadScheduled: boolean = false;

    constructor(config: HomeAssistantConfig) {
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

    sendMessage<M extends AnyMessage>(msg: M, callback?: (reply: MessageReply<M>) => void) {
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

    onStateChanged(data: StateChangedEvent) {
        this.receiveEntityState(data.entity_id, data.new_state);
    }

    receiveEntityState(entityId: EntityId, entityState: EntityState) {
        const entity = this.entities.get(entityId);

        if (entity) {
            entity.receiveState(entityState);
        }
    }

    getEntity(id: EntityId): BaseEntity | null {
        if (this.entities.has(id)) {
            return this.entities.get(id) ?? null;
        } else {
            const entity = newEntity(this, id);
            this.entities.set(id, entity);
            this.scheduleStateReload();
            return entity;
        }
    }
}
