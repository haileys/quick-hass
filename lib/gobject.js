import GObject from 'gi://GObject';

export function doubleSpec(name, flags) {
    return GObject.ParamSpec.double(name, "", "",
        flags,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        0,
    );
}

export function stringSpec(name, flags) {
    return GObject.ParamSpec.string(name, "", "", flags, null);
}

export function booleanSpec(name, flags, default_) {
    return GObject.ParamSpec.boolean(name, "", "", flags, default_);
}

export function bindProperty(source, sourceName, target, targetName) {
    source.bind_property(sourceName, target, targetName,
        GObject.BindingFlags.SYNC_CREATE);
}

export function bindPropertyBidi(source, sourceName, target, targetName) {
    source.bind_property(sourceName, target, targetName,
        GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL);
}

export function bindPropertyMapped(source, sourceName, target, targetName, mapFunc) {
    // turn the map function into something that bind_property expects:
    const transform = (_binding, value) => [true, mapFunc(value)];

    source.bind_property_full(sourceName, target, targetName,
        GObject.BindingFlags.SYNC_CREATE, transform, null);
}
