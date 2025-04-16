import Clutter from "gi://Clutter";
import St from "gi://St";

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { QuickMenuToggle, SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import config from "./config.js";
import { HomeAssistant } from "./lib/hass.js";
import { Slider, SwitchButton } from "./lib/controls.js";
import { bindProperty, bindPropertyBidi, bindPropertyMapped } from "./lib/gobject.js";
import { InputBoolean, InputNumber, InputSelect } from "./lib/hass/entity.js";

function configureProperty(hass, target, property, configValue) {
    if (typeof configValue === "undefined") {
        // do nothing
    }

    if (typeof configValue !== "object" || configValue === null) {
        // direct value assignment
        target[property] = configValue;
        return;
    }

    if (configValue.entity) {
        // data binding
        const entity = hass.getEntity(configValue.entity);

        if (typeof configValue.map === "function") {
            // a map function is supplied
            bindPropertyMapped(entity, "value", target, property, configValue.map);
        } else {
            // binding raw value
            bindProperty(entity, "value", target, property);
        }

        return;
    }
}

function createInputNumberItem(entity, itemConfig) {
    const slider = new Slider({ x_expand: true });
    const sliderLabel = new St.Label({
        style_class: "quickhass-slider-value"
    });

    if (typeof itemConfig.renderValue === "function") {
        bindPropertyMapped(slider, "value", sliderLabel, "text", itemConfig.renderValue);
    } else {
        bindProperty(slider, "value", sliderLabel, "text");
    }

    bindProperty(entity, "min-value", slider, "min-value");
    bindProperty(entity, "max-value", slider, "max-value");
    bindProperty(entity, "step", slider, "step");
    bindPropertyBidi(entity, "value", slider, "value");

    const box = new St.BoxLayout({ x_expand: true });
    box.add_child(slider);
    box.add_child(sliderLabel);
    return box;
}

function createInputBooleanItem(entity, itemConfig) {
    const switchButton = new SwitchButton();
    bindPropertyBidi(entity, "value", switchButton, "checked");

    const bin = new St.Bin({ x_expand: true, x_align: Clutter.ActorAlign.END });
    bin.set_child(switchButton);

    return bin;
}

function createItemControl(entity, itemConfig) {
    if (entity instanceof InputNumber) {
        return createInputNumberItem(entity, itemConfig);
    } else if (entity instanceof InputBoolean) {
        return createInputBooleanItem(entity, itemConfig);
    } else if (entity instanceof InputSelect) {
        return createInputSelectItem(entity, itemConfig);
    } else {
        throw new Error("unknown/unsupported entity type: " + entity.entity_id);
    }
}

function createItemMenuItem(hass, itemConfig) {
    const entity = hass.getEntity(itemConfig.entity);
    const control = createItemControl(entity, itemConfig);

    // if it's already a menu item, nothing further to do
    if (control instanceof PopupMenu.PopupBaseMenuItem) {
        return control;
    }

    // otherwise wrap it in a menu item to return
    const titleLabel = new St.Label({ style_class: "quickhass-item-title-label" });
    titleLabel.y_expand = true;
    titleLabel.y_align = Clutter.ActorAlign.CENTER;

    if (typeof itemConfig.title === "undefined") {
        bindProperty(entity, "title", titleLabel, "text");
    } else {
        configureProperty(hass, titleLabel, "text", itemConfig.title);
    }

    const menuItem = new PopupMenu.PopupBaseMenuItem();
    menuItem.add_child(titleLabel);
    menuItem.add_child(control);
    return menuItem;
}

function formatTemp(temp) {
    if (temp) {
        return `${temp.toFixed(1)}°C`;
    } else {
        return "";
    }
}

const MODE_LABELS = {
    off: "Off",
    heat: "Heat",
    cool: "Cool",
    fan_only: "Fan",
};

function createModeSelector(entity) {
    const container = new St.BoxLayout({
        style_class: 'hassclimate-mode-container',
        x_align: Clutter.ActorAlign.START,
        x_expand: true,
    });

    for (const mode of Object.keys(MODE_LABELS)) {
        const label = MODE_LABELS[mode];

        const button = new St.Button({
            x_expand: true,
            style_class: "button flat",
            toggle_mode: true,
            label,
        });

        bindPropertyMapped(entity, "mode", button, "checked", (m) => m === mode);

        button.connect("clicked", () => {
            entity.mode = mode;
        });

        container.add_child(button);
    }

    return container;
}

function createTemperatureSlider(entity) {
    const slider = new Slider();
    bindProperty(entity, "min_temp", slider, "min-value");
    bindProperty(entity, "max_temp", slider, "max-value");
    bindProperty(entity, "set_temp_step", slider, "step");

    // setup one way binding from set_temp -> slider value
    // and manually bind in the other direction on the changed signal
    bindProperty(entity, "set_temp", slider, "value");
    slider.connect("changed", () => { entity.set_temp = slider.value; });

    const sliderLabel = new St.Label({
        style_class: "quickhass-slider-value",
    });
    bindPropertyMapped(slider, "value", sliderLabel, "text", formatTemp);

    const box = new St.BoxLayout({ x_expand: true });
    box.add_child(slider);
    box.add_child(sliderLabel);

    return box;
}

function createSetTemperatureMenuItem(entity) {
    const menuItem = wrapMenuItem("Set", createTemperatureSlider(entity));
    bindPropertyMapped(entity, "set_temp", menuItem, "visible", (temp) => !!temp);
    return menuItem;
}

function createCurrentTemperatureMenuItem(entity) {
    const label = new St.Label({
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        x_align: Clutter.ActorAlign.END,
    });
    bindPropertyMapped(entity, "current_temp", label, "text", formatTemp);
    return wrapMenuItem("Current", label);
}

function createThermostatLocationMenuItem(entity) {
    const menuItem = new PopupMenu.PopupSubMenuMenuItem("Thermostat Location", false);
    menuItem.label = "Thermostat Location";

    // only close immediate menu upon item activated, not top menu:
    menuItem.menu.itemActivated = () => {
        menuItem.menu.close(true);
    };

    const expander = menuItem.get_child_at_index(2);
    if (!(expander instanceof St.Bin)) {
        throw new Error("expander not instanceof St.Bin!");
    }

    const currentOptionLabel = new St.Label({
        x_expand: true,
        x_align: Clutter.ActorAlign.END,
    });
    bindProperty(entity, "value", currentOptionLabel, "text");
    expander.set_child(currentOptionLabel);

    const updateOptions = () => {
        menuItem.menu.removeAll();

        for (const option of entity.options) {
            const optionItem = new PopupMenu.PopupBaseMenuItem();
            // optionItem.setOrnament(PopupMenu.Ornament.NONE);

            const label = new St.Label({ text: option });
            // const icon = new St.Icon({ icon_name: "object-select-symbolic" });
            optionItem.add_child(label);
            // optionItem.add_child(icon);

            const setOrnament = () => {
                optionItem.setOrnament(entity.value === option
                    ? PopupMenu.Ornament.CHECK
                    : PopupMenu.Ornament.NONE);
            };

            setOrnament();
            entity.connect("notify::value", setOrnament);

            optionItem.connect("activate", () => {
                entity.value = option;
                console.log("optionItem.activate:", arguments);
            });

            menuItem.menu.addMenuItem(optionItem);
        }
    };

    updateOptions();
    entity.connect("notify::options", updateOptions);

    return menuItem;
}

function wrapMenuItem(title, control) {
    // otherwise wrap it in a menu item to return
    const titleLabel = new St.Label({
        style_class: "quickhass-item-title-label",
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        text: title,
    });

    const menuItem = new PopupMenu.PopupBaseMenuItem();
    menuItem.add_child(titleLabel);
    menuItem.add_child(control);

    return menuItem;
}

function createWidget(hass) {
    const climate = hass.getEntity("climate.samsung_hvac");
    const thermostatLocation = hass.getEntity("input_select.thermostat_location");

    const widget = new QuickMenuToggle({
        // toggleMode: true,
        title: "HVAC",
        icon_name: "weather-few-clouds-symbolic",
        subtitle: ""
    });

    const updateSubtitle = () => {
        if (climate.mode === "off") {
            widget.subtitle = null;
            return;
        }

        let subtitle = MODE_LABELS[climate.mode] || climate.mode;
        console.log("SUBTITLE! set_temp: " + climate.set_temp);
        if (climate.set_temp) {
            subtitle += " - " + formatTemp(climate.set_temp);
        }

        widget.subtitle = subtitle;
    };

    climate.connect("notify::mode", () => {
        console.log("will update subtitle in notify::mode");
        widget.checked = climate.mode !== "off";
        updateSubtitle();
    });

    climate.connect("notify::set-temp", () => {
        console.log("will update subtitle in notify::set-temp");
        updateSubtitle();
    });

    const modeButtonMenuItem = new PopupMenu.PopupBaseMenuItem({
        activate: false,
        style_class: "hassclimate-mode-menuitem",
    });
    modeButtonMenuItem.track_hover = false;

    modeButtonMenuItem.add_child(createModeSelector(climate))

    widget.menu.addMenuItem(modeButtonMenuItem);
    widget.menu.addMenuItem(createSetTemperatureMenuItem(climate));
    widget.menu.addMenuItem(createCurrentTemperatureMenuItem(climate));
    widget.menu.addMenuItem(createThermostatLocationMenuItem(thermostatLocation));

    // widget.menu.itemActivated = () => {};

    // for (const itemConfig of widgetConfig.items) {
    //     const menuItem = createItemMenuItem(hass, itemConfig);
    //     widget.menu.addMenuItem(menuItem);
    // }

    return widget;
}

export default class QuickSettingsExampleExtension extends Extension {
    enable() {
        this._indicator = new SystemIndicator();

        const hass = new HomeAssistant(config.homeAssistant);
        this._indicator.quickSettingsItems.push(createWidget(hass));

        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator.quickSettingsItems.forEach(item => item.destroy());
        this._indicator.destroy();
    }
}
