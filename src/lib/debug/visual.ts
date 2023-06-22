import { get, writable, type Writable } from "svelte/store";
import { writableLocalStorage, writableSyncedLocalStorage } from "$util/localStorageStore";
import * as THREE from "three";
import type { World } from "$skymaker/Visualization";
import { grabScroll } from "$actions/grabScroll";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";

export interface DebugNode {
    x: number;
    y: number;
    color?: string;
    text?: string;
}

export const debugNumber = writableLocalStorage("debug-number", -1);
export const debugIsolate = writableLocalStorage("debug-isolate", -1);
export const debugShapes = writableLocalStorage("debug-shapes", false);
export const debugNodes = writable<DebugNode[]>([]);

export function debugClear() {
    debugNodes.set([]);
}

export function addDebugPoint(point: DebugNode, options: { text?: string; color?: string } = {}) {
    debugNodes.update((nodes) => {
        return [...nodes, { ...point, ...options }];
    });
}

let debugInterval: any = null;
export function debugShape(nodes: DebugNode[], interval: number = 500, color?: string) {
    if (!nodes) return;
    let i = 0;

    clearInterval(debugInterval);
    debugInterval = setInterval(() => {
        debugNodes.set([{ ...nodes[i], color, text: `${i}` }]);
        if (i < nodes.length) {
            ++i;
        } else {
            i = 0;
            color = color === "red" ? "blue" : "red";
        }
    }, interval);
}

type DebugVariableType = "number" | "boolean" | "string";
type DebugValueType<T extends DebugVariableType> = T extends "number"
    ? number
    : T extends "boolean"
    ? boolean
    : string;
const defaultValues: Record<DebugVariableType, any> = {
    number: 0,
    boolean: false,
    string: "",
};

type DebugWritable<T extends DebugVariableType> = Writable<DebugValueType<T>> & {
    get: () => T;
    value: T;
    type: DebugVariableType;
};

export const debug = (() => {
    const sync = writableSyncedLocalStorage("debug-sync", 1000, false);
    const variables: Writable<Record<string, DebugWritable<any>>> = writable({});
    const outputs: Writable<Record<string, any>> = writable({});

    sync.subscribe(() => {
        variables.set({});
        outputs.set({});
    });

    function variable<T extends DebugVariableType>(name: string, type: T) {
        if (get(variables)[name]) return get(variables)[name];
        let store: Writable<DebugValueType<T>>;
        if (get(sync)) {
            store = writableSyncedLocalStorage<DebugValueType<T>>(
                "debugValue_" + name,
                250,
                defaultValues[type]
            );
        } else {
            store = writableLocalStorage<DebugValueType<T>>(
                "debugValue_" + name,
                defaultValues[type]
            );
        }

        store.subscribe((value) => {
            variables.update((variables) => {
                return { ...variables };
            });
        });

        variables.update((vars) => {
            vars[name] = {
                ...store,
                type,
                get: () => get(store),
                get value() {
                    return get(store);
                },
                set value(value) {
                    store.set(value);
                },
            };
            return vars;
        });
        return get(variables)[name];
    }

    function out(name: string, value: any) {
        outputs.update((outputs) => {
            outputs[name] = value;
            return outputs;
        });
    }

    return {
        var: variable,
        num: (name: string) => variable(name, "number").get() as number,
        bool: (name: string) => variable(name, "boolean").get() as boolean,
        str: (name: string) => variable(name, "string").get() as string,

        out,

        clear: () => {
            debugNodes.set([]);
            // outputs.set({});
        },
        node: addDebugPoint,
        text: (pos: Vec2, text: string) => addDebugPoint(pos, { text, color: "#242424" }),

        variables,
        outputs,
        sync,
    };
})();

export function updateNodes(world: World, nodes: DebugNode[]) {
    if (!world || !world.scene) return;
    // remove old nodes and add new ones

    for (let i = world.scene.children.length - 1; i >= 0; i--) {
        let child = world.scene.children[i];

        if (child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry) {
            child.children.forEach((c) => ((c as any).markRemove = true));
            (child as any).markRemove = true;
        }
    }

    world.scene.children = world.scene.children.filter((c) => !(c as any).markRemove);

    const radius = Math.max(debug.num("node radius"), 0.01); //0.125;
    nodes.forEach((node) => {
        if (!node || node.x === undefined || node.y === undefined) return;

        const geometry = new THREE.SphereGeometry(radius, 8, 8); // (radius, widthSegments, heightSegments)
        geometry.translate(node.x, node.y, 0);
        const material = new THREE.MeshBasicMaterial({
            color: node.color ?? 0xffff00,
            opacity: 0.5,
            transparent: true,
        });
        const sphere = new THREE.Mesh(geometry, material);
        world.scene.add(sphere);

        if (node.text) {
            const labelDiv = document.createElement("div");
            labelDiv.className = "label";
            labelDiv.textContent = node.text ?? "node";
            const label = new CSS2DObject(labelDiv);
            label.position.set(node.x, node.y + radius * 2, 0);
            sphere.add(label);
        }
    });

    world.requestRender();
}

type Extra = {
    packLength?: number;
    packIndex?: number;
    name?: string;
    text?: FormatFunction;
    background?: (value: any, x: number, y: number) => string | undefined;
    color?: (value: any, x: number, y: number) => string | undefined;
};
type FormatFunction = (value: any, x: number, y: number) => string;
const defaultFormat = (value: any) => "" + value?.toFixed?.(2) ?? "";

let debugMatrixElems = new Map<string, HTMLElement>();

export function debugArray<T>(
    matrix: ArrayLike<T>,
    width?: number,
    height?: number,
    extra?: Extra
) {
    const packLength = extra?.packLength ? extra?.packLength : 1;
    const packIndex = extra?.packIndex ? extra?.packIndex : 0;
    width = width ? width : Math.ceil(Math.sqrt(matrix.length / packLength));
    height = height ? height : Math.ceil(matrix.length / width / packLength);

    const arr = matrix;
    const m = [];
    for (let y = 0; y < height; ++y) {
        const row = [];
        for (let x = 0; x < width; ++x) {
            row.push(arr[packLength * (y * width + x) + packIndex]);
        }
        m.push(row);
    }
    debugMatrix(m, extra);
}

// const debugStore = writableLocalStorage("debug-matrix-active", false);
export function debugMatrix<T>(matrix: T[][], extra?: Extra) {
    const ftext = extra?.text ?? defaultFormat;
    const name = extra?.name ?? "Unknown Matrix";

    debugMatrixElems.get(name)?.remove();

    const table = document.createElement("div");
    debugMatrixElems.set(name, table);
    table.setAttribute("data-name", name);
    table.classList.add("debug-matrix");
    table.style.setProperty("--rows", "" + matrix.length);
    table.style.setProperty("--cols", "" + matrix[0]?.length ?? 0);
    // if (get(debugStore)) {
    //     table.classList.add("active");
    // }
    table.oncontextmenu = (e) => {
        table.classList.toggle("active");
        // debugStore.set(!get(debugStore));
        e.stopPropagation();
        e.preventDefault();
    };

    grabScroll(table, { velocityCoefficient: 0.5 });

    function node(text?: number | string, clazz?: string) {
        const e = document.createElement("span");
        clazz && e.classList.add(clazz);
        e.textContent = "" + (text ?? "");
        table.appendChild(e);
        return e;
    }

    /// HEADER
    node();
    matrix[0].forEach((_, x) => {
        node(x, "header");
    });
    node();

    /// CONTENT
    matrix.forEach((row, y) => {
        node(y, "left");

        row.forEach((value, x) => {
            const cell = document.createElement("span");
            cell.classList.add("cell");
            cell.innerHTML = ftext(value, x, y);
            if (extra?.background) {
                const background = extra.background(value, x, y);
                if (background) {
                    cell.style.background = background;
                }
            }
            if (extra?.color) {
                const color = extra.color(value, x, y);
                if (color) {
                    cell.style.color = color;
                }
            }
            table.appendChild(cell);
        });
        node(y, "right");
    });

    /// FOOTER
    node();
    matrix[0].forEach((_, x) => {
        node(x, "footer");
    });
    node();

    document.body.appendChild(table);
}
