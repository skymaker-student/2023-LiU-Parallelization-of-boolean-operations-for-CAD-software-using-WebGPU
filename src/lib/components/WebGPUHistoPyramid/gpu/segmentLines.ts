import segmentLinesShader from "./shaders/segment_lines.wgsl?raw";

import type { ShapesPackGPU, HistoPyramidGPU } from "./generateBuffers";
import { initPipeline } from "./pipelines";
import { batch } from "./batch";
import { createTimestamps } from "./timestamps";
import { createSettingsBuffer } from "$util/gpuCommon";

export async function segmentLines(
    { shapeInfoBuf, pointsBuf, lineCount }: ShapesPackGPU,
    pyramid: HistoPyramidGPU,
    writeSelf = true
) {
    const { device, pipeline } = await initPipeline(segmentLinesShader, "Segment lines");

    // Perhaps, this should be moved generateBuffers.ts.
    const settingsBuf = createSettingsBuffer(
        [{ u32: pyramid.base.width }, { u32: lineCount }, { i32: writeSelf ? 1 : 0 }],
        "Settings: Process lines from points"
    );

    const bufferEntries = [settingsBuf, shapeInfoBuf, pointsBuf, pyramid.base.anglesValues].map(
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
        label: "Process lines from points",
        layout: pipeline.getBindGroupLayout(0),
        entries: bufferEntries,
    });

    const commandEncoder = device.createCommandEncoder();
    const ts = createTimestamps(commandEncoder, 1);

    ts.start("Segment lines");

    await batch({
        label: "Segment lines",
        count: lineCount * lineCount,
        batchBindIndex: 1,
        bind: (pass) => {
            pass.setBindGroup(0, bindGroup);
        },
        pipeline,
        commandEncoder,
    });

    ts.end();
    await ts.submit();
}
