import filterInsideSegmentsShader from "./shaders/filter_segments.wgsl?raw";

import { type ShapesPackGPU, type HistoPyramidGPU, readTopBuffer } from "./generateBuffers";
import { initPipeline } from "./pipelines";
import {
    createBindGroup,
    createSettingsBindGroup,
} from "$util/gpuCommon";
import { createTimestamps } from "./timestamps";
import { batch } from "./batch";

export async function filterSegments(
    { shapeInfoBuf, pointsBuf, minX, maxX, minY, maxY, lineCount }: ShapesPackGPU,
    pyramid: HistoPyramidGPU
) {
    const { device, pipeline } = await initPipeline(filterInsideSegmentsShader, "Filter segments");
    const threadCount = await readTopBuffer(pyramid.top);
    const commandEncoder = device.createCommandEncoder();
    const ts = createTimestamps(commandEncoder, 1);

    ts.start("Filter");
    const settingsBindGroup = createSettingsBindGroup(
        pipeline,
        0,
        [
            { u32: pyramid.base.width },
            { u32: threadCount },
            { u32: lineCount },
            { u32: pyramid.layers },
            { f32: minX },
            { f32: maxX },
            { f32: minY },
            { f32: maxY },
        ],
        "Settings: Filter segments"
    );

    const bindGroup = createBindGroup(
        pipeline,
        [shapeInfoBuf, pointsBuf, pyramid.top, pyramid.middle],
        "Filter inside segments",
        1
    );

    await batch({
        label: "Filter inside segments",
        count: lineCount * lineCount,
        batchBindIndex: 3,
        bind: (pass) => {
            pass.setBindGroup(0, settingsBindGroup);
            pass.setBindGroup(1, bindGroup);
        },
        pipeline,
        commandEncoder,
    });

    ts.end();
    await ts.submit();
}
