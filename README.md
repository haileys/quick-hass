# Quick-Hass

GNOME Quick Settings extension for Home Assistant.

### Installing

1. Clone into `~/.local/share/gnome-shell/extensions/quickhass@hails.org`

2. Add a `config.js` with your Home Assistant websocket URL and access token - see `config.example.js` for example

3. Log out and log back in

4. Run `gnome-extensions enable quickhass@hails.org`

### Developing

Once the extension is installed and enabled, you can iterate without having to log out and log back in for each change you make (though you'll still need to log out the first time to enable the extension)

The `./run-session` shell script will start a nested GNOME session under your main session and reload the extension and config afresh.

It's a good idea to test your changes with `./run-session` before ending your existing GNOME session - shell extension crashes can bring down your whole session.

### What it looks like

Here's a screenshot for ya:

<img src="https://github.com/haileys/quick-hass/assets/179065/72a228b7-4127-42e0-a1f9-cad511d7f5ba" alt="screenshot" width="400">

And here's the config behind that screenshot:

```javascript
const ENTITY_TEMP_REQUEST = "input_number.thermostat_request_temperature";
const ENTITY_HEATING_SWITCH = "input_boolean.heating";
const ENTITY_THERMOSTAT_LOCATION = "input_select.thermostat_location";
const ENTITY_MORNING_HEATING = "input_boolean.morning_heating";

const celcius = (value) => `${value.toFixed(1)}°C`;

export default {
    widgets: [
        {
            title: "Heating",
            icon: "weather-few-clouds-symbolic",
            subtitle: { entity: ENTITY_TEMP_REQUEST, map: celcius },
            toggle: { entity: ENTITY_HEATING_SWITCH },
            items: [
                { entity: ENTITY_TEMP_REQUEST, renderValue: celcius },
                { entity: ENTITY_THERMOSTAT_LOCATION },
                { entity: ENTITY_MORNING_HEATING, title: "Morning auto-run" },
            ]
        }
    ],
    homeAssistant: {
        url: "---",
        token: "---"
    },
};
```
