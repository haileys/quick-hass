import GLib from "gi://GLib";
import { HomeAssistant } from "./lib/hass.js";

const ENTITY_TEMP_REQUEST = "input_number.thermostat_request_temperature";
const ENTITY_HEATING_SWITCH = "input_boolean.heating";

const loop = GLib.MainLoop.new(null, false);

const hassUrl = GLib.getenv("HASS_SOCKET_URL");
const hassToken = GLib.getenv("HASS_TOKEN");
const hassConfig = { url: hassUrl, token: hassToken };
const hass = new HomeAssistant(hassConfig, [
    ENTITY_TEMP_REQUEST,
    ENTITY_HEATING_SWITCH,
]);

hass.inputNumber(ENTITY_TEMP_REQUEST)
    .bindState((temp) => console.log(`-> ${temp}`));

// setTimeout(() => { hass.setTemperatureRequest(21); }, 1000);

loop.run();
