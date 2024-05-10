import Soup from "gi://Soup?version=3.0";
import GLib from "gi://GLib";

import { HassSocket } from "./hass/socket.js";

const ENTITY_TEMP_REQUEST = "input_number.thermostat_request_temperature";
const ENTITY_HEATING_SWITCH = "input_boolean.heating";

export class HomeAssistant {
    constructor(config, interestedEntityIds) {
        this.states = new Map();
        this.entities = new Map();
        this.socket = new HassSocket(config.url, config.token);

        for (const id of interestedEntityIds) {
            this.entities.set(id, null);
        }

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

        const handler = () => { this.loadStates(); };
        setTimeout(handler, 0);
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
                if (this.entities.has(entity.entity_id)) {
                    console.log(entity);
                }
                this.receiveEntityState(entity.entity_id, entity.state);
            }
        });
    }

    onStateChanged(data) {
        this.receiveEntityState(data.entity_id, data.new_state.state);
    }

    receiveEntityState(entity_id, state) {
        const slot = this.states.get(entity_id);
        if (!slot) {
            return;
        }

        const entityRef = slot.ref.deref();
        if (!entityRef) {
            return;
        }

        entityRef.receiveState(state);
    }

    inputBoolean(entity_id) {
        return this.entity(entity_id, InputBoolean);
    }

    inputNumber(entity_id) {
        return this.entity(entity_id, InputNumber);
    }

    entity(entity_id, constructor) {
        if (this.states.has(entity_id)) {
            const slot = this.states.get(entity_id);
            const ref = slot.ref.deref();
            if (ref) {
                return ref;
            }
        }

        const entity = new constructor(this, entity_id);
        const slot = { ref: new WeakRef(entity) };
        this.states.set(entity_id, slot);
        this.scheduleStateReload();
        return entity;
    }
}

export class Entity {
    constructor(hass) {
        this.hass = hass;
        this.bindings = [];
        this.stateValue = null;
        this.hasStateValue = false;
        this.inflightState;
        this.hasInflightState = false;
    }

    bindState(func) {
        this.bindings.push(func);

        if (this.hasStateValue) {
            func(this.stateValue);
        }
    }

    setState(state) {
        if (this.hasStateValue && this.stateValue === state) {
            return;
        }

        if (this.hasInflightState && this.inflightState === state) {
            return;
        }

        this.hasInflightState = true;
        this.inflightState = state;

        this.callService(state);
    }

    receiveState(state) {
        state = this.parseState(state);

        this.hasStateValue = true;
        this.stateValue = state;

        if (this.hasInflightState) {
            if (this.inflightState === state) {
                this.hasInflightState = false;
                this.inflightState = null;
            }
        }

        for (let binding of this.bindings) {
            binding(state);
        }
    }
}

export class InputBoolean extends Entity {
    constructor(hass, entity_id) {
        super(hass);
        this.entity_id = entity_id;
    }

    parseState(state) {
        if (state === "on") {
            return true;
        } else if (state === "off") {
            return false;
        } else {
            return null;
        }
    }

    callService(state) {
        let service;
        if (state === true) {
            service = "turn_on";
        } else if (state === false) {
            service = "turn_off";
        } else {
            console.warn(`unknown state in InputBoolean.callService: ${on}`);
            return;
        }

        console.log(`calling service input_boolean.${service}`);

        this.hass.socket.sendMessage({
            type: "call_service",
            domain: "input_boolean",
            service,
            target: { entity_id: this.entity_id },
        });
    }
}

export class InputNumber extends Entity {
    constructor(hass, entity_id) {
        super(hass);
        this.entity_id = entity_id;
    }

    parseState(state) {
        return Number(state);
    }

    callService(state) {
        console.log("calling service input_number.set_value");

        this.hass.socket.sendMessage({
            type: "call_service",
            domain: "input_number",
            service: "set_value",
            target: { entity_id: this.entity_id },
            service_data: {
                value: state,
            }
        });
    }
}

function hassOnOffToTristate(onoff) {
    if (onoff === "on") {
        return true;
    } else if (onoff === "off") {
        return false;
    } else {
        return null;
    }
}
