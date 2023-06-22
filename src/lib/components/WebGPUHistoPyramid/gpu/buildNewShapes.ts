import buildNewShapesFromPyramidShader from "./shaders/build_new_shapes_from_pyramid.wgsl?raw";

import type { HistoPyramidGPU, NewShapesPackGPU, ShapesPackGPU } from "./generateBuffers";
import { initPipeline } from "./pipelines";
import { createBindGroup, createSettingsBindGroup } from "$util/gpuCommon";
import { batch } from "./batch";

// TODO: Implement Operations other than Intersect
export async function buildNewShapesFromPyramid(
    pyramid: HistoPyramidGPU,
    { shapeInfoBuf, pointsBuf, lineCount }: ShapesPackGPU,
    { newShapeInfoBuf, newPointsBuf, newLineCount }: NewShapesPackGPU
) {
    const { device, pipeline } = await initPipeline(
        buildNewShapesFromPyramidShader,
        "Build new shapes"
    );
    const threadCount = newLineCount;
    const commandEncoder = device.createCommandEncoder();
    // const computePass = commandEncoder.beginComputePass({
    //     label: "Build new shapes",
    // });
    // computePass.setPipeline(pipeline);

    const settingsBindGroup = createSettingsBindGroup(
        pipeline,
        0,
        [
            { u32: pyramid.base.width },
            { u32: threadCount },
            { u32: lineCount },
            { u32: pyramid.layers },
        ],
        "Build new shapes: Settings Group"
    );
    const pyramidBindGroup = createBindGroup(
        pipeline,
        [pyramid.top, pyramid.middle],
        "Build new shapes: Pyramid Group",
        1
    );
    const shapeInfoBindGroup = createBindGroup(
        pipeline,
        [shapeInfoBuf, pointsBuf],
        "Build new shapes: Old Shapes Group",
        2
    );
    const outInfoBindGroup = createBindGroup(
        pipeline,
        [newShapeInfoBuf, newPointsBuf],
        "Build new shapes: New Shapes Group",
        3
    );

    await batch({
        label: "Build new shapes",
        count: threadCount,
        batchBindIndex: 4,
        bind: (pass) => {
            pass.setBindGroup(0, settingsBindGroup);
            pass.setBindGroup(1, pyramidBindGroup);
            pass.setBindGroup(2, shapeInfoBindGroup);
            pass.setBindGroup(3, outInfoBindGroup);
        },
        commandEncoder,
        pipeline,
    });

    // setBindGroup(pipeline, 3, computePass, [settingsBuf], "Build new shapes: Settings Group");

    // computePass.dispatchWorkgroups(Math.ceil(threadCount / WORKGROUP_SIZE));
    // computePass.end();

    // device.queue.submit([commandEncoder.finish()]);
}
