import St from "gi://St";
import GObject from 'gi://GObject';
import { Switch } from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Slider as UiSlider } from "resource:///org/gnome/shell/ui/slider.js";

import { doubleSpec, booleanSpec, bindProperty, registerClass } from "./gobject.js";

interface SliderConstructorProps extends St.Bin.ConstructorProps {
    value: number,
    min_value: number,
    max_value: number,
    step: number,
}

@registerClass({
    Properties: {
        "value": doubleSpec("value", GObject.ParamFlags.READWRITE),
        "min-value": doubleSpec("min-value", GObject.ParamFlags.READWRITE),
        "max-value": doubleSpec("max-value", GObject.ParamFlags.READWRITE),
        "step": doubleSpec("step", GObject.ParamFlags.READWRITE),
    }
})
export class Slider extends St.Bin {
    _slider: UiSlider;
    _value = 0;
    _minValue = 0;
    _maxValue = 1;
    _step = 1;
    _isDragging = false;

    constructor(params: Partial<SliderConstructorProps>) {
        super(params);

        this.x_expand = true;

        this._slider = new UiSlider(0);

        this._slider.connect("notify::value", () => {
            // scale to range:
            const range = this.max_value - this.min_value;
            const continuousValue = this.min_value + range * this._slider.value;

            // convert to stepped value:
            const steppedValue = Math.round(continuousValue / this.step) * this.step;

            if (steppedValue !== this._value) {
                this._value = steppedValue;
                this.notify("value");
            }
        });

        this._slider.connect("drag-begin", () => { this._isDragging = true; });
        this._slider.connect("drag-end", () => { this._isDragging = false; });

        this.set_child(this._slider);
    }

    updateRange(min: number, max: number) {
        // take current absolute value before altering range
        const value = this.value;
        // update range
        this._minValue = min;
        this._maxValue = max;
        // re-set same value again to force recalc of underlying slider value
        this.value = value;
    }

    get min_value() { return this._minValue; }
    set min_value(newMin) {
        console.log("Slider.min_value SET:", newMin);
        this.updateRange(newMin, this._maxValue);
        this.notify("min-value");
    }

    get max_value() { return this._maxValue; }
    set max_value(newMax) {
        console.log("Slider.max_value SET:", newMax);
        this.updateRange(this._minValue, newMax);
        this.notify("max-value");
    }

    get step() { return this._step; }
    set step(step) { this._step = step; }

    get value() {
        return this._value;
    }

    set value(value) {
        console.log("Slider.value SET:", value);

        // no-op if we're dragging the slider
        if (this._isDragging) {
            return;
        }

        const min = this.min_value;
        const max = this.max_value;

        if (isNaN(value)) {
            throw new Error("NaN value in Slider.value setter");
        }

        console.log("setting slider value with: min, max, value:", min, max, value);

        const range = max - min;
        if (range > 0) {
            this._slider.value = (value - min) / range;
        } else {
            this._slider.value = 0.0;
        }

        // no need to explicitly notify here, we already attached
        // a notify::value signal to the slider and pass thru
    }
}

interface SwitchButtonConstructorProps extends St.Button.ConstructorProps {
    state: boolean
}

export const SwitchButton = GObject.registerClass({
    Properties: {
        "state": booleanSpec("state", GObject.ParamFlags.READWRITE, false),
    }
},
class SwitchButton extends St.Button {
    _switch: Switch;

    constructor(params: Partial<SwitchButtonConstructorProps>) {
        super({ ...params, toggle_mode: true });

        this._switch = new Switch(this.state);
        bindProperty(this, "checked", this._switch, "state");

        this.set_child(this._switch);
    }

    get state(): boolean {
        return this.checked;
    }

    set state(state: boolean) {
        this.checked = state;
    }
});

