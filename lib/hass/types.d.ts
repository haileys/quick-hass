export type EntityState = {
    entity_id: EntityId,
    state: string,
    attributes: EntityAttributes,
};

export type EntityAttributes = { [key: string]: any };

export type EntityId = string;

export type StateChangedEvent = {
    entity_id: EntityId,
    new_state: EntityState,
};
