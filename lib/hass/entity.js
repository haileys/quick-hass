import GObject from 'gi://GObject';
import { stringSpec, doubleSpec, booleanSpec } from '../gobject.js';

export function newEntity(hass, entityId) {
    const [entityType] = entityId.split(".");

    switch (entityType) {
    case "input_number": return new InputNumber(hass, entityId);
    case "input_boolean": return new InputBoolean(hass, entityId);
    default:
        throw `unknown home assistant entity type: ${entityId}`;
    }
}

export const BaseEntity = GObject.registerClass({
    Properties: {
        "entity-id": stringSpec("entity-id", GObject.ParamFlags.READABLE),
        "title": stringSpec("title", GObject.ParamFlags.READABLE),
        "ready": booleanSpec("ready", GObject.ParamFlags.READABLE),
    },
},
class BaseEntity extends GObject.Object {
    _hass = null;
    _entityId = null;
    _state = null;

    constructor(hass, entityId) {
        super();
        this._hass = hass;
        this._entityId = entityId;
    }

    willUpdateValue(newValue) {
        const prevValue = this._state.value;

        // nothing to do if no change to value
        if (newValue === prevValue) {
            return false;
        }

        // update this object's own state optimistically
        this._state.value = newValue;
        return true;
    }

    receiveState(state) {
        // update state
        const prevState = this._state;
        const newState = this.constructor.getStateFromUpdate(state);
        this._state = newState;

        // call lifecycle method to notify for property changes
        const notify = (prop, getter) => {
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

    didUpdateState(notify) {
        notify("title", (s) => s.attributes["friendly_name"]);
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
})

export const InputNumber = GObject.registerClass({
    Properties: {
        "value": doubleSpec("value", GObject.ParamFlags.READWRITE),
        "min-value": doubleSpec("min-value", GObject.ParamFlags.READABLE),
        "max-value": doubleSpec("max-value", GObject.ParamFlags.READABLE),
        "step": doubleSpec("step", GObject.ParamFlags.READABLE),
    }
},
class InputNumber extends BaseEntity {
    static getStateFromUpdate(state) {
        return { value: Number(state.state), attributes: state.attributes };
    }

    didUpdateState(notify) {
        super.didUpdateState(notify);

        notify("min-value", (s) => s.attributes["min"]);
        notify("max-value", (s) => s.attributes["max"]);
        notify("step", (s) => s.attributes["step"]);

        // always notify value last to account for min/max changing also:
        notify("value", (s) => s.value);
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
});

export const InputBoolean = GObject.registerClass({
    Properties: {
        "value": booleanSpec("value", GObject.ParamFlags.READWRITE, false),
    }
},
class InputBoolean extends BaseEntity {
    static getStateFromUpdate(state) {
        function tristate(state) {
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

    didUpdateState(notify) {
        super.didUpdateState(notify);
        notify("value", (s) => s.value);
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
                console.warn(`unknown value in InputBoolean.value setter: ${on}`);
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
});
