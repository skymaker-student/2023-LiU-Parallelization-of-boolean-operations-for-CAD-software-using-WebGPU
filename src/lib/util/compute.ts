import {
    createBindGroup,
    createInputBuffer,
    createOutputBuffer,
    createReadBuffer,
    getDevice,
} from "./gpuCommon";

export async function compute(shader: string, entry: string = "main") {
    const device = await getDevice();

    const descriptor: GPUComputePipelineDescriptor = {
        layout: "auto",
        compute: {
            module: device.createShaderModule({
                code: shader,
            }),
            entryPoint: entry,
        },
    };
    const pipeline = await device.createComputePipelineAsync(descriptor);

    const buffers: GPUBuffer[] = [];
    type OutputBuffer = {
        buffer: GPUBuffer;
        copyToReadBuffer: (encoder: GPUCommandEncoder) => void;
        mapReadBuffer: () => Promise<ArrayBuffer>;
        unmapReadBuffer: () => void;
        copyArrayBuffer: ArrayBuffer;
    };

    const outputBuffers: OutputBuffer[] = [];

    let stage = "buffer";
    const bufferStage = {
        createInputBuffer: cib,
        createOutputBuffer: cob,
        build,
    } as const;
    type BufferStage = typeof bufferStage;

    const processState = {
        process,
    } as const;
    type ProcessStage = typeof processState;

    const stageContainer = { stage: bufferStage as any };
    const stageProxy = new Proxy(stageContainer, {
        get(target, property, receiver) {
            return target.stage[property];
        },
    });

    function cib(data: ArrayBuffer, usage: GPUFlagsConstant = GPUBufferUsage.STORAGE) {
        if (stage !== "buffer") throw new Error("Cannot modify buffers after building");

        const buffer = createInputBuffer(device, data, usage);
        buffers.push(buffer);
        return bufferStage;
    }

    function cob(size: number, usage: GPUFlagsConstant = GPUBufferUsage.STORAGE) {
        if (stage !== "buffer") throw new Error("Cannot modify buffers after building");

        const buffer = createOutputBuffer(device, size, usage);
        buffers.push(buffer);
        outputBuffers.push({ buffer } as OutputBuffer);
        return bufferStage;
    }

    const defaultProcessOptions = {
        workergroupSize: 64,
        iterations: 1,
    };

    let bindGroup: GPUBindGroup;
    function build() {
        if (stage !== "buffer") throw new Error("Cannot modify buffers after building");
        stage = "process";
        stageContainer.stage = processState;

        bindGroup = createBindGroup(pipeline, buffers);

        for (const ob of outputBuffers) {
            const { buffer } = ob;

            const {
                copy: copyToReadBuffer,
                map: mapReadBuffer,
                unmap: unmapReadBuffer,
            } = createReadBuffer(device, buffer);

            ob.copyToReadBuffer = copyToReadBuffer;
            ob.mapReadBuffer = mapReadBuffer;
            ob.unmapReadBuffer = unmapReadBuffer;
        }

        return stageProxy as any as ProcessStage;
    }

    type ProcessOptions = Partial<typeof defaultProcessOptions>;
    async function process(invocations: number, options: ProcessOptions = {}) {
        const { workergroupSize, iterations } = { ...defaultProcessOptions, ...options };

        const commandEncoder = device.createCommandEncoder();

        for (let i = 0; i < iterations; i++) {
            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(pipeline);
            computePass.setBindGroup(0, bindGroup);
            computePass.dispatchWorkgroups(Math.ceil(invocations / workergroupSize));
            computePass.end();
        }

        outputBuffers.forEach((ob) => ob.copyToReadBuffer(commandEncoder));
        device.queue.submit([commandEncoder.finish()]);

        let start = performance.now();

        await Promise.all(
            outputBuffers.map(async (ob) => {
                ob.copyArrayBuffer = await ob.mapReadBuffer();
            })
        );

        let duration = ((performance.now() - start) / iterations).toFixed(2);

        const result = outputBuffers.map((ob) => new Float32Array(ob.copyArrayBuffer));

        return {
            result: {
                copy() {
                    return result.map((r) => {
                        const copy = new Float32Array(r.length);
                        copy.set(r);
                        return copy;
                    });
                },
                data: result,
                unmap: () => {
                    outputBuffers.forEach((ob) => ob.unmapReadBuffer());
                },
            },
            duration,
        };
    }

    return stageProxy as any as BufferStage;
}
