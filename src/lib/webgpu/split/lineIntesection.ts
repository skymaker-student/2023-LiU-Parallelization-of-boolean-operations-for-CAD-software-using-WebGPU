import {
    getDevice,
    createInputBuffer,
    createOutputBuffer,
    createBindGroup,
    createSettingsBuffer,
} from "$util/gpuCommon";
import shader from "./intersect.wgsl?raw";
import IntersectWorker from "./intersectionWorker.ts?worker";
import { profile } from "$components/Timing.svelte";

import { CAD } from "$skymaker";

import { TOLERANCE } from "$webgpu/common/constants";
import { preprocessWGSL } from "$webgpu/common/preprocess";

export type Intersection = {
    neighborShapeIndex: number;
    neighborIndex: number;
    contourIndex: number;
    s: number;
};
export type UniIntersection = Intersection & { shapeIndex: number };

export async function create() {
    const workergroupSize = 256;

    const device = await getDevice();
    const descriptor: GPUComputePipelineDescriptor = {
        layout: "auto",
        compute: {
            module: device.createShaderModule({
                code: await preprocessWGSL(shader),
            }),
            entryPoint: "main",
            constants: {
                // tolerance: TOLERANCE,
            },
        },
    };
    const pipeline = await device.createComputePipelineAsync(descriptor);

    async function calculateShapeIntersections(geometry: Geometry, useWorkers: boolean) {
        profile.start("Calculate.Split");
        profile.start("Calculate.Split.Build Buffers");
        const shapeLines = geometry.map(CAD.generateLinesFromShape);
        const lines = shapeLines.flat();

        const linesFlat = lines.flatMap((line) => [
            line.start.x,
            line.start.y,
            line.end.x,
            line.end.y,
        ]);
        const width = lines.length;
        const height = Math.ceil(lines.length / 2);

        const count = width * height;

        /// CREATE BUFFERS ///
        // profile.start("Calculate.Split.Build Buffers.Input");
        const inputBuffer = createInputBuffer(device, new Float32Array(linesFlat));
        // await profile.end("Calculate.Split.Build Buffers.Input", true);
        // TODO Check if MAP_READ could be used on output buffer directly to skip copying to read buffer
        // potential slowdown when writing to the buffer on the GPU
        // profile.start("Calculate.Split.Build Buffers.Output");
        const outputBuffer = createOutputBuffer(device, count * 4 * 2, undefined, "Result Buffer");
        // await profile.end("Calculate.Split.Build Buffers.Output", true);
        // TODO Consider just updating the data in this buffer instead of creating a new one
        // profile.start("Calculate.Split.Build Buffers.Settings");
        const settingsBuffer = createSettingsBuffer([
            // { value: TOLERANCE, type: "f32" }, // epsilon
            { u32: count }, // count
            { u32: lines.length }, // n
        ]);
        // await profile.end("Calculate.Split.Build Buffers.Settings", true);

        const bindGroup = createBindGroup(
            pipeline,
            [inputBuffer, outputBuffer, settingsBuffer],
            "",
            0
        );

        await profile.end("Calculate.Split.Build Buffers", true);

        profile.start("Calculate.Split.Execute");
        const commandEncoder = device.createCommandEncoder();

        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, bindGroup);
        computePass.dispatchWorkgroups(Math.ceil(count / workergroupSize));
        computePass.end();

        const readBuffer = device.createBuffer({
            size: outputBuffer.size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, outputBuffer.size);

        device.queue.submit([commandEncoder.finish()]);
        await profile.end("Calculate.Split.Execute", true);

        profile.start("Calculate.Split.Extract");

        await readBuffer.mapAsync(GPUMapMode.READ);
        const resultBuffer = readBuffer.getMappedRange();

        /* prettyPrintCompactArray(new Float32Array(resultBuffer), width, height); */

        const intersectionMap = new Array(geometry.length)
            .fill(undefined)
            .map(() => [] as Intersection[]);

        await processData(resultBuffer, intersectionMap, shapeLines, { width, height }, useWorkers);

        readBuffer.unmap();

        profile.end("Calculate.Split.Extract");

        profile.end("Calculate.Split");

        /// CLEANUP ///
        // inputBuffer.destroy();
        // outputBuffer.destroy();
        // settingsBuffer.destroy();
        // readBuffer.destroy();

        return {
            intersectionMap,
            inputBuffer,
        };
    }

    return {
        calculateShapeIntersections,
    };
}

async function processData(
    resultBuffer: ArrayBuffer,
    intersectionMap: Intersection[][],
    shapeLines: Line[][],
    { width, height }: { width: number; height: number },
    useWorkers: boolean
) {
    // console.time("create index");
    const lineToShape = shapeLines.flatMap((shape, index) => shape.map((line) => index));
    const shapeToLine = shapeLines.reduce((acc, shape, index) => {
        acc[index] = (acc[index - 1] ?? 0) + shape.length;
        return acc;
    }, new Array<number>(shapeLines.length).fill(0));
    // console.timeEnd("create index");

    if (useWorkers) {
        // TODO Get this array as shared from the beginning?
        let result = new Float32Array(new SharedArrayBuffer(resultBuffer.byteLength));
        result.set(new Float32Array(resultBuffer));

        const lineShapeBuffer = new Uint16Array(new SharedArrayBuffer(lineToShape.length * 2));
        const shapeLineBuffer = new Uint16Array(new SharedArrayBuffer(shapeToLine.length * 2));
        lineShapeBuffer.set(lineToShape);
        shapeLineBuffer.set(shapeToLine);

        await processRowsWorkers(
            result,
            { width, height },
            lineShapeBuffer,
            shapeLineBuffer,
            intersectionMap
        );
    } else {
        let result = new Float32Array(resultBuffer);

        processRowsSync(result, { width, height }, lineToShape, shapeToLine, intersectionMap);
    }
}

async function processRowsWorkers(
    result: Float32Array,
    { width, height }: { width: number; height: number },
    lineToShape: Uint16Array,
    shapeToIndex: Uint16Array,
    intersectionMap: Intersection[][]
) {
    const count = navigator.hardwareConcurrency;
    const slice = Math.ceil(height / count);
    let pool = new Array(navigator.hardwareConcurrency)
        .fill(undefined)
        .map((_, index) =>
            processRowsWorker(
                index,
                slice * index,
                Math.min(slice * (index + 1), height),
                result,
                { width, height },
                lineToShape,
                shapeToIndex
            )
        );
    const res = await Promise.all(pool);

    const intersections = [].concat(...(res as any)) as UniIntersection[];
    intersections.forEach((intersection, index) => {
        intersectionMap[intersection.shapeIndex].push(intersection);
    });
}

const workers = new Array(navigator.hardwareConcurrency)
    .fill(undefined)
    .map(() => new IntersectWorker());

async function processRowsWorker(
    index: number,
    start: number,
    end: number,
    result: Float32Array,
    { width, height }: { width: number; height: number },
    lineToShape: Uint16Array,
    shapeToIndex: Uint16Array
) {
    type UniIntersection = { shape: number; data: Intersection };

    const worker = workers[index];
    worker.postMessage({
        start,
        end,
        result,
        width,
        height,
        lineToShape,
        shapeToIndex,
    });

    return new Promise<UniIntersection[]>((resolve) => {
        worker.onmessage = (e) => {
            resolve(e.data);
        };
    });
}

async function processRowsSync(
    result: Float32Array,
    { width, height }: { width: number; height: number },
    lineToShape: number[],
    shapeToIndex: number[],
    intersectionMap: Intersection[][]
) {
    function leftSide(y: number) {
        if (width % 2 === 0 && y === height - 1) return;

        let line = width - 2 - y;

        for (let x = 0; x < y + 1; x++) {
            let targetLine = width - 1 - x;
            process(x, y, line, targetLine);
        }
    }

    function rightSide(y: number) {
        let line = y;

        for (let x = y + 1; x < width; x++) {
            let targetLine = x;
            process(x, y, line, targetLine);
        }
    }

    function process(x: number, y: number, lineA: number, lineB: number) {
        let shapeA = lineToShape[lineA];
        let shapeB = lineToShape[lineB];

        let index = (y * width + x) * 2;

        let dataA = result[index];
        let dataB = result[index + 1];

        if (dataA < -TOLERANCE && dataB < -TOLERANCE) return;
        if (shapeA === shapeB) return;

        const neighborIndexB = intersectionMap[shapeB].length;
        const neighborIndexA = intersectionMap[shapeA].length;

        intersectionMap[shapeA].push({
            neighborShapeIndex: shapeB,
            // neighborIndex: lineB - (shapeToIndex[shapeB - 1] ?? 0),
            neighborIndex: neighborIndexB,
            contourIndex: lineA - (shapeToIndex[shapeA - 1] ?? 0),
            s: dataA,
        });

        intersectionMap[shapeB].push({
            neighborShapeIndex: shapeA,
            // neighborIndex: lineA - (shapeToIndex[shapeA - 1] ?? 0),
            neighborIndex: neighborIndexA,
            contourIndex: lineB - (shapeToIndex[shapeB - 1] ?? 0),
            s: dataB,
        });
    }

    for (let y = 0; y < height; y++) {
        leftSide(y);
        rightSide(y);
    }
}

function prettyPrintCompactArray(data: Float32Array, width: number, height: number) {
    let unflat = [];
    for (let i = 0; i < height; ++i) {
        unflat.push(
            [...data.slice(2 * i * width, 2 * (i + 1) * width)].map((v) =>
                v <= 0 || v >= 1 ? null : v
            )
        );
    }

    let toPrintA = new Array(width).fill(undefined).map((v) => new Array(width).fill(null));
    let toPrintB = new Array(width).fill(undefined).map((v) => new Array(width).fill(null));

    const nullify = (v: number) => (v <= 0 || v >= 1 ? null : v);
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            let i = x;
            let j = y;

            if (x <= y) {
                i = width - 1 - x;
                j = width - 2 - y;
            }

            toPrintA[j][i] = nullify(data[y * width * 2 + x * 2]);
            toPrintB[j][i] = nullify(data[y * width * 2 + x * 2 + 1]);
        }
    }

    console.table(
        unflat,
        Object.keys(unflat[0]).filter((v) => +v % 2 == 1)
    );

    console.table(toPrintA);

    console.table(
        unflat,
        Object.keys(unflat[0]).filter((v) => +v % 2)
    );

    console.table(toPrintB);
}
