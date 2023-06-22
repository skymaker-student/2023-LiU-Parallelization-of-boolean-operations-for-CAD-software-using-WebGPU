import { getCachedDevice } from "$util/gpuCommon";
import { cached } from "./bindGroup";

const settings = createLayout([
    createEntry(0, "uniform", {
        name: "settings",
        type: "Settings",
        struct: {
            width: "u32",
            thread_count: "u32",
            line_count: "u32",
            write_self: "i32",
            max_x: "f32",
            layers: "u32",
        },
    }),
]);

const shapeInput = createLayout([
    createEntry(0, "read-only-storage", {
        name: "in_shape_info",
        type: "array<i32>",
    }),
    createEntry(1, "read-only-storage", {
        name: "in_shape_points",
        type: "array<vec2<f32>>",
    }),
]);

const shapeOutput = createLayout([
    createEntry(0, "storage", {
        name: "out_shape_info",
        type: "array<OutShapeInfo>",
        struct: {
            id: "u32",
            next: "u32",
        },
    }),
    createEntry(1, "storage", {
        name: "out_shape_points",
        type: "array<vec2<f32>>",
    }),
]);

// const pyramidLayers = createLayout([
//     createEntry(0, "storage", {
//         name: "pyramid_layers",
//         type: "array<u32>",
//     }),
// ]);

const pyramidBase = createLayout([
    createEntry(0, "storage", {
        name: "angles_values",
        type: "array<vec2<u32>>",
    }),

    createEntry(1, "storage", {
        name: "pyramid_layers",
        type: "array<u32>",
    }),

    createEntry(2, "uniform", {
        name: "settings",
        type: "Settings",
        struct: {
            width: "u32",
            thread_count: "u32",
            line_count: "u32",
            write_self: "i32",
            max_x: "f32",
            layers: "u32",
        },
    }),
]);

const batchInfo = createLayout([
    createEntry(0, "uniform", {
        name: "batch_info",
        type: "BatchInfo",
        struct: {
            batch_id: "u32",
            batch_width: "u32",
            batch_height: "u32",
        },
    }),
]);

const pyramidLayerSettings = createLayout([
    createEntry(0, "uniform", {
        name: "settings",
        type: "Settings",
        struct: {
            lower_start: "u32",
            upper_dim: "u32",
            layers: "u32",
            layer: "u32",
        },
    }),
]);

export const layouts = {
    settings,
    shapeInput,
    shapeOutput,
    pyramidBase,
    pyramidLayerSettings,
    batchInfo,
};

function createLayout(entries: BindGroupEntry[]) {
    return cached(() => {
        const layout = getCachedDevice().createBindGroupLayout({
            entries,
        }) as GPUBindGroupLayout & {
            wgsl: (group: number) => string;
        };
        layout.wgsl = (group) => {
            return entries.map((entry) => createWGSL(entry, group)).join("\n");
        };
        return layout;
    });
}

export function createWGSL({ binding, buffer: { type }, wgsl }: BindGroupEntry, group: number) {
    const storage = {
        storage: "var<storage, read_write>",
        "read-only-storage": "var<storage, read>",
        uniform: "var<uniform>",
    };
    const struct = !wgsl.struct
        ? ""
        : `\nstruct ${wgsl.type} {\n` +
          Object.entries(wgsl.struct)
              .map(([k, v]) => `\t${k}: ${v}`)
              .join(",\n") +
          "\n}\n";

    return `@group(${group}) @binding(${binding}) ${storage[type]} ${wgsl.name}: ${wgsl.type};${struct}`;
}

export type WGSLEntry = {
    name: string;
    type: string;
    struct?: Record<string, string>;
};
type BindGroupEntry = ReturnType<typeof createEntry>;
function createEntry(index: number, type: GPUBufferBindingType, wgsl: WGSLEntry) {
    return {
        binding: index,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type },
        wgsl,
    };
}
