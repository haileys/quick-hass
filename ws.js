import GLib from "gi://GLib";
import { HomeAssistant } from "./hassclimate@hails.org/lib/hass.js";

const loop = GLib.MainLoop.new(null, false);

const hassUrl = GLib.getenv("HASS_SOCKET_URL");
const hassToken = GLib.getenv("HASS_TOKEN");
const hassConfig = { url: hassUrl, token: hassToken };
const hass = new HomeAssistant(hassConfig);

const climate = hass.getEntity("climate.samsung_hvac");

climate.connect("notify", () => {
    // console.log(`mode: ${climate}`);
});

climate.connect("notify::ready", () => {
    // climate.mode = "fan_only";
    climate.fan_mode = "low";
    // console.log(JSON.stringify(climate.attributes));

});

loop.run();
