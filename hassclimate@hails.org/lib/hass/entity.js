import GObject from 'gi://GObject';
import { stringSpec, doubleSpec, booleanSpec } from '../gobject.js';

export function newEntity(hass, entityId) {
    const [entityType] = entityId.split(".");

    const ctors = {
        input_number: InputNumber,
        input_boolean: InputBoolean,
        input_select: InputSelect,
        climate: Climate,
    };

    const ctor = ctors[entityType];
    if (ctor) {
        return new ctor(hass, entityId);
    }

    throw `unknown home assistant entity type: ${entityId}`;
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

    didUpdateState(notify) {
        notify("title", (s) => s.attributes["friendly_name"]);
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

export const InputSelect = GObject.registerClass({
    Properties: {
        "options": GObject.ParamSpec.jsobject("options", "", "", GObject.ParamFlags.READABLE),
        "value": stringSpec("value", GObject.ParamFlags.READWRITE),
    }
},
class InputSelect extends BaseEntity {
    static getStateFromUpdate(state) {
        return { value: state.state, attributes: state.attributes };
    }

    didUpdateState(notify) {
        super.didUpdateState(notify);
        notify("options", (s) => JSON.stringify(s.attributes.options));
        notify("value", (s) => s.value);
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
});

export const Climate = GObject.registerClass({
    Properties: {
        "mode": stringSpec("mode", GObject.ParamFlags.READWRITE),
        "current-temp": doubleSpec("current-temp", GObject.ParamFlags.READWRITE),
        "set-temp": doubleSpec("set-temp", GObject.ParamFlags.READWRITE),
        "set-temp-step": doubleSpec("set-temp-step", GObject.ParamFlags.READWRITE),
        "fan-mode": stringSpec("fan-mode", GObject.ParamFlags.READWRITE),
        "min-temp": doubleSpec("min-temp", GObject.ParamFlags.READWRITE),
        "max-temp": doubleSpec("max-temp", GObject.ParamFlags.READWRITE),
    }
},
class Climate extends BaseEntity {
    _isNotifying = false;

    static getStateFromUpdate(state) {
        return { mode: state.state, attributes: state.attributes };
    }

    didUpdateState(notify) {
        super.didUpdateState(notify);

        // notify these ones first because they affect rounding in the ui
        // slider, which will cause a temp change to come back straight
        // away if set_temp is notified first:
        notify("min-temp", (s) => s.attributes?.min_temp);
        notify("max-temp", (s) => s.attributes?.max_temp);
        notify("set-temp-step", (s) => s.attributes?.target_temp_step);

        // now notify normal props
        notify("mode", (s) => s.mode);
        notify("fan-mode", (s) => s.attributes?.fan_mode);
        notify("current-temp", (s) => s.attributes?.current_temperature);
        notify("set-temp", (s) => s.attributes?.temperature);
    }

    _callService(method, params) {
        const stack = new Error().stack;
        console.log();
        console.log(`++++++ Climate._callService: ${method} ${JSON.stringify(params)}`);
        console.log(stack);
        console.log();
        this._hass.sendMessage({
            type: "call_service",
            domain: "climate",
            service: method,
            target: { entity_id: this.entity_id },
            service_data: params,
        });
    }

    get mode() {
        return this._state?.mode ?? null;
    }

    set mode(mode) {
        if (this.mode !== mode) {
            this._callService("set_hvac_mode", { hvac_mode: mode });
        }
    }

    get attributes() {
        return this._state?.attributes ?? null;
    }

    get current_temp() {
        return this.attributes?.current_temperature;
    }

    get set_temp() {
        return this.attributes?.temperature;
    }

    set set_temp(temp) {
        console.log(`this.set_temp = ${this.set_temp}`);
        console.log(`temp = ${temp}`);

        if (this.set_temp === null) {
            // this is a mode that doesn't have a set temp
            return;
        }

        const difference = Math.abs(this.set_temp - temp);
        const roundingThreshold = this.set_temp_step / 2;
        if (difference >= roundingThreshold) {
            this._callService("set_temperature", { temperature: temp });
        }
    }

    get set_temp_step() {
        return this.attributes?.target_temp_step;
    }

    get fan_mode() {
        return this.attributes?.fan_mode;
    }

    set fan_mode(mode) {
        if (this.fan_mode !== mode) {
            this._callService("set_fan_mode", { fan_mode: mode });
        }
    }

    get min_temp() {
        return this.attributes?.min_temp;
    }

    get max_temp() {
        return this.attributes?.max_temp;
    }
})
