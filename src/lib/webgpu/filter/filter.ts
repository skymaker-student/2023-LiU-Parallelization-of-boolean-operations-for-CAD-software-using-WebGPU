import {
    createBindGroup,
    createInputBuffer,
    createSettingsBuffer,
    getDevice,
} from "$util/gpuCommon";
import shader from "./filter.wgsl?raw";

export async function create() {
    const workgroupSize = 256;

    const device = await getDevice();
    const pyramidDescriptor: GPUComputePipelineDescriptor = {
        layout: "auto",
        compute: {
            module: device.createShaderModule({
                code: shader,
            }),
            entryPoint: "build",
            constants: {
                workgroup_size: workgroupSize,
            },
        },
    };
    const pyramidPipeline = await device.createComputePipelineAsync(pyramidDescriptor);

    async function filter() {
        const data = new Uint32Array(Array(10).keys());

        const count = data.length;

        console.group("GPU filter");
        console.time("create data");

        const dataBuffer = createInputBuffer(device, data, undefined, "Data Buffer");

        /// HISTOPYRAMID ///
        const pyramidBase = Math.pow(2, Math.ceil(Math.log2(Math.sqrt(count))));
        const pyramidLayers = Math.log2(pyramidBase);
        const pyramidElements = pyramidBase * (pyramidBase + pyramidBase / 2); // TODO not optimal, more can be trimmed
        const pyramidBuffer = createInputBuffer(
            device,
            data,
            GPUBufferUsage.STORAGE,
            "Pyramid Buffer"
        );

        const pyramidSettingsBuffer = createSettingsBuffer([{ u32: 0 }, { u32: pyramidLayers }]);

        const pyramidBindGroup = createBindGroup(
            pyramidPipeline,
            [pyramidSettingsBuffer, pyramidBuffer],
            "Pyramid Bind Group",
            0
        );

        console.timeEnd("create data");
        console.time("GPU");

        const commandEncoder = device.createCommandEncoder();

        /// BUILD HISTOPYRAMID ///
        console.time("Histogram Pyramid");

        var cpuSettingsBuffer = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });

        let computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(pyramidPipeline);
        computePass.setBindGroup(0, pyramidBindGroup);

        for (let i = 0; i < pyramidLayers; i++) {
            new Uint32Array(cpuSettingsBuffer.getMappedRange())[0] = i;
            commandEncoder.copyBufferToBuffer(cpuSettingsBuffer, 0, pyramidSettingsBuffer, 0, 4);
            computePass.dispatchWorkgroups(32);
        }

        cpuSettingsBuffer.unmap();
        console.timeEnd("Histogram Pyramid");

        device.queue.submit([commandEncoder.finish()]);

        console.timeEnd("GPU");
        console.groupEnd();
    }

    return { filter };
}
