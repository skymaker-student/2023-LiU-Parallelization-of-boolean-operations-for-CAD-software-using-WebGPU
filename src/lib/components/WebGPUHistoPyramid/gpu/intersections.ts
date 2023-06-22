import filterIntersectionShader from "./shaders/filter_intersections.wgsl?raw";

import { createBindGroup, createSettingsBuffer } from "$util/gpuCommon";
import { WORKGROUP_SIZE } from ".";
import {
    generateIntersectionOutputBuffers,
    readTopBuffer,
    type HistoPyramidGPU,
    type ShapesPackGPU,
} from "./generateBuffers";
import { initPipeline } from "./pipelines";

export async function filterIntersections(
    pyramid: HistoPyramidGPU,
    { shapeInfoBuf, pointsBuf }: ShapesPackGPU,
    lineCount: number
) {
    const { device, pipeline } = await initPipeline(filterIntersectionShader, "Intersection");

    const count = await readTopBuffer(pyramid.top);
    const out = await generateIntersectionOutputBuffers(count);

    const settingsBuffer = createSettingsBuffer(
        [{ u32: pyramid.base.width }, { u32: count }, { u32: lineCount }, { u32: pyramid.layers }],
        "Settings: Process lines from points"
    );

    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass({
        label: "Filter intersections, pass",
    });

    const inputBuffers = [
        settingsBuffer,
        shapeInfoBuf,
        pointsBuf,
        pyramid.top,
        pyramid.middle,
        pyramid.base.enums,
        pyramid.base.values,
    ];
    const inputBind = createBindGroup(pipeline, inputBuffers, "Input buffers", 0);

    const outputBuffers = Object.values(out);
    const outputBind = createBindGroup(pipeline, outputBuffers, "Output buffers", 1);

    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, inputBind);
    computePass.setBindGroup(1, outputBind);
    computePass.dispatchWorkgroups(Math.ceil(count / WORKGROUP_SIZE));
    computePass.end();

    // Read buffers
    const readBuffers = outputBuffers.map((buffer) => {
        const readBuffer = device.createBuffer({
            size: buffer.size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });
        commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, buffer.size);
        return readBuffer;
    });

    device.queue.submit([commandEncoder.finish()]);

    return readBuffers; // only point outputs
}
