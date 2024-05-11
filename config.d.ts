declare const config: Config;
export default config;

export type Config = {
    widgets: Widget[],
    homeAssistant: HomeAssistant,
};

export type HomeAssistant = {
    url: string,
    token: string,
};

export type Widget = {
    title?: Value<string>,
    subtitle?: Value<string>,
    icon?: Value<string>,
    toggle?: Entity,
    items: EntityItem[],
};

export type EntityItem = {
    entity: string,
    title?: Value<string>,
    renderValue?: (_: any) => string,
};

export type Entity = { entity: string };

export type Value<T> = T | EntityBinding<T>;

export type EntityBinding<T> = {
    entity: string,
    map?: (_: any) => T,
};
