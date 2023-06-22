import segmentLinesShader from "./shaders/segment_lines.wgsl?raw";
import buildPyramidShader from "./shaders/build_pyramid.wgsl?raw";
import filterSegmentsShader from "./shaders/filter_segments.wgsl?raw";
import buildNewShapesFromPyramidShader from "./shaders/build_new_shapes_from_pyramid.wgsl?raw";

import { createBindGroup, createInputBuffer, getDevice } from "$util/gpuCommon";
import type { BindGroups } from "../union";
import { initPipeline } from "./pipelines";
import { bindGroups, cached, cachedBase } from "./shaders/bindGroup";
import { createTimestamps, type Timestamps } from "./timestamps";
import { profile } from "$components/Timing.svelte";
import { layouts } from "./shaders/layout";

export type BatchDescriptor = {
    label?: string;
    count: number;
    bind: (pass: GPUComputePassEncoder) => Promise<void> | void;
    batchBindIndex: number;
    pipeline: GPUComputePipeline;
    commandEncoder: GPUCommandEncoder;
    debug?: boolean;
};
export async function batch({
    count,
    label,
    bind,
    batchBindIndex,
    pipeline,
    commandEncoder,
    debug,
}: BatchDescriptor) {
    // console.log(`Batching ${count} workers (${label})`);

    const workergroupSize = 256;
    const MAX_WORKERS = 65535 * workergroupSize;

    const device = await getDevice();
    const computePass = commandEncoder.beginComputePass({ label });

    for (let batchStart = 0; batchStart < count; batchStart += MAX_WORKERS) {
        const batchWorkers = Math.min(count - batchStart, MAX_WORKERS);

        const batchBuffer = createInputBuffer(
            device,
            new Uint32Array([batchStart]),
            GPUBufferUsage.UNIFORM,
            "Batch Buffer"
        );

        const batchBindGroup = createBindGroup(
            pipeline,
            [batchBuffer],
            "Batch bind group " + batchStart,
            batchBindIndex
        );

        // console.log(`Batch: ${batchStart}, ${batchWorkers}`);

        computePass.setPipeline(pipeline);

        await bind(computePass);

        computePass.setBindGroup(batchBindIndex, batchBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(batchWorkers / workergroupSize));
    }

    computePass.end();
}

/// IMPLEMENTATIONS

export type BatchDispatchDescriptor = {
    label: string;
    count: number;
    bind: (pass: GPUComputePassEncoder) => Promise<void> | void;
    pipeline: GPUComputePipeline;
    commandEncoder?: GPUCommandEncoder;
};
async function batchedDispatch({
    label,
    count,
    bind,
    pipeline,
    commandEncoder,
}: BatchDispatchDescriptor) {
    if (count === 0) return;

    const WORKGROUP_SIZE = 256;

    const device = await getDevice();

    const noEncoder = !commandEncoder;
    let ts: Timestamps;
    if (!commandEncoder) {
        commandEncoder = device.createCommandEncoder();
        ts = createTimestamps(commandEncoder, 0); // 1
        // ts.start(`GPU.${label} (Compute)`);
    }

    const computePass = commandEncoder.beginComputePass({ label });

    computePass.setPipeline(pipeline);
    await bind(computePass);
    computePass.dispatchWorkgroups(Math.ceil(count / WORKGROUP_SIZE));

    computePass.end();

    if (noEncoder) {
        // ts!.end();
        await ts!.submit();
    }
}

export async function segmentLinesBatched(groups: BindGroups) {
    const label = "Segment Lines";

    // profile.start(`GPU.${label} (Pipeline)`);
    const { layout, bind } = bindGroups.prepare([
        groups.pyramidBase,
        groups.shapeInput,
        groups.batchInfo,
    ]);
    const { pipeline } = await initPipeline(segmentLinesShader, label, layout);
    // await profile.end(`GPU.${label} (Pipeline)`, true);

    // profile.start(`GPU.${label} (Compute Full)`);
    await batchedDispatch({
        count: groups.pyramidBase.cellCount,
        label: label,
        bind,
        pipeline,
    });
    // await profile.end(`GPU.${label} (Compute Full)`, true);
}

export async function buildPyramidBatched(groups: BindGroups, label: string) {
    label = `Build ${label} HistoPyramid`;
    // profile.start(`GPU.${label} (Pipeline)`);
    const { device, pipeline } = await initPipeline(buildPyramidShader, label, [
        layouts.pyramidBase(),
        layouts.batchInfo(),
        layouts.pyramidLayerSettings(),
    ]);
    // await profile.end(`GPU.${label} (Pipeline)`, true);

    const { layers } = groups.pyramidBase;
    const settings = createPyramidSettingsBindGroups(groups.size);

    // profile.start(`GPU.${label} (Compute Full)`);

    const commandEncoder = device.createCommandEncoder();
    const ts = createTimestamps(commandEncoder, 0); // 1
    // ts.start(`GPU.${label} (Compute)`);

    for (let layer = layers - 1; layer > 0; --layer) {
        await batchedDispatch({
            label: `${label}, layer ${layer}`,
            count: 1 << (layer * 2),
            bind: (pass) => {
                pass.setBindGroup(0, groups.pyramidBase.bindGroup);
                pass.setBindGroup(1, groups.batchInfo.bindGroup);
                pass.setBindGroup(2, settings[layer]);
            },
            pipeline,
            commandEncoder,
        });
    }

    // ts.end();
    await ts.submit();

    // await profile.end(`GPU.${label} (Compute Full)`, true);
}

const createPyramidSettingsBindGroups = cachedBase(({ layerCount: layers }) => {
    let lowerStart = 0;

    let settingBindGroups = new Array(layers - 1) as GPUBindGroup[];
    for (let layer = layers - 1; layer > 0; --layer) {
        const upperDim = 1 << layer;

        const group = bindGroups.pyramidLayerSettings({ lowerStart, upperDim, layers, layer });

        if (layer != layers - 1) {
            lowerStart += upperDim * upperDim * 4;
        }

        settingBindGroups[layer] = group.bindGroup;
    }

    return settingBindGroups;
});

export async function filterSegmentsBatched(groups: BindGroups) {
    const label = `Filter`;
    // profile.start(`GPU.${label} (Pipeline)`);
    const { layout, bind } = bindGroups.prepare([
        groups.pyramidBase,
        groups.shapeInput,
        groups.batchInfo,
    ]);
    const { pipeline } = await initPipeline(filterSegmentsShader, label, layout);
    // await profile.end(`GPU.${label} (Pipeline)`, true);

    // profile.start(`GPU.${label} (Read Pyramid)`);
    const count = await groups.pyramidBase.readPyramid();
    // await profile.end(`GPU.${label} (Read Pyramid)`, true);

    // profile.start(`GPU.${label} (Update Thread Count)`);
    groups.pyramidBase.updateThreadCount(count);
    // await profile.end(`GPU.${label} (Update Thread Count)`, true);

    // profile.start(`GPU.${label} (Compute Full)`);
    await batchedDispatch({
        label,
        count,
        bind,
        pipeline,
    });
    // await profile.end(`GPU.${label} (Compute Full)`, true);
}

export async function buildNewShapesBatched(groups: BindGroups) {
    const label = `Build new shapes`;
    // profile.start(`GPU.${label} (Pipeline)`);

    if (!groups.shapeOutput) return;
    const count = groups.shapeOutput.count;

    const { layout, bind } = bindGroups.prepare([
        groups.pyramidBase,
        groups.shapeInput,
        groups.shapeOutput,
        groups.batchInfo,
    ]);

    const { pipeline } = await initPipeline(buildNewShapesFromPyramidShader, label, layout);
    // await profile.end(`GPU.${label} (Pipeline)`, true);

    groups.pyramidBase.updateThreadCount(count);

    // profile.start(`GPU.${label} (Compute Full)`);
    await batchedDispatch({
        label,
        count,
        bind,
        pipeline,
    });
    // await profile.end(`GPU.${label} (Compute Full)`, true);
}

export type ExtractedShapes = {
    info: { id: number; next: number }[];
    points: Vec2[];
};
export async function extractNewShapesBatched(
    groups: BindGroups,
    shapes: ExtractedShapes = { info: [], points: [] }
) {
    if (!groups.shapeOutput) return shapes;

    let { info, points } = shapes;
    const width = groups.pyramidBase.width;

    await groups.shapeOutput.read((shapeData, pointsData) => {
        for (let i = 0; i < shapeData.length / 2; ++i) {
            let x = pointsData[2 * i];
            let y = pointsData[2 * i + 1];
            points.push({ x, y });

            let id = shapeData[2 * i];
            let next = shapeData[2 * i + 1];
            info.push({ id, next });
        }
    });

    return { info, points } as ExtractedShapes;
}
