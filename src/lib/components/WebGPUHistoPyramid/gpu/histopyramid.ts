import buildPyramidShader from "./shaders/build_pyramid.wgsl?raw";

import type { HistoPyramidGPU } from "./generateBuffers";

import { initPipeline } from "./pipelines";
import { createBindGroup, createSettingsBuffer } from "$util/gpuCommon";
import { batch } from "./batch";
import { createTimestamps } from "./timestamps";

export async function buildPyramid(pyramid: HistoPyramidGPU) {
    await buildPyramidSettings(pyramid);
}

async function buildPyramidSettings(pyramid: HistoPyramidGPU) {
    const { device, pipeline } = await initPipeline(buildPyramidShader, "Build HistoPyramid");

    // Check if we can cache the settings

    const bufferEntries = [pyramid.top, pyramid.middle, pyramid.base.anglesValues].map(
        (buffer, index) => {
            return {
                binding: index,
                resource: {
                    buffer: buffer,
                },
            };
        }
    );
    const bindGroup = device.createBindGroup({
        label: "Build pyramid from Bases",
        layout: pipeline.getBindGroupLayout(0),
        entries: bufferEntries,
    });

    let lowerStart = 0;

    const { layers } = pyramid;
    /// build settings buffers
    let settingBindGroups = new Array(layers - 1);
    for (let layer = layers - 1; layer > 0; --layer) {
        const upperDim = 1 << layer;

        const settingsBuf = createSettingsBuffer(
            [{ u32: lowerStart }, { u32: upperDim }, { u32: layers }, { u32: layer }],
            "Settings for layer " + layer + ": Build pyramid from Bases"
        );

        const settingsBindGroup = createBindGroup(
            pipeline,
            [settingsBuf],
            "Settings for layer " + layer + ": Build pyramid from Bases",
            1
        );

        if (layer != layers - 1) {
            lowerStart += upperDim * upperDim * 4;
        }

        settingBindGroups[layer] = settingsBindGroup;
    }

    /// build command buffer
    const commands = await buildCommands(
        device,
        layers,
        pipeline,
        upperBindGroup,
        settingBindGroups,
        pyramid
    );

    return commands;
}

async function buildCommands(
    device: GPUDevice,
    layers: number,
    pipeline: GPUComputePipeline,
    upperBindGroup: GPUBindGroup,
    settingBindGroups: GPUBindGroup[],
    pyramid: HistoPyramidGPU
) {
    const commandEncoder = device.createCommandEncoder();

    const ts = createTimestamps(commandEncoder, 1);

    ts.start("Build pyramid from Bases");

    for (let layer = layers - 1; layer > 0; --layer) {
        const settingsBindGroup = settingBindGroups[layer];
        const upperDim = 1 << layer;

        // const computePass = commandEncoder.beginComputePass({
        //     label: "Build pyramid from Bases, layer " + layer,
        // });

        await batch({
            label: "Build pyramid from Bases, layer " + layer,
            count: upperDim * upperDim,
            bind: (pass) => {
                pass.setBindGroup(0, upperBindGroup);
                pass.setBindGroup(1, settingsBindGroup);
            },
            batchBindIndex: 3,
            pipeline,
            commandEncoder,
            debug: true,
        });

        // computePass.setPipeline(pipeline);
        // computePass.setBindGroup(0, bindGroup);
        // computePass.setBindGroup(1, settingsBindGroup);
        // computePass.dispatchWorkgroups(Math.ceil((upperDim * upperDim) / WORKGROUP_SIZE));
        // computePass.end();
    }

    ts.end();
    await ts.submit();
}
