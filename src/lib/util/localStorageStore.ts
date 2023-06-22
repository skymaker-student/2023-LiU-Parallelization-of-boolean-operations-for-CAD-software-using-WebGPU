import { writable } from "svelte/store";
import type { Writable } from "svelte/store";

const debug = false;

export const error = {
    callback: console.error,
} as { callback: (err: { message: string; error: any }) => void };

function save<T>(path: string, value: T) {
    try {
        localStorage.setItem(path, JSON.stringify(value));
        debug && console.log("save", value, "to", path);
    } catch (e) {
        error.callback({ message: `Failed to store ${path} in local storage`, error: e });
    }
}

function load<T>(path: string, def: T) {
    try {
        let valueStr = localStorage.getItem(path);
        if (!valueStr || valueStr === "undefined") {
            return def;
        }

        let value = JSON.parse(valueStr);
        if (value == undefined) value = def;
        debug && console.log("load", value, "from", path);
        return value as T;
    } catch (e) {
        console.log("Failed to load", path, e);
        save(path, def);
        return def;
    }
}

type Opt<T> = T | undefined;
export function writableLocalStorage<T>(path: string, def: Opt<T> = undefined, value: Opt<T> = undefined) {
    if (value == undefined) value = load(path, def);
    let writ = writable(value);

    return {
        ...writ,
        set(v: T) {
            save(path, v);
            writ.set(v);
        },
    } as Writable<T>;
}

export function writableSyncedLocalStorage<T>( path: string, interval: number = 500, def: Opt<T> = undefined, value: Opt<T> = undefined) {
    if (value == undefined) value = load(path, def);
    let writ = writable(value, (set) => {
        const int = setInterval(() => {
            set(load(path, def) as T);
        }, interval);
        return () => {
            clearInterval(int);
        };
    });

    return {
        ...writ,
        set(v: T) {
            save(path, v);
            writ.set(v);
        },
    } as Writable<T>;
}
