import { TOLERANCE, WEBGPU_TYPES_SIZE } from "$webgpu/common/constants";
import type { WEBGPU_TYPE } from "$webgpu/common/constants";
import type { HistoPyramidGPU } from "./gpu/generateBuffers";
import * as GPU from "./gpu";
import { DEBUG } from "./";
import { arrayBuffer } from "$util/arrayBuffer";
import { debugArray } from "$debug/visual";
import { getDevice } from "$util/gpuCommon";

const DATA_TYPE = ["ENUM (u32)", "S (f32)"];

export async function intersections(geometry: Geometry) {
    const shapePack = packPolygonShapes(geometry);
    const shapePackBuffers = await GPU.generateShapeBuffers(shapePack);

    const lineCount = shapePack.shapeInfo.length;

    const pyramid = await GPU.generateHistoPyramidBuffers(lineCount);

    await GPU.segmentLines(shapePackBuffers, pyramid, false);

    await GPU.buildPyramid(pyramid);

    const readBuffers = await GPU.filterIntersections(pyramid, shapePackBuffers, lineCount);

    await Promise.all(readBuffers.map((b) => b.mapAsync(GPUMapMode.READ)));

    const points = new Array<Vec2>(readBuffers[0].size / WEBGPU_TYPES_SIZE / 2);
    let data = new Float32Array(readBuffers[0].getMappedRange());
    for (let i = 0; i < points.length; i++) {
        points[i] = { x: data[i * 2], y: data[i * 2 + 1] };
    }

    await debugBases(pyramid, points, "Find line segments");

    readBuffers.map((b) => b.unmap());

    return points;
}

export type ShapePack = ReturnType<typeof packPolygonShapes>;
function packPolygonShapes(geometry: Geometry) {
    const lengths = geometry.map((shape) => shape.nodes.length);
    const size = lengths.reduce((a, b) => a + b, 0);

    const points = arrayBuffer(size * 2, "f32");
    const shapeInfo = arrayBuffer(size, "i32");

    let maxX = -Infinity;

    let offset = 0;
    for (let shapeIndex = 0; shapeIndex < geometry.length; shapeIndex++) {
        const shape = geometry[shapeIndex];
        const length = lengths[shapeIndex];

        for (let nodeIndex = 0; nodeIndex < shape.nodes.length; nodeIndex++) {
            const node = shape.nodes[nodeIndex];
            points[(offset + nodeIndex) * 2] = node.x;
            points[(offset + nodeIndex) * 2 + 1] = node.y;

            maxX = Math.max(maxX, node.x);

            shapeInfo[offset + nodeIndex] = shapeIndex;
        }
        shapeInfo[offset + length - 1] = -length;
        offset += length;
    }

    return {
        points,
        shapeInfo,
        maxX,
    };
}

async function debugBases(pyramid: HistoPyramidGPU, points: Vec2[], msg: string | null = null) {
    if (!DEBUG) {
        return;
    }
    if (msg) {
        console.log(msg);
    }
    const device = await getDevice();
    const commandEncoder = device.createCommandEncoder();

    const readBufferEnums = device.createBuffer({
        size: pyramid.base.enums.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const readBufferValues = device.createBuffer({
        size: pyramid.base.values.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    commandEncoder.copyBufferToBuffer(
        pyramid.base.enums,
        0,
        readBufferEnums,
        0,
        readBufferEnums.size
    );
    commandEncoder.copyBufferToBuffer(
        pyramid.base.values,
        0,
        readBufferValues,
        0,
        readBufferValues.size
    );

    device.queue.submit([commandEncoder.finish()]);

    await readBufferEnums!.mapAsync(GPUMapMode.READ);
    await readBufferValues!.mapAsync(GPUMapMode.READ);

    const resultBufferEnums = new Int32Array(readBufferEnums!.getMappedRange());
    const resultBufferValues = new Float32Array(readBufferValues!.getMappedRange());

    debugArray(resultBufferValues, undefined, undefined, {
        text(value, x, y) {
            if (resultBufferEnums[y * pyramid.base.width + x] === 0 && value === 0) return "";
            return value?.toFixed(2);
        },
        color(value, x, y) {
            return value === -10 ? "gray" : "white";
        },
        background(value, x, y) {
            if (points.find((p) => p.x === x && p.y === y)) {
                return "red";
            }
            return resultBufferEnums[y * pyramid.base.width + x] === 0 ? "#3c3c3c" : "";
        },
    });

    readBufferEnums!.unmap();
    readBufferValues!.unmap();
}

async function debugPyramid(
    layers: number,
    { base: baseBufs, middle: middleBuf, top: topBuf }: HistoPyramidGPU,
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

    for (let layer = layers - 2; layer > 1; --layer) {
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
}
