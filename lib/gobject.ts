import GObject from 'gi://GObject';

export function doubleSpec(name: string, flags: number) {
    return GObject.ParamSpec.double(name, "", "",
        flags,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        0,
    );
}

export function stringSpec(name: string, flags: number) {
    return GObject.ParamSpec.string(name, "", "", flags, "");
}

export function booleanSpec(name: string, flags: number, default_: boolean) {
    return GObject.ParamSpec.boolean(name, "", "", flags, default_);
}

export type PropHelper = {
    (name: string): GObject.ParamSpec,
    readonly(name: string): GObject.ParamSpec,
};

function propType(factory: (name: string, flags: GObject.ParamFlags) => GObject.ParamSpec): PropHelper {
    const rwProp = (name: string) => factory(name, GObject.ParamFlags.READWRITE);
    rwProp.readonly = (name: string) => factory(name, GObject.ParamFlags.READABLE);
    return rwProp;
}

export const prop = {
    number: propType(doubleSpec),
    string: propType(stringSpec),
    boolean: propType((name, flags) => booleanSpec(name, flags, false)),
}

export function bindProperty(
    source: GObject.Object,
    sourceName: string,
    target: GObject.Object,
    targetName: string,
) {
    source.bind_property(sourceName, target, targetName,
        GObject.BindingFlags.SYNC_CREATE);
}

export function bindPropertyBidi(
    source: GObject.Object,
    sourceName: string,
    target: GObject.Object,
    targetName: string,
) {
    source.bind_property(sourceName, target, targetName,
        GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL);
}

export function bindPropertyMapped<T, U>(
    source: GObject.Object,
    sourceName: string,
    target: GObject.Object,
    targetName: string,
    mapFunc: (_: T) => U,
) {
    // turn the map function into something that bind_property expects:
    const transform = (_binding: unknown, value: T): [boolean, U] => [true, mapFunc(value)];

    source.bind_property_full(sourceName, target, targetName,
        GObject.BindingFlags.SYNC_CREATE, transform, null as any);
}

type RegisterClassOpts = {
    Properties?: { [key: string]: GObject.ParamSpec }
};

export function registerClass<T>(opts: RegisterClassOpts): (klass: T, _context: ClassDecoratorContext) => T {
    return (klass, _context) => GObject.registerClass(opts, klass as any) as T;
}
