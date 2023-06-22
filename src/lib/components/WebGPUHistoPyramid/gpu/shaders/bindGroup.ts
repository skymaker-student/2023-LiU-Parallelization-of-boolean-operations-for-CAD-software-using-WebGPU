import type { ShapePack } from "$components/WebGPUHistoPyramid";
import { debugBases2 } from "$components/WebGPUHistoPyramid/union";
import { multiTypeBuffer } from "$util/arrayBuffer";
import {
    createInputBuffer,
    createOutputBuffer,
    createSettingsBuffer,
    getCachedDevice,
    getDevice,
} from "$util/gpuCommon";
import { layouts } from "./layout";

const dynamicSize = false;

export type Settings = ReturnType<typeof createSettings>;
const createSettings = cachedBase(({ layerCount }) => {
    const device = getCachedDevice();
    const settingsBuffer = device.createBuffer({
        size: 4 * 6,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        layout: layouts.settings(),
        entries: bindGroupEntries([settingsBuffer]),
    });

    const self = {
        bindGroup,
        layout: layouts.settings(),
        update: (width: u32, threadCount: u32, lineCount: u32, max_x: f32) => {
            device.queue.writeBuffer(
                settingsBuffer,
                0,
                multiTypeBuffer([
                    { u32: width },
                    { u32: threadCount }, /// ????
                    { u32: lineCount },
                    { u32: layerCount },
                    { f32: max_x },
                    { u32: layerCount },
                ])
            );
            self.lineCount = lineCount;
            return self;
        },
        updateThreadCount: (thread_count: u32) => {
            device.queue.writeBuffer(settingsBuffer, 4, multiTypeBuffer([{ u32: thread_count }]));
            return self;
        },
        // Same for every run
        // destroy: () => {
        //     settingsBuffer.destroy();
        // },
        lineCount: 0,
    };
    return self;
});

export type ShapeInput = ReturnType<typeof createShapeInput>;
const createShapeInput = (shapePack: ShapePack) => {
    const device = getCachedDevice();
    const shapeInfoBuffer = createInputBuffer(
        device,
        shapePack.shapeInfo,
        GPUBufferUsage.STORAGE,
        "Shape Info Input Buffer"
    );

    const pointsBuf = createInputBuffer(
        device,
        shapePack.points,
        GPUBufferUsage.STORAGE,
        "Shape Points Input Buffer"
    );

    const bindGroup = device.createBindGroup({
        layout: layouts.shapeInput(),
        entries: bindGroupEntries([shapeInfoBuffer, pointsBuf]),
    });

    return {
        bindGroup,
        layout: layouts.shapeInput(),
        destroy: () => {
            shapeInfoBuffer.destroy();
            pointsBuf.destroy();
        },
    };
};

export type ShapeOutput = Awaited<ReturnType<typeof createShapeOutput>>;
const createShapeOutput = async (base: PyramidBase) => {
    const device = getCachedDevice();
    const size = await base.readPyramid();
    if (size === 0) return;

    // console.log("Shape output size: " + size);

    const shapeInfoBuffer = device.createBuffer({
        label: "Shape Info Input Buffer",
        size: size * 2 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const pointsBuffer = device.createBuffer({
        label: "Shape Points Input Buffer",
        size: size * 2 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    let shapeInfoReadBuffer = device.createBuffer({
        size: shapeInfoBuffer.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    let pointsReadBuffer = device.createBuffer({
        size: pointsBuffer.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        layout: layouts.shapeOutput(),
        entries: bindGroupEntries([shapeInfoBuffer, pointsBuffer]),
    });

    return {
        bindGroup,
        layout: layouts.shapeOutput(),
        read: async (
            handle: (shapeInfo: Uint32Array, points: Float32Array) => Promise<void> | void
        ) => {
            const commandEncoder = device.createCommandEncoder();

            commandEncoder.copyBufferToBuffer(
                shapeInfoBuffer,
                0,
                shapeInfoReadBuffer,
                0,
                shapeInfoBuffer.size
            );
            commandEncoder.copyBufferToBuffer(
                pointsBuffer,
                0,
                pointsReadBuffer,
                0,
                pointsBuffer.size
            );

            device.queue.submit([commandEncoder.finish()]);

            await shapeInfoReadBuffer!.mapAsync(GPUMapMode.READ);
            await pointsReadBuffer!.mapAsync(GPUMapMode.READ);

            const readShapeInfo = new Uint32Array(shapeInfoReadBuffer!.getMappedRange());
            const readPoints = new Float32Array(pointsReadBuffer!.getMappedRange());

            await handle(readShapeInfo, readPoints);

            shapeInfoReadBuffer!.unmap();
            pointsReadBuffer!.unmap();
        },
        count: size,
        destroy: () => {
            shapeInfoBuffer.destroy();
            pointsBuffer.destroy();
        },
    };
};

export type PyramidBase = ReturnType<typeof createPyramidBase>;
const createPyramidBase = cachedBase(({ layerBaseSize, layerCount }) => {
    const device = getCachedDevice();
    const size = layerBaseSize * layerBaseSize;
    const anglesValues = device.createBuffer({
        size: 2 * size * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const layersSize = (4 ** layerCount - 1) / 3 - 1;
    const layers = device.createBuffer({
        size: layersSize * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const layersReadBuffer = device.createBuffer({
        size: 4 * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const settings = device.createBuffer({
        size: 4 * 6,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        layout: layouts.pyramidBase(),
        entries: bindGroupEntries([anglesValues, layers, settings]),
    });

    let self = {
        bindGroup,
        layout: layouts.pyramidBase(),
        readPyramid: async () => {
            const commandEncoder = device.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(
                layers,
                layers.size - layersReadBuffer.size,
                layersReadBuffer,
                0,
                layersReadBuffer.size
            );

            device.queue.submit([commandEncoder.finish()]);

            await layersReadBuffer.mapAsync(GPUMapMode.READ);

            const resultBufferTop = new Uint32Array(layersReadBuffer.getMappedRange());

            let length = 0;
            for (let elem of resultBufferTop) {
                length += elem;
            }

            layersReadBuffer.unmap();

            return length;
        },
        update: (width: u32, threadCount: u32, lineCount: u32, max_x: f32) => {
            device.queue.writeBuffer(
                settings,
                0,
                multiTypeBuffer([
                    { u32: width },
                    { u32: threadCount },
                    { u32: lineCount },
                    { u32: 1 }, // write_self
                    { f32: max_x },
                    { u32: layerCount },
                ])
            );
            self.lineCount = lineCount;
            return self;
        },
        updateThreadCount: (thread_count: u32) => {
            device.queue.writeBuffer(settings, 1 * 4, multiTypeBuffer([{ u32: thread_count }]));
            return self;
        },
        destroy: () => {
            anglesValues.destroy();
        },
        lineCount: 0,
        cellCount: layerBaseSize * layerBaseSize,
        width: layerBaseSize,
        layers: layerCount,
        debugBases: async (name: string, batchCount: u32) => {
            await debugBases2(
                {
                    base: {
                        anglesValues,
                        lineCount: self.lineCount,
                        width: Math.max(Math.pow(2, Math.ceil(Math.log2(self.lineCount))), 16),
                    },
                },
                name,
                batchCount
            );
        },
        debugLayers: async (name: string) => {
            console.warn(name);

            const commandEncoder = device.createCommandEncoder();

            let readBuffer = device.createBuffer({
                size: layers.size,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
            });

            commandEncoder.copyBufferToBuffer(layers, 0, readBuffer, 0, layers.size);
            device.queue.submit([commandEncoder.finish()]);

            await readBuffer!.mapAsync(GPUMapMode.READ);

            const resultBuffer = new Uint32Array(readBuffer!.getMappedRange());
            let pyramid = [];

            let lowerStart = 0;

            for (let layer = layerCount - 1; layer > 0; --layer) {
                const dim = 1 << layer;
                const end = dim * dim;

                let floor = [];
                for (let j = 0; j < end; ++j) {
                    floor.push(resultBuffer[lowerStart + j]);
                }

                pyramid.push(floor);

                lowerStart += dim * dim;
            }

            console.log("pyramid");
            for (let floor of pyramid) {
                console.log(floor);
            }

            readBuffer!.unmap();
        },
    };
    return self;
});

export type BatchInfo = ReturnType<typeof createBatchInfo>;
const createBatchInfo = (batch: { count: u32; width: u32; height: u32 }) => {
    const device = getCachedDevice();

    let buffers = new Array<GPUBuffer>(batch.count);
    let bindGroups = new Array<GPUBindGroup>(batch.count);

    for (let i = 0; i < batch.count; ++i) {
        const batchInfoBuffer = createSettingsBuffer(
            [{ u32: i }, { u32: batch.width }, { u32: batch.height }],
            "Batch info",
            GPUBufferUsage.UNIFORM
        );
        const bindGroup = device.createBindGroup({
            label: "Batch info",
            layout: layouts.batchInfo(),
            entries: bindGroupEntries([batchInfoBuffer]),
        });

        buffers[i] = batchInfoBuffer;
        bindGroups[i] = bindGroup;
    }

    const self = {
        bindGroup: bindGroups[0],
        layout: layouts.batchInfo(),
        startBatch: (i: u32) => {
            self.bindGroup = bindGroups[i];
        },
        destroy: () => {
            buffers.forEach((buffer) => buffer.destroy());
        },
    };

    return self;
};

export type PyramidLayerSettingsDescriptor = {
    lowerStart: u32;
    upperDim: u32;
    layers: u32;
    layer: u32;
};
export type PyramidLayerSettings = ReturnType<typeof createPyramidLayerSettings>;
const createPyramidLayerSettings = ({
    lowerStart,
    upperDim,
    layers,
    layer,
}: PyramidLayerSettingsDescriptor) => {
    const device = getCachedDevice();

    const settingsBuffer = createSettingsBuffer(
        [{ u32: lowerStart }, { u32: upperDim }, { u32: layers }, { u32: layer }],
        "Settings for layer " + layer
    );

    const bindGroup = device.createBindGroup({
        label: "Settings for layer " + layer,
        layout: layouts.pyramidLayerSettings(),
        entries: bindGroupEntries([settingsBuffer]),
    });

    return {
        bindGroup,
        layout: layouts.pyramidLayerSettings(),
        destroy: () => {
            settingsBuffer.destroy();
        },
    };
};

export const bindGroups = {
    settings: createSettings,
    shapeInput: createShapeInput,
    shapeOutput: createShapeOutput,
    pyramidBase: createPyramidBase,
    pyramidLayerSettings: createPyramidLayerSettings,
    batchInfo: createBatchInfo,
    prepare,
};

/// Helper
type BindGroupLayout = {
    bindGroup: GPUBindGroup;
    layout: GPUBindGroupLayout & {
        wgsl: (group: number) => string;
    };
};

function prepare(groups: BindGroupLayout[]) {
    const layout = groups.map((group) => group.layout);
    const bindGroup = groups.map((group) => group.bindGroup);
    const bind = (pass: GPUComputePassEncoder) => {
        for (let i = 0; i < bindGroup.length; ++i) {
            pass.setBindGroup(i, bindGroup[i]);
        }
    };

    // const wgsl = layout.map((l, i) => l.wgsl(i)).join("\n");
    // console.log(wgsl);

    return { layout, bind };
}

export function cached<T extends () => any>(fn: T, update?: (self: ReturnType<T>) => void) {
    type Ret = ReturnType<T>;
    let cache: Ret | null = null;
    return () => {
        if (cache === null) {
            cache = fn();
        } else {
            update?.(cache);
        }
        return cache as Ret;
    };
}

export function cachedBase<T extends (x: LayerSize) => any>(
    fn: T,
    update?: (self: ReturnType<T>) => void
) {
    type Ret = ReturnType<T>;
    let cache: Ret | null = null;
    let lastValue: number | null = null;
    return (base: LayerSize) => {
        if (lastValue !== base.layerBaseSize) {
            lastValue = base.layerBaseSize;
            cache = fn(base);
        } else {
            update?.(cache!);
        }
        return cache as Ret;
    };
}

function bindGroupEntries(buffers: GPUBuffer[]) {
    return buffers.map((buffer, index) => ({
        binding: index,
        resource: {
            buffer,
        },
    })) satisfies GPUBindGroupEntry[];
}

export type LayerSize = ReturnType<typeof createLayerSize>;
export function createLayerSize(count: number) {
    const minLayerSize = 16;
    const maxLayerSize = 1024 * 2;

    let layerBaseSize = 0;

    if (dynamicSize) {
        layerBaseSize = Math.min(
            Math.max(2 ** Math.ceil(Math.log2(count)), minLayerSize),
            maxLayerSize
        );
    } else {
        layerBaseSize = 1024 * 2;
    }

    const layerCount = Math.ceil(Math.log2(layerBaseSize));

    return {
        layerBaseSize,
        layerCount,
    };
}
