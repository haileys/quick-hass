import St from "gi://St";
import Clutter from "gi://Clutter";
import { PopupBaseMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";

import { Slider } from "../controls.js";
import { prop, registerClass } from "../gobject.js";

export interface InputNumberConstructorProps extends PopupBaseMenuItem.ConstructorProps {
    title: string,
    value: number,
    value_text: string,
    min_value: number,
    max_value: number,
    step: number,
};

@registerClass({
    Properties: {
        "title": prop.string("title"),
        "value": prop.number("value"),
        "value-text": prop.string("value-text"),
        "min-value": prop.number("min-value"),
        "max-value": prop.number("max-value"),
        "step": prop.number("step"),
    }
})
export class InputNumber extends PopupBaseMenuItem {
    slider: Slider;
    sliderLabel: St.Label;
    titleLabel: St.Label;

    constructor(params: Partial<InputNumberConstructorProps>) {
        super(params);

        this.slider = new Slider({ x_expand: true });

        this.sliderLabel = new St.Label({
            style_class: "quickhass-slider-value",
        });

        this.titleLabel = new St.Label({
            style_class: "quickhass-item-title-label",
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_child(this.titleLabel);
        this.add_child(this.slider);
        this.add_child(this.sliderLabel);
    }

    get title() { return this.titleLabel.text; }
    set title(value) { this.titleLabel.text = value; }

    get value() { return this.slider.value; }
    set value(value) { this.slider.value = value; }

    get value_text() { return this.sliderLabel.text; }
    set value_text(value) { this.sliderLabel.text = value; }

    get min_value() { return this.slider.min_value; }
    set min_value(value) { this.slider.min_value = value; }

    get max_value() { return this.slider.max_value; }
    set max_value(value) { this.slider.max_value = value; }

    get step() { return this.slider.step; }
    set step(value) { this.slider.step = value; }
}
