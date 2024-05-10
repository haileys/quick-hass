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

const tempRequest = hass.getEntity(ENTITY_TEMP_REQUEST);
tempRequest.connect("notify::value", () => console.log(tempRequest.value));

const heatingSwitch = hass.getEntity(ENTITY_HEATING_SWITCH);
heatingSwitch.connect("notify::value", () => console.log(heatingSwitch.value));

// setTimeout(() => { hass.setTemperatureRequest(21); }, 1000);

loop.run();
