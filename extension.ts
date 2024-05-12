import Clutter from "gi://Clutter";
import St from "gi://St";

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { QuickMenuToggle, SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import config from "./config";
import type { Value, EntityItem, Widget } from "./config";
import { HomeAssistant } from "./lib/hass";
import { Slider, SwitchButton } from "./lib/controls";
import { bindProperty, bindPropertyBidi, bindPropertyMapped } from "./lib/gobject";
import { InputBoolean, InputNumber, InputSelect, BaseEntity } from "./lib/hass/entity";
import "./lib/ui";

function configureProperty<T>(
    hass: HomeAssistant,
    target: any,
    property: string,
    configValue: Value<T> | undefined,
) {
    if (typeof configValue === "undefined") {
        // do nothing
        return;
    }

    if (typeof configValue === "object" && configValue !== null && "entity" in configValue) {
        // data binding
        const entity = hass.getEntity(configValue.entity);
        if (!entity) {
            return;
        }

        if (typeof configValue.map === "function") {
            // a map function is supplied
            bindPropertyMapped(entity, "value", target, property, configValue.map);
        } else {
            // binding raw value
            bindProperty(entity, "value", target, property);
        }

        return;
    }

    // direct value assignment
    target[property] = configValue;
}

function createInputNumberItem(entity: InputNumber, itemConfig: EntityItem) {
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

function createInputBooleanItem(entity: InputBoolean, itemConfig: EntityItem) {
    const switchButton = new SwitchButton({});
    bindPropertyBidi(entity, "value", switchButton, "checked");

    const bin = new St.Bin({ x_expand: true, x_align: Clutter.ActorAlign.END });
    bin.set_child(switchButton);

    return bin;
}

function createInputSelectItem(entity: InputSelect, itemConfig: EntityItem) {
    const menuItem = new PopupMenu.PopupSubMenuMenuItem("", false);

    // only close immediate menu upon item activated, not top menu:
    menuItem.menu.itemActivated = () => {
        menuItem.menu.close(true);
    };

    if (typeof itemConfig.title === "undefined") {
        bindProperty(entity, "title", menuItem.label, "text");
    } else {
        configureProperty(entity.hass, menuItem.label, "text", itemConfig.title);
    }

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

function createItemControl(entity: BaseEntity, itemConfig: EntityItem) {
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

function createItemMenuItem(hass: HomeAssistant, itemConfig: EntityItem) {
    const entity = hass.getEntity(itemConfig.entity);
    if (!entity) {
        return null;
    }

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

function createWidget(hass: HomeAssistant, widgetConfig: Widget) {
    let widget;

    if (widgetConfig.toggle) {
        widget = new QuickMenuToggle({ toggleMode: true });

        const toggleEntity = hass.getEntity(widgetConfig.toggle.entity);
        if (toggleEntity) {
            bindPropertyBidi(toggleEntity, "value", widget, "checked");
        }
    } else {
        throw new Error("unknown kind of widget?");
    }

    configureProperty(hass, widget, "title", widgetConfig.title);
    configureProperty(hass, widget, "subtitle", widgetConfig.subtitle);
    configureProperty(hass, widget, "icon_name", widgetConfig.icon);

    widget.menu.itemActivated = () => {};

    for (const itemConfig of widgetConfig.items) {
        const menuItem = createItemMenuItem(hass, itemConfig);
        if (menuItem) {
            widget.menu.addMenuItem(menuItem);
        }
    }

    return widget;
}

export default class QuickSettingsExampleExtension extends Extension {
    _indicator: SystemIndicator | null = null;

    enable() {
        this._indicator = new SystemIndicator();

        const hass = new HomeAssistant(config.homeAssistant);
        for (const widgetConfig of config.widgets) {
            this._indicator.quickSettingsItems.push(createWidget(hass, widgetConfig));
        }

        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.quickSettingsItems.forEach(item => item.destroy());
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
