import { intersections } from "./intersections";
import { union } from "./union";
import { split } from "./split";
import { arrayBuffer } from "$util/arrayBuffer";
import type { HistoPyramidGPU } from "./gpu/generateBuffers";
import { getDevice } from "$util/gpuCommon";

export const DATA_TYPE = ["ENUM (u32)", "S (f32)"];
export const LOOP_MAX = 10000;

export const DEBUG = false;

export const GPU = {
    intersections,
    union,
    split,
};

export type ShapePack = ReturnType<typeof packPolygonShapes>;
export function packPolygonShapes(geometry: Geometry) {
    const lengths = geometry.map((shape) => shape.nodes.length);
    const size = lengths.reduce((a, b) => a + b, 0);

    const points = arrayBuffer(size * 2, "f32");
    const shapeInfo = arrayBuffer(size, "i32");

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    let offset = 0;
    for (let shapeIndex = 0; shapeIndex < geometry.length; shapeIndex++) {
        const shape = geometry[shapeIndex];
        const length = lengths[shapeIndex];

        for (let nodeIndex = 0; nodeIndex < shape.nodes.length; nodeIndex++) {
            const node = shape.nodes[nodeIndex];
            points[(offset + nodeIndex) * 2] = node.x;
            points[(offset + nodeIndex) * 2 + 1] = node.y;

            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);

            shapeInfo[offset + nodeIndex] = shapeIndex;
        }
        shapeInfo[offset + length - 1] = -length;
        offset += length;
    }

    if (DEBUG) {
        console.warn("CPU ShapePack");
        console.log({
            points,
            shapeInfo,
            minX: minX,
            maxX: maxX,
            minY: minY,
            maxY: maxY,
        });
    }

    return {
        points,
        shapeInfo,
        minX: minX,
        maxX: maxX,
        minY: minY,
        maxY: maxY,
        lineCount: size,
    };
}

export type ShapeExtractionPack = ReturnType<typeof extractNewShapes>;
export async function extractNewShapes({ newShapeInfoBuf, newPointsBuf }: any) {
    const device = await getDevice();
    const commandEncoder = device.createCommandEncoder();

    let readNewShapeInfoBuf = device.createBuffer({
        size: newShapeInfoBuf.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    let readNewPointsBuf = device.createBuffer({
        size: newPointsBuf.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    commandEncoder.copyBufferToBuffer(
        newShapeInfoBuf,
        0,
        readNewShapeInfoBuf,
        0,
        newShapeInfoBuf.size
    );
    commandEncoder.copyBufferToBuffer(newPointsBuf, 0, readNewPointsBuf, 0, newPointsBuf.size);

    device.queue.submit([commandEncoder.finish()]);

    await readNewShapeInfoBuf!.mapAsync(GPUMapMode.READ);
    await readNewPointsBuf!.mapAsync(GPUMapMode.READ);

    const resultNewShapeInfoBuf = new Uint32Array(readNewShapeInfoBuf!.getMappedRange());
    const resultNewPointsBuf = new Float32Array(readNewPointsBuf!.getMappedRange());

    // console.time("copy data to arrays");

    let info = [...resultNewShapeInfoBuf];
    let points = [];
    for (let i = 0; i < resultNewShapeInfoBuf.length; ++i) {
        let x = resultNewPointsBuf[2 * i];
        let y = resultNewPointsBuf[2 * i + 1];
        points.push({ x, y });
    }
    // console.timeEnd("copy data to arrays");

    readNewShapeInfoBuf!.unmap();
    readNewPointsBuf!.unmap();

    if (DEBUG) {
        console.warn("New Shapes");
        console.log(points);
        console.warn("New Shapes Info");
        console.log(info);
    }

    return { info, points };
}

export async function debugBases(
    lineCount: number,
    baseBufs: GPUBuffer[],
    msg: string | null = null
) {
    if (!DEBUG) {
        return;
    }
    if (msg) {
        console.log(msg);
    }
    const device = await getDevice();
    const commandEncoder = device.createCommandEncoder();

    const readBufferEnums = device.createBuffer({
        size: baseBufs[0].size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const readBufferValues = device.createBuffer({
        size: baseBufs[1].size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    commandEncoder.copyBufferToBuffer(baseBufs[0], 0, readBufferEnums, 0, baseBufs[0].size);
    commandEncoder.copyBufferToBuffer(baseBufs[1], 0, readBufferValues, 0, baseBufs[1].size);

    device.queue.submit([commandEncoder.finish()]);

    await readBufferEnums!.mapAsync(GPUMapMode.READ);
    await readBufferValues!.mapAsync(GPUMapMode.READ);

    const resultBufferEnums = new Int32Array(readBufferEnums!.getMappedRange());
    const resultBufferValues = new Float32Array(readBufferValues!.getMappedRange());

    let unflatEnums = [];
    let unflatValues: Array<Array<number | null>> = [];
    for (let j = 0; j < lineCount; ++j) {
        let innerEnums = [];
        let innerValues: Array<number | null> = [];

        for (let i = 0; i < lineCount; ++i) {
            let next = resultBufferValues[j * lineCount + i];
            let pushed = next == -10 ? null : next;
            innerEnums.push(resultBufferEnums[j * lineCount + i]);
            innerValues.push(pushed);
        }
        unflatEnums.push(innerEnums);
        unflatValues.push(innerValues);
    }

    console.table(unflatEnums);
    console.table(unflatValues);
    // debugMatrix(unflatEnums);
    // debugMatrix(unflatValues);

    readBufferEnums!.unmap();
    readBufferValues!.unmap();
}

export async function debugPyramid(
    { base: baseBufs, middle: middleBuf, top: topBuf, layers }: HistoPyramidGPU,
    msg: string | null = null
) {
    if (!DEBUG) {
        return;
    }
    if (msg) {
        console.warn(msg);
    }
    const device = await getDevice();
    const commandEncoder = device.createCommandEncoder();

    let readBufferTop = device.createBuffer({
        size: topBuf.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    let readBufferMiddle = device.createBuffer({
        size: middleBuf.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    commandEncoder.copyBufferToBuffer(topBuf, 0, readBufferTop, 0, topBuf.size);
    commandEncoder.copyBufferToBuffer(middleBuf, 0, readBufferMiddle, 0, middleBuf.size);

    device.queue.submit([commandEncoder.finish()]);

    await readBufferTop!.mapAsync(GPUMapMode.READ);
    await readBufferMiddle!.mapAsync(GPUMapMode.READ);

    const resultBufferTop = new Uint32Array(readBufferTop!.getMappedRange());
    const resultBufferMiddle = new Uint32Array(readBufferMiddle!.getMappedRange());

    let pyramid = [];

    let lowerStart = 0;

    for (let layer = layers - 1; layer > 1; --layer) {
        const dim = 1 << layer;
        const end = dim * dim;

        let floor = [];
        for (let j = 0; j < end; ++j) {
            floor.push(resultBufferMiddle[lowerStart + j]);
        }

        pyramid.push(floor);

        lowerStart += dim * dim;
    }

    pyramid.push([...resultBufferTop]);
    console.log(pyramid);

    readBufferTop!.unmap();
    readBufferMiddle!.unmap();
    // debugMatrix(pyramid[0]);
}
