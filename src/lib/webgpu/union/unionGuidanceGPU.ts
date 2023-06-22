import { getDevice, createInputBuffer, createOutputBuffer, createBindGroup } from "$util/gpuCommon";
import shader from "./union.wgsl?raw";

import type { Intersection } from "$webgpu/split/lineIntesection";
import { debugNodes } from "$debug/visual";
import { profile } from "$components/Timing.svelte";

import { preprocessWGSL } from "$webgpu/common/preprocess";
import { multiTypeBuffer } from "$util/arrayBuffer";
import { DEBUG } from "$components/WebGPUHistoPyramid";

const useDebugNodes = false;

export async function create() {
    const workergroupSize = 256;

    const device = await getDevice();
    const module = device.createShaderModule({
        code: await preprocessWGSL(shader), //shader,
    });

    const descriptor: GPUComputePipelineDescriptor = {
        layout: "auto",
        compute: {
            module,
            entryPoint: "main",
            constants: {
                // tolerance: TOLERANCE,
            },
        },
    };
    const pipeline = await device.createComputePipelineAsync(descriptor);

    const descriptorCollect: GPUComputePipelineDescriptor = {
        layout: "auto",
        compute: {
            module,
            entryPoint: "collect",
        },
    };
    const pipelineCollect = await device.createComputePipelineAsync(descriptorCollect);

    async function calculateUnionGuidance(
        geometry: Geometry,
        intersectionMap: Intersection[][],
        linesBuffer: GPUBuffer,
        shapeLengths: number[]
    ) {
        profile.start("Calculate.Union.Build Point Buffers");
        // profile.start("Calculate.Union.Find Interior Points (GPU).Build Buffers");

        const results = {
            a: 0,
            b: 0,
            c: 0,
        };

        // if (useDebugNodes) {
        //     debugNodes.set([]);
        // }

        let pointsArray = intersectionMap
            .map((intersections, shapeIndex) =>
                intersections.map((intersection) => {
                    const shape = geometry[shapeIndex];
                    const next = (intersection.contourIndex + 1) % shape.contour!.length;

                    const cNode = shape.nodes[shape.contour![intersection.contourIndex]];
                    const nNode = shape.nodes[shape.contour![next]];

                    // if (useDebugNodes) {
                    //     debugNodes.update((nodes) => {
                    //         nodes.push({
                    //             x: (cNode.x + nNode.x) / 2,
                    //             y: (cNode.y + nNode.y) / 2,
                    //         });
                    //         return nodes;
                    //     });
                    // }

                    return [(cNode.x + nNode.x) / 2, (cNode.y + nNode.y) / 2];
                })
            )
            .flat(2);

        let points = new Float32Array(pointsArray);

        // console.log("imp", intersectionMap);
        // console.log("geometry", geometry);
        // console.log("points", points);

        let rayX =
            1 +
            geometry.reduce((max, shape) => {
                const maxShape = shape.nodes.reduce((max, node) => {
                    return Math.max(max, node.x);
                }, -Infinity);
                return Math.max(max, maxShape);
            }, -Infinity);

        const pointCount = points.length / 2;
        const lineCount = linesBuffer.size / 16;

        const count = lineCount * pointCount;

        /// CREATE BUFFERS ///
        const pointBuffer = createInputBuffer(device, points, undefined, "Points Buffer"); // points
        // TODO Check if MAP_READ could be used on output buffer directly to skip copying to read buffer
        // potential slowdown when writing to the buffer on the GPU
        const outputBuffer = createOutputBuffer(device, pointCount * 4, undefined, "Result Buffer");
        // TODO Consider just updating the data in this buffer instead of creating a new one
        const settingsBuffer = createInputBuffer(
            device,
            multiTypeBuffer([{ u32: pointCount }, { u32: lineCount }, { f32: rayX }]),
            GPUBufferUsage.UNIFORM,
            "Settings Buffer"
        );

        const intermediateBuffer = device.createBuffer({
            label: "Intermediate Buffer",
            size: count * 4,
            usage: GPUBufferUsage.STORAGE,
        });

        // console.log({ shapeLengths });
        const shapeLengthBuffer = createInputBuffer(
            device,
            new Uint32Array(shapeLengths),
            undefined,
            "Shape Length Buffer"
        ); // brokn

        const bindGroup = createBindGroup(
            pipeline,
            [settingsBuffer, pointBuffer, linesBuffer, intermediateBuffer],
            "Union Bind Group",
            0
        );

        const bindGroupCollect = device.createBindGroup({
            label: "Union Collect Bind Group",
            layout: pipelineCollect.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: settingsBuffer,
                    },
                },
                {
                    binding: 3,
                    resource: {
                        buffer: intermediateBuffer,
                    },
                },
                {
                    binding: 4,
                    resource: {
                        buffer: outputBuffer,
                    },
                },
                {
                    binding: 5,
                    resource: {
                        buffer: shapeLengthBuffer,
                    },
                },
            ],
        });

        // profile.end("Calculate.Union.Find Interior Points (GPU).Build Buffers");
        profile.end("Calculate.Union.Build Point Buffers");

        // const bindGroupCollect = createBindGroup(device, pipelineCollect, [
        //     pointBuffer,
        //     linesBuffer,
        //     outputBuffer,
        //     settingsBuffer,
        // ]);

        profile.start("Calculate.Union.Find Interior Points");
        const commandEncoder = device.createCommandEncoder();

        const MAX_WORKERS = 65535 * workergroupSize;

        // computePass.dispatchWorkgroups(Math.ceil((lineCount * pointCount) / workergroupSize));
        // computePass.end();

        let workLeft = lineCount * pointCount;
        let batchStart = 0;
        let i = 0;

        const computePass = commandEncoder.beginComputePass({ label: "Work pass " + i });

        for (let i = 0; i < 1000; i++) {
            const batchWorkers = Math.min(workLeft, MAX_WORKERS);

            const startBuffer = createInputBuffer(
                device,
                new Uint32Array([batchStart]),
                GPUBufferUsage.UNIFORM,
                "Start Buffer"
            );

            const bindGroupStart = createBindGroup(
                pipeline,
                [startBuffer],
                "Batch bind group " + i,
                1
            );

            if (DEBUG) {
                console.log("batch", i, "start", batchStart, "workers", batchWorkers);
            }
            computePass.setPipeline(pipeline);
            computePass.setBindGroup(0, bindGroup);
            computePass.setBindGroup(1, bindGroupStart);
            computePass.dispatchWorkgroups(Math.ceil(batchWorkers / workergroupSize));
            batchStart += batchWorkers;
            workLeft -= batchWorkers;

            if (workLeft <= 0) {
                break;
            }
        }

        computePass.end();

        const computePassCollect = commandEncoder.beginComputePass({ label: "Collect pass" });
        computePassCollect.setPipeline(pipelineCollect);
        computePassCollect.setBindGroup(0, bindGroupCollect);
        computePassCollect.dispatchWorkgroups(Math.ceil(pointCount / workergroupSize));
        computePassCollect.end();

        const readBuffer = device.createBuffer({
            size: outputBuffer.size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, outputBuffer.size);

        device.queue.submit([commandEncoder.finish()]);

        await readBuffer.mapAsync(GPUMapMode.READ);
        const resultBuffer = new Int32Array(readBuffer.getMappedRange());

        // if (useDebugNodes) {
        //     debugNodes.update((nodes) => {
        //         return nodes.map((node, index) => {
        //             return {
        //                 ...node,
        //                 color: resultBuffer[index] == 0 ? "red" : "green",
        //             };
        //         });
        //     });

        //     // debugNodes.update((nodes) => {
        //     //     return nodes.filter((node) => node.color == "red");
        //     // });
        // }

        // console.log("settings", {
        //     lineCount,
        //     pointCount,
        // });
        // console.log("resultBuffer", [...resultBuffer]);

        // const resultsArray = [...resultBuffer].map((v) => (v == 0 ? null : v));

        // const truth = [true, null, true, null, null, null, null, null, null];

        // const printResults = resultsArray.map((result, i) => {
        //     return {
        //         x: points[i * 2 + 0],
        //         y: points[i * 2 + 1],
        //         result,
        //         truth: truth[i],
        //     };
        // });
        // console.table(printResults);

        profile.end("Calculate.Union.Find Interior Points");

        profile.start("Calculate.Union.Extract Interior Points");

        let duration = (performance.now() - batchStart).toFixed(2);

        let index = 0;

        type ResultIntersection = Intersection & {
            isInside: boolean;
        };

        let newIntersections: ResultIntersection[][] = intersectionMap as any;
        newIntersections.forEach((intersections) => {
            intersections.forEach((intersection) => {
                const isInside = resultBuffer[index] !== 0;
                index += 1;
                intersection.isInside = isInside;
            });
        });
        readBuffer.unmap();

        profile.end("Calculate.Union.Extract Interior Points");

        /// CLEANUP ///
        // inputBuffer.destroy();
        // outputBuffer.destroy();
        // settingsBuffer.destroy();
        // readBuffer.destroy();

        return {
            newIntersections,
            duration,
            // resultBuffer,
            // unmap: () => readBuffer.unmap(),
        };
    }

    return {
        calculateUnionGuidance,
    };
}
