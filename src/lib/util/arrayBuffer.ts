const shared = false;

type ArrayBufferType = "i32" | "u32" | "f32" | "byte";

export function arrayBuffer(size: number, type: "byte"): ArrayBuffer;
export function arrayBuffer(size: number, type: "u32"): Uint32Array;
export function arrayBuffer(size: number, type: "f32"): Float32Array;
export function arrayBuffer(size: number, type: "i32"): Int32Array;

export function arrayBuffer(data: ArrayLike<number>, type: "u32"): Uint32Array;
export function arrayBuffer(data: ArrayLike<number>, type: "f32"): Float32Array;
export function arrayBuffer(data: ArrayLike<number>, type: "i32"): Int32Array;

export function arrayBuffer(data: number | ArrayLike<number>, type: ArrayBufferType) {
    let typeSize = type === "byte" ? 1 : 4;
    const dataSize = (typeof data === "number" ? data : data.length) * typeSize;

    let buffer: ArrayBuffer;
    if (shared) {
        buffer = new SharedArrayBuffer(dataSize);
    } else {
        buffer = new ArrayBuffer(dataSize);
    }

    if (type === "byte") {
        return buffer;
    }

    let view: Uint32Array | Int32Array | Float32Array;
    if (type === "u32") {
        view = new Uint32Array(buffer);
    } else if (type === "i32") {
        view = new Int32Array(buffer);
    } else if (type === "f32") {
        view = new Float32Array(buffer);
    } else {
        throw new Error("Unknown array buffer type");
    }

    if (typeof data !== "number") {
        view.set(data);
    }

    return view;
}

export type BufferData = { u32: number } | { i32: number } | { f32: number } | { bool: boolean };

function isU32(data: BufferData): data is { u32: number } {
    return Object.hasOwn(data, "u32");
}
function isI32(data: BufferData): data is { i32: number } {
    return Object.hasOwn(data, "i32");
}

function isF32(data: BufferData): data is { f32: number } {
    return Object.hasOwn(data, "f32");
}

function isBool(data: BufferData): data is { bool: boolean } {
    return Object.hasOwn(data, "bool");
}

export function multiTypeBuffer(values: BufferData[]) {
    return values.reduce((buffer, current, index) => {
        if (isU32(current)) {
            new Uint32Array(buffer).set([current.u32], index);
        } else if (isI32(current)) {
            new Int32Array(buffer).set([current.i32], index);
        } else if (isF32(current)) {
            new Float32Array(buffer).set([current.f32], index);
        } else if (isBool(current)) {
            new Uint32Array(buffer).set([current.bool ? 1 : 0], index);
        }

        return buffer;
    }, new ArrayBuffer(values.length * 4));
}

export function setMultiTypeBuffer(buffer: ArrayBuffer | SharedArrayBuffer, values: BufferData[]) {
    return values.reduce((buffer, current, index) => {
        if (isU32(current)) {
            new Uint32Array(buffer).set([current.u32], index);
        } else if (isI32(current)) {
            new Int32Array(buffer).set([current.i32], index);
        } else if (isF32(current)) {
            new Float32Array(buffer).set([current.f32], index);
        } else if (isBool(current)) {
            new Uint32Array(buffer).set([current.bool ? 1 : 0], index);
        }

        return buffer;
    }, buffer);
}
