import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {QuickToggle, QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import config from "./config.js";
import { HomeAssistant } from "./lib/hass.js";

const MIN_TEMP = 18;
const MAX_TEMP = 26;

const ENTITY_TEMP_REQUEST = "input_number.thermostat_request_temperature";
const ENTITY_HEATING_SWITCH = "input_boolean.heating";

function tempToSliderValue(temp) {
    return (temp - MIN_TEMP) / (MAX_TEMP - MIN_TEMP);
}

function sliderValueToTemp(value) {
    const unrounded = MIN_TEMP + value * (MAX_TEMP - MIN_TEMP);
    return Math.floor(unrounded * 2) / 2;
}

function displayTemperature(temp) {
    return `${temp}°C`;
}

const HeatingToggle = GObject.registerClass(
class HeatingToggle extends QuickMenuToggle {
    constructor() {
        super({
            title: "Heating",
            iconName: "weather-few-clouds-symbolic",
            toggleMode: true,
        });

        this.subtitle = "";

        const base = new PopupMenu.PopupBaseMenuItem();
        this.menu.addMenuItem(base);

        const slider = new Slider(0);
        const label = new St.Label({ style_class: "temperature-label" });

        this.hass = new HomeAssistant(config.homeAssistant, [ENTITY_TEMP_REQUEST, ENTITY_HEATING_SWITCH]);

        const tempRequest = this.hass.inputNumber(ENTITY_TEMP_REQUEST);
        const heatingSwitch = this.hass.inputBoolean(ENTITY_HEATING_SWITCH);

        let isDraggingSlider = false;

        tempRequest.bindState((temp) => {
            console.log(`temperature request changed: ${temp}`);

            if (!isDraggingSlider) {
                slider.value = tempToSliderValue(temp);
            }

            this.subtitle = displayTemperature(temp);
        });

        slider.connect("notify::value", () => {
            const temp = sliderValueToTemp(slider.value);
            console.log(`slider value changed: ${temp}`);

            label.text = displayTemperature(temp);
            tempRequest.setState(temp);
        });

        slider.connect("drag-begin", () => {
            isDraggingSlider = true;
        });

        slider.connect("drag-end", () => {
            isDraggingSlider = false;
        });

        heatingSwitch.bindState((state) => {
            console.log(`heating state changed: ${state}`);
            this.checked = !!state;
        });

        this.connect("notify::checked", () => {
            heatingSwitch.setState(this.checked);
        });

        base.add_child(slider);
        base.add_child(label);

        label.text = "Hello world";
    }
});

const HeatingIndicator = GObject.registerClass(
class HeatingIndicator extends SystemIndicator {
    constructor() {
        super();

        const heating = new HeatingToggle();
        this.quickSettingsItems.push(heating);
    }
});

export default class QuickSettingsExampleExtension extends Extension {
    enable() {
        this._indicator = new HeatingIndicator();
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator.quickSettingsItems.forEach(item => item.destroy());
        this._indicator.destroy();
    }
}
