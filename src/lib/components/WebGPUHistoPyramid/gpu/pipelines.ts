import { getDevice } from "$util/gpuCommon";
import { preprocessWGSL } from "$webgpu/common/preprocess";

const pipelines: Record<string, GPUComputePipeline> = {};
export async function initPipeline(shader: string, label: string, layout?: GPUBindGroupLayout[]) {
    const device = await getDevice();
    if (pipelines[label]) {
        return {
            device,
            pipeline: pipelines[label],
        };
    }

    try {
        const module = device.createShaderModule({
            code: await preprocessWGSL(shader),
        });
        const descriptor: GPUComputePipelineDescriptor = {
            layout: layout ? device.createPipelineLayout({ bindGroupLayouts: layout }) : "auto",
            compute: {
                module,
                entryPoint: "main",
            },
        };
        const pipeline = await device.createComputePipelineAsync(descriptor);

        pipelines[label] = pipeline;

        return {
            device,
            pipeline,
        };
    } catch (e) {
        console.error(`Error @ pipelines.ts:pipeline[${label}]`);
        throw e;
    }
}
