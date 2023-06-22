import holeInsideShapeShader from "./shaders/hole_inside_shape.wgsl?raw";
import holeInsideShapeReduceShader from "./shaders/hole_inside_shape_reduce.wgsl?raw";

import type { ShapesPackGPU, HolePointsPackGPU } from "./generateBuffers";
import { WORKGROUP_SIZE } from ".";

import { initPipeline } from "./pipelines";
import { createReadBuffer, getDevice, setBindGroup, setSettingsBindGroup } from "$util/gpuCommon";

export async function holesInsideShapes(
    shapePack: ShapesPackGPU,
    holePointsPack: HolePointsPackGPU
) {
    const device = await getDevice();

    const { commands: computeCmd, windingShapes } = await compute(shapePack, holePointsPack);

    const { commands: reduceCmd, outShape } = await reduce(windingShapes, holePointsPack);

    const commandEncoder = device.createCommandEncoder();

    const readBuffer = createReadBuffer(device, outShape);
    readBuffer.copy(commandEncoder);

    device.queue.submit([computeCmd, reduceCmd, commandEncoder.finish()]);

    const data = new Int32Array(await readBuffer.map());
    const array = [...data]; // TODO profile
    readBuffer.unmap();

    return array;
}

async function compute({ shapeInfoBuf, pointsBuf, maxX }: ShapesPackGPU, holes: HolePointsPackGPU) {
    const { device, pipeline } = await initPipeline(holeInsideShapeShader, "Hole inside shape");

    const lineCount = pointsBuf.size / 4 / 2;
    const matrixCount = lineCount * holes.count;

    const commands = device.createCommandEncoder();
    const pass = commands.beginComputePass();
    pass.setPipeline(pipeline);

    setSettingsBindGroup(pipeline, 0, pass, [{ f32: maxX }], "Settings");

    setBindGroup(pipeline, 1, pass, [shapeInfoBuf, pointsBuf, holes.buffer], "Input bind group");

    const windingShapes = device.createBuffer({
        label: "Out winding shape",
        size: matrixCount * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    setBindGroup(pipeline, 2, pass, [windingShapes], "Output bind group");

    pass.dispatchWorkgroups(Math.ceil(matrixCount / WORKGROUP_SIZE), 1, 1);
    pass.end();

    return {
        commands: commands.finish(),
        windingShapes,
    };
}

async function reduce(windingShapes: GPUBuffer, holes: HolePointsPackGPU) {
    const { device, pipeline } = await initPipeline(
        holeInsideShapeReduceShader,
        "Hole inside shape reduce"
    );

    const commands = device.createCommandEncoder();
    const pass = commands.beginComputePass();
    pass.setPipeline(pipeline);

    setBindGroup(pipeline, 0, pass, [windingShapes], "Input bind group");

    const outShape = device.createBuffer({
        label: "Out winding shape",
        size: holes.count * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    setBindGroup(pipeline, 1, pass, [outShape], "Output bind group");

    pass.dispatchWorkgroups(Math.ceil(holes.count / WORKGROUP_SIZE), 1, 1);
    pass.end();

    return {
        commands: commands.finish(),
        outShape,
    };
}
