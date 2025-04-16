import St from "gi://St";
import GObject from 'gi://GObject';
import { Switch } from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Slider as UiSlider } from "resource:///org/gnome/shell/ui/slider.js";
import { doubleSpec, booleanSpec, bindProperty } from "./gobject.js";

export const Slider = GObject.registerClass({
    Properties: {
        "value": doubleSpec("value", GObject.ParamFlags.READWRITE),
        "min-value": doubleSpec("min-value", GObject.ParamFlags.READWRITE),
        "max-value": doubleSpec("max-value", GObject.ParamFlags.READWRITE),
        "step": doubleSpec("step", GObject.ParamFlags.READWRITE),
    },
    Signals: { changed: {} },
},
class Slider extends St.Bin {
    _slider = null;
    _value = 0;
    _minValue = 0;
    _maxValue = 1;
    _step = 1;
    // null if not dragging, non-null if dragging
    _valueBeforeDragging = null;

    constructor(params) {
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

                if (!this._isDragging) {
                    this.emit("changed");
                }
            }
        });

        this._slider.connect("drag-begin", () => {
            this._valueBeforeDragging = this.value;
        });

        this._slider.connect("drag-end", () => {
            const valueBeforeDragging = this._valueBeforeDragging;
            this._valueBeforeDragging = null;

            if (valueBeforeDragging !== this.value) {
                // emit changed event that was deferred while dragging
                this.emit("changed");
            }
        });

        this.set_child(this._slider);
    }

    get _isDragging() {
        return this._valueBeforeDragging !== null;
    }

    updateRange(min, max) {
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
});

export const SwitchButton = GObject.registerClass({
    Properties: {
        "state": booleanSpec("state", GObject.ParamFlags.READWRITE),
    }
},
class SwitchButton extends St.Button {
    constructor(params) {
        super({ ...params, toggle_mode: "true" });

        this._switch = new Switch(this.state);
        bindProperty(this, "checked", this._switch, "state");

        this.set_child(this._switch);
    }
});
