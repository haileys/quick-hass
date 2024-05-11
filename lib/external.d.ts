declare interface Console {
    log(...args: any): void;
    warn(...args: any): void;
}

declare var console: Console;

declare function setTimeout(func: () => void, ms: number): void;
