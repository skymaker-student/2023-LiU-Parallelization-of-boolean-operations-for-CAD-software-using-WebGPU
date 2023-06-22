import { arrayBuffer } from "$util/arrayBuffer";
import { createInputBuffer, getDevice } from "$util/gpuCommon";
import { WEBGPU_TYPES_SIZE } from "$webgpu/common/constants";
import type { ShapePack } from "..";
import { DEBUG } from "..";

export type HistoPyramidGPU = AwaitedRet<typeof generateHistoPyramidBuffers>;

const TOP_DIM = 2;

export async function generateHistoPyramidBuffers(count: number) {
    const device = await getDevice();

    const layers = Math.min(Math.max(Math.ceil(Math.log2(count)), 4), 40);
    const topCount = TOP_DIM * TOP_DIM;
    const middleCount = (4 ** layers - 1) / 3 - topCount - 1;
    const baseWidth = 1 << layers;
    // const baseWidth = count;
    // const baseWidth = count;
    const baseCount = baseWidth ** 2;

    let usage = GPUBufferUsage.STORAGE;
    if (DEBUG) {
        usage |= GPUBufferUsage.COPY_SRC;
    }

    const anglesValues = device.createBuffer({
        label: `HistoPyramid Base Buffer (Angle f32, S f32)`,
        size: 2 * baseCount * WEBGPU_TYPES_SIZE,
        usage,
    });
    // const enums = device.createBuffer({
    //     label: `HistoPyramid Base Buffer (Enum u32)`,
    //     size: baseCount * WEBGPU_TYPES_SIZE,
    //     usage,
    // });
    // const values = device.createBuffer({
    //     label: `HistoPyramid Base Buffer (S f32)`,
    //     size: baseCount * WEBGPU_TYPES_SIZE,
    //     usage,
    // });

    const middleBuffer = device.createBuffer({
        label: "HistoPyramid Middle Buffer",
        size: middleCount * WEBGPU_TYPES_SIZE,
        usage,
    });
    const topBuffer = device.createBuffer({
        label: "HistoPyramid Top Buffer",
        size: topCount * WEBGPU_TYPES_SIZE,
        usage: usage | GPUBufferUsage.COPY_SRC,
    });

    return {
        layers,
        base: {
            anglesValues: anglesValues,
            lineCount: count,
            width: baseWidth,
        },
        middle: middleBuffer,
        top: topBuffer,
        all: [topBuffer, middleBuffer, anglesValues],
    };
}

export type ShapesPackGPU = Awaited<ReturnType<typeof generateShapeBuffers>>;
export async function generateShapeBuffers({
    shapeInfo,
    points,
    minX,
    maxX,
    minY,
    maxY,
}: ShapePack) {
    const device = await getDevice();

    const shapeInfoBuf = createInputBuffer(
        device,
        shapeInfo,
        GPUBufferUsage.STORAGE,
        "Prefix Sum Buffer"
    );

    const pointsBuf = createInputBuffer(
        device,
        points,
        GPUBufferUsage.STORAGE,
        "Prefix Sum Buffer"
    );

    return { shapeInfoBuf, pointsBuf, minX, maxX, minY, maxY, lineCount: shapeInfo.length };
}

export type NewShapesPackGPU = Awaited<ReturnType<typeof generateNewShapesBuffers>>;
export async function generateNewShapesBuffers(topBuf: GPUBuffer) {
    const device = await getDevice();

    const count = await readTopBuffer(topBuf);

    const newPointsBuf = device.createBuffer({
        size: count * WEBGPU_TYPES_SIZE * 2,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const newShapeInfoBuf = device.createBuffer({
        size: count * WEBGPU_TYPES_SIZE,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    return { newPointsBuf, newShapeInfoBuf, newLineCount: newPointsBuf.size / 8 };
}

export async function generateIntersectionOutputBuffers(count: number) {
    const device = await getDevice();

    const point = device.createBuffer({
        size: count * WEBGPU_TYPES_SIZE * 2,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // const line = device.createBuffer({
    //     size: count * WEBGPU_TYPES_SIZE,
    //     usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    // });

    // const shape = device.createBuffer({
    //     size: count * WEBGPU_TYPES_SIZE,
    //     usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    // });

    // const s = device.createBuffer({
    //     size: count * WEBGPU_TYPES_SIZE,
    //     usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    // });

    return { point }; // line, shape, s
}

export async function readTopBuffer(topBuf: GPUBuffer) {
    const device = await getDevice();

    const readBufferTop = device.createBuffer({
        size: topBuf.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(topBuf, 0, readBufferTop, 0, topBuf.size);

    device.queue.submit([commandEncoder.finish()]);

    await readBufferTop.mapAsync(GPUMapMode.READ);

    const resultBufferTop = new Uint32Array(readBufferTop.getMappedRange());

    let length = 0;
    for (let elem of resultBufferTop) {
        length += elem;
    }

    readBufferTop.unmap();

    return length;
}

export type HolePointsPackGPU = Awaited<ReturnType<typeof generateHolePointsBuffer>>;
export async function generateHolePointsBuffer(newHoles: Vec2[][]) {
    const device = await getDevice();

    const count = newHoles.length;
    const holePoints = arrayBuffer(newHoles.map((hole) => [hole[0].x, hole[0].y]).flat(), "f32");

    const buffer = createInputBuffer(
        device,
        holePoints,
        GPUBufferUsage.STORAGE,
        "Hole Points Buffer"
    );

    if (count != holePoints.byteLength / 8) {
        throw new Error("A hole points buffer is invalid");
    }

    return { buffer, count };
}
