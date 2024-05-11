import GObject from "gi://GObject";
import { stringSpec, doubleSpec, booleanSpec, registerClass } from "../gobject";
import type { HomeAssistant } from "../hass";
import type { EntityId, EntityState } from "./types";

export function newEntity(hass: HomeAssistant, entityId: EntityId) {
    const [entityType] = entityId.split(".");

    switch (entityType) {
    case "input_number": return new InputNumber(hass, entityId);
    case "input_boolean": return new InputBoolean(hass, entityId);
    case "input_select": return new InputSelect(hass, entityId);
    default:
        throw `unknown home assistant entity type: ${entityId}`;
    }
}

@registerClass({
    Properties: {
        "entity-id": stringSpec("entity-id", GObject.ParamFlags.READABLE),
        "title": stringSpec("title", GObject.ParamFlags.READABLE),
        "ready": booleanSpec("ready", GObject.ParamFlags.READABLE, false),
    },
})
export class BaseEntity extends GObject.Object {
    _hass: HomeAssistant;
    _entityId: EntityId;
    _state: { value: any, attributes: any } | null = null;

    constructor(hass: HomeAssistant, entityId: EntityId) {
        super();
        this._hass = hass;
        this._entityId = entityId;
    }

    willUpdateValue(newValue: any) {
        if (!this._state) {
            // can't update entity state from our side until it's
            // loaded from hass side
            return false;
        }

        const prevValue = this._state.value;

        // nothing to do if no change to value
        if (newValue === prevValue) {
            return false;
        }

        // update this object's own state optimistically
        this._state.value = newValue;
        return true;
    }

    getStateFromUpdate(state: EntityState): { value: any, attributes: any } {
        throw new Error("must be overridden in subclass");
    }

    receiveState(state: EntityState) {
        // update state
        const prevState = this._state;
        const newState = this.getStateFromUpdate(state);
        this._state = newState;

        // call lifecycle method to notify for property changes
        const notify = (prop: string, getter: (_: any) => any) => {
            console.log(`notifying ${prop}, prev + new state:`, prevState && getter(prevState), getter(newState));
            if(prevState === null || getter(prevState) !== getter(newState)) {
                this.notify(prop);
            }
        }

        this.didUpdateState(notify);

        // if this is the first update, notify ready
        if (prevState === null) {
            this.notify("ready");
        }
    }

    didUpdateState(notify: any) {
        notify("title", (s: any) => s.attributes["friendly_name"]);
    }

    get hass() {
        return this._hass;
    }

    get entity_id() {
        return this._entityId;
    }

    get title() {
        return this._state?.attributes?.friendly_name ?? this.entity_id;
    }

    get ready() {
        return this._state !== null;
    }
}

@registerClass({
    Properties: {
        "value": doubleSpec("value", GObject.ParamFlags.READWRITE),
        "min-value": doubleSpec("min-value", GObject.ParamFlags.READABLE),
        "max-value": doubleSpec("max-value", GObject.ParamFlags.READABLE),
        "step": doubleSpec("step", GObject.ParamFlags.READABLE),
    }
})
export class InputNumber extends BaseEntity {
    getStateFromUpdate(state: any) {
        return { value: Number(state.state), attributes: state.attributes };
    }

    didUpdateState(notify: any) {
        super.didUpdateState(notify);

        notify("min-value", (s: any) => s.attributes["min"]);
        notify("max-value", (s: any) => s.attributes["max"]);
        notify("step", (s: any) => s.attributes["step"]);

        // always notify value last to account for min/max changing also:
        notify("value", (s: any) => s.value);
    }

    get value() {
        console.log("getting InputNumber value!", this._state?.value);

        return this._state?.value ?? 0;
    }

    set value(value) {
        if (this.willUpdateValue(value)) {
            this._hass.sendMessage({
                type: "call_service",
                domain: "input_number",
                service: "set_value",
                target: { entity_id: this.entity_id },
                service_data: { value }
            });
        }
    }

    get min_value() {
        return this._state?.attributes?.min ?? 0;
    }

    get max_value() {
        return this._state?.attributes?.max ?? 0;
    }

    get step() {
        return this._state?.attributes?.step ?? 0;
    }
}

@registerClass({
    Properties: {
        "value": booleanSpec("value", GObject.ParamFlags.READWRITE, false),
    }
})
export class InputBoolean extends BaseEntity {
    getStateFromUpdate(state: any) {
        function tristate(state: any) {
            if (state === "on") {
                return true;
            } else if (state === "off") {
                return false;
            } else {
                return null;
            }
        }

        return { value: tristate(state.state), attributes: state.attributes };
    }

    didUpdateState(notify: any) {
        super.didUpdateState(notify);
        notify("value", (s: any) => s.value);
    }

    get value() {
        return this._state?.value ?? false;
    }

    set value(value) {
        if (this.willUpdateValue(value)) {
            let service;
            if (value === true) {
                service = "turn_on";
            } else if (value === false) {
                service = "turn_off";
            } else {
                console.warn(`unknown value in InputBoolean.value setter: ${value}`);
                return;
            }

            console.log(`calling service input_boolean.${service}`);

            this._hass.sendMessage({
                type: "call_service",
                domain: "input_boolean",
                service,
                target: { entity_id: this.entity_id },
            });
        }
    }
}

@registerClass({
    Properties: {
        "options": GObject.ParamSpec.jsobject("options", "", "", GObject.ParamFlags.READABLE),
        "value": stringSpec("value", GObject.ParamFlags.READWRITE),
    }
})
export class InputSelect extends BaseEntity {
    getStateFromUpdate(state: any) {
        return { value: state.state, attributes: state.attributes };
    }

    didUpdateState(notify: any) {
        super.didUpdateState(notify);
        notify("options", (s: any) => JSON.stringify(s.attributes.options));
        notify("value", (s: any) => s.value);
        console.log("didUpdateState: ", this.value);
    }

    get options() {
        return this._state?.attributes?.options ?? [];
    }

    get value() {
        return this._state?.value ?? null;
    }

    set value(value) {
        if (this.willUpdateValue(value)) {
            this._hass.sendMessage({
                type: "call_service",
                domain: "input_select",
                service: "select_option",
                target: { entity_id: this.entity_id },
                service_data: { option: value },
            });

            this.notify("value");
        }
    }
}
