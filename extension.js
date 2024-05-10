import Clutter from "gi://Clutter";
import GObject from "gi://GObject";
import St from "gi://St";

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { QuickToggle, QuickMenuToggle, SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';
import { CheckBox } from "resource:///org/gnome/shell/ui/checkBox.js";
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import config from "./config.js";
import { HomeAssistant } from "./lib/hass.js";
import { Slider, SwitchButton } from "./lib/controls.js";
import { bindProperty, bindPropertyBidi, bindPropertyMapped } from "./lib/gobject.js";
import { InputBoolean, InputNumber } from "./lib/hass/entity.js";

const ENTITY_TEMP_REQUEST = "input_number.thermostat_request_temperature";
const ENTITY_HEATING_SWITCH = "input_boolean.heating";

function displayTemperature(temp) {
    return `${temp}°C`;
}

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
    const slider = new Slider();
    const sliderLabel = new St.Label({ x_align: Clutter.ActorAlign.END });

    if (typeof itemConfig.renderValue === "function") {
        bindPropertyMapped(slider, "value", sliderLabel, "text", itemConfig.renderValue);
    } else {
        bindProperty(slider, "value", sliderLabel, "text");
    }

    bindProperty(entity, "min-value", slider, "min-value");
    bindProperty(entity, "max-value", slider, "max-value");
    bindProperty(entity, "step", slider, "step");
    bindPropertyBidi(entity, "value", slider, "value");

    return [slider, sliderLabel];
}

function createInputBooleanItem(entity, itemConfig) {
    const switchButton = new SwitchButton();
    switchButton.x_align = Clutter.ActorAlign.END;

    bindPropertyBidi(entity, "value", switchButton, "checked");

    return [switchButton];
}

function appendItemControl(hass, itemConfig, gridLayout) {
    const entity = hass.getEntity(itemConfig.entity);

    let controls;
    if (entity instanceof InputNumber) {
        controls = createInputNumberItem(entity, itemConfig);
    } else if (entity instanceof InputBoolean) {
        controls = createInputBooleanItem(entity, itemConfig);
    } else {
        throw new Error("unknown/unsupported entity type: " + entity.entity_id);
    }

    const titleLabel = new St.Label();
    titleLabel.y_expand = true;
    titleLabel.y_align = Clutter.ActorAlign.CENTER;

    if (typeof itemConfig.title === "undefined") {
        bindProperty(entity, "title", titleLabel, "text");
    } else {
        configureProperty(hass, titleLabel, "text", itemConfig.title);
    }

    gridLayout.attach_next_to(titleLabel, null, Clutter.GridPosition.BOTTOM, 1, 1);

    if (controls.length == 1) {
        gridLayout.attach_next_to(controls[0], titleLabel, Clutter.GridPosition.RIGHT, 2, 1);
    } else if (controls.length == 2) {
        gridLayout.attach_next_to(controls[0], titleLabel, Clutter.GridPosition.RIGHT, 1, 1);
        gridLayout.attach_next_to(controls[1], controls[0], Clutter.GridPosition.RIGHT, 1, 1);
    }
}

function createItemsGrid(hass, items) {
    const gridLayout = new Clutter.GridLayout({
        row_spacing: 8,
        column_spacing: 8,
    });
    const grid = new St.Widget({
        layout_manager: gridLayout,
        x_expand: true,
    });
    gridLayout.hookup_style(grid);

    for (const itemConfig of items) {
        appendItemControl(hass, itemConfig, gridLayout);
    }

    return grid;
}

function createWidget(hass, widgetConfig) {
    let widget;

    if (widgetConfig.toggle) {
        widget = new QuickMenuToggle({ toggleMode: true });

        const toggleEntity = hass.getEntity(widgetConfig.toggle.entity);
        bindPropertyBidi(toggleEntity, "value", widget, "checked");
    }

    configureProperty(hass, widget, "title", widgetConfig.title);
    configureProperty(hass, widget, "subtitle", widgetConfig.subtitle);
    configureProperty(hass, widget, "icon_name", widgetConfig.icon);

    const base = new PopupMenu.PopupBaseMenuItem();
    widget.menu.addMenuItem(base);

    const grid = createItemsGrid(hass, widgetConfig.items);
    base.add_child(grid);

    return widget;
}

const WidgetItem = GObject.registerClass(
class WidgetItem extends QuickMenuToggle {
    constructor(hass, widgetConfig) {
        super({
            title: "Heating",
            iconName: "weather-few-clouds-symbolic",
            toggleMode: true,
        });

        this.hass = new HomeAssistant(config.homeAssistant);

        const base = new PopupMenu.PopupBaseMenuItem();
        this.menu.addMenuItem(base);

        this.hass = new HomeAssistant(config.homeAssistant, [
            ENTITY_TEMP_REQUEST,
            ENTITY_HEATING_SWITCH
        ]);

        const gridLayout = new Clutter.GridLayout({
            row_spacing: 8,
            column_spacing: 8,
        });
        const grid = new St.Widget({
            layout_manager: gridLayout,
            x_expand: true,
        });
        gridLayout.hookup_style(grid);
        base.add_child(grid);

        const heatingItemLabel = new St.Label();
        heatingItemLabel.y_expand = true;
        heatingItemLabel.y_align = Clutter.ActorAlign.CENTER;
        const heatingUiSwitch = new SwitchButton();
        heatingUiSwitch.x_align = Clutter.ActorAlign.END;

        const tempItemLabel = new St.Label();
        tempItemLabel.y_expand = true;
        tempItemLabel.y_align = Clutter.ActorAlign.CENTER;
        const tempSlider = new Slider();
        const tempSliderLabel = new St.Label({ style_class: "temperature-label" });

        const tempRequest = this.hass.getEntity(ENTITY_TEMP_REQUEST);
        const heatingSwitch = this.hass.getEntity(ENTITY_HEATING_SWITCH);

        bindProperty(tempRequest, "title", tempItemLabel, "text");
        bindProperty(tempRequest, "min-value", tempSlider, "min-value");
        bindProperty(tempRequest, "max-value", tempSlider, "max-value");
        bindProperty(tempRequest, "step", tempSlider, "step");
        bindPropertyBidi(tempRequest, "value", tempSlider, "value");
        bindPropertyMapped(tempRequest, "value", this, "subtitle", displayTemperature);

        bindPropertyMapped(tempSlider, "value", tempSliderLabel, "text", displayTemperature);

        bindPropertyBidi(heatingSwitch, "value", this, "checked");
        bindPropertyBidi(heatingSwitch, "value", heatingUiSwitch, "checked");
        bindProperty(heatingSwitch, "title", heatingItemLabel, "text");

        gridLayout.attach_next_to(heatingItemLabel, null, Clutter.GridPosition.BOTTOM, 1, 1);
        gridLayout.attach_next_to(heatingUiSwitch, heatingItemLabel, Clutter.GridPosition.RIGHT, 2, 1);

        gridLayout.attach_next_to(tempItemLabel, null, Clutter.GridPosition.BOTTOM, 1, 1);
        gridLayout.attach_next_to(tempSlider, tempItemLabel, Clutter.GridPosition.RIGHT, 1, 1);
        gridLayout.attach_next_to(tempSliderLabel, tempSlider, Clutter.GridPosition.RIGHT, 1, 1);
    }
});

export default class QuickSettingsExampleExtension extends Extension {
    enable() {
        this._indicator = new SystemIndicator();

        const hass = new HomeAssistant(config.homeAssistant);
        for (const widgetConfig of config.widgets) {
            this._indicator.quickSettingsItems.push(createWidget(hass, widgetConfig));
        }
        // this._indicator.quickSettingsItems.push(new HeatingToggle());

        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator.quickSettingsItems.forEach(item => item.destroy());
        this._indicator.destroy();
    }
}
