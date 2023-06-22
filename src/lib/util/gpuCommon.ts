import { setMultiTypeBuffer, type BufferData, multiTypeBuffer } from "./arrayBuffer";

let globalDevice: GPUDevice | null = null;

let lock: Promise<void>;
export async function getDevice() {
    if (lock) await lock;
    if (globalDevice) return globalDevice;
    let resolve: () => void = () => {};
    lock = new Promise((res) => {
        resolve = res;
    });

    if (!navigator.gpu) throw new Error("WebGPU is not supported");
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
        // forceFallbackAdapter: true,
    });
    if (!adapter) throw new Error("No Adapter Found");
    const info = await adapter.requestAdapterInfo();
    console.log(info);

    let device: GPUDevice;
    try {
        device = await adapter.requestDevice({
            requiredLimits: {
                maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize,
                maxBufferSize: adapter.limits.maxBufferSize,
                maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            },
            requiredFeatures: ["timestamp-query"],
        });
    } catch (e) {
        console.warn(
            "Timestamp query not supported, disabling. To enable, launch chrome with '--disable-dawn-features=disallow_unsafe_apis'"
        );

        device = await adapter.requestDevice({
            requiredLimits: {
                maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize,
                maxBufferSize: adapter.limits.maxBufferSize,
                maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            },
        });
    }

    globalDevice = device;
    resolve();
    return device;
}

export function getCachedDevice() {
    if (!globalDevice) throw new Error("No device found");
    return globalDevice;
}

export function createInputBuffer(
    device: GPUDevice,
    data: Uint32Array | Float32Array | ArrayBuffer,
    usage: GPUFlagsConstant = GPUBufferUsage.STORAGE,
    label = "Input Buffer"
) {
    const inputBuffer = device.createBuffer({
        label,
        size: data.byteLength,
        usage: usage,
        mappedAtCreation: true,
    });
    if (data instanceof Float32Array) {
        const bufferData = new Float32Array(inputBuffer.getMappedRange());
        bufferData.set(data);
    } else if (data instanceof Uint32Array) {
        const bufferData = new Uint32Array(inputBuffer.getMappedRange());
        bufferData.set(data);
    } else {
        const bufferData = new Uint32Array(inputBuffer.getMappedRange());
        bufferData.set(new Uint32Array(data));
    }
    inputBuffer.unmap();

    return inputBuffer;
}

export function createOutputBuffer(
    device: GPUDevice,
    size: number,
    usage: GPUFlagsConstant = GPUBufferUsage.STORAGE,
    label = "Output Buffer"
) {
    return device.createBuffer({
        label,
        size: size,
        usage: usage | GPUBufferUsage.COPY_SRC,
    });
}

export function createBindGroup(
    pipeline: GPUComputePipeline,
    buffers: GPUBuffer[],
    label: string,
    bindGroupIndex: number
) {
    label = `${label} [${bindGroupIndex}]`;
    const device = getCachedDevice();
    const bufferEntries = buffers.map((buffer, index) => {
        return {
            binding: index,
            resource: {
                buffer: buffer,
            },
        };
    });
    return device.createBindGroup({
        label,
        layout: pipeline.getBindGroupLayout(bindGroupIndex),
        entries: bufferEntries,
    });
}

export function setBindGroup(
    pipeline: GPUComputePipeline,
    bindGroupIndex = 0,
    computePass: GPUComputePassEncoder,
    buffers: GPUBuffer[],
    label = "Bind Group"
) {
    const bindGroup = createBindGroup(pipeline, buffers, label, bindGroupIndex);
    computePass.setBindGroup(bindGroupIndex, bindGroup);
    return bindGroup;
}

export function createReadBuffer(device: GPUDevice, buffer: GPUBuffer, label = "Read Buffer") {
    const readBuffer = device.createBuffer({
        label,
        size: buffer.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    function copy(encoder: GPUCommandEncoder) {
        encoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, buffer.size);
    }

    async function map(
        offset: number | undefined = undefined,
        size: number | undefined = undefined
    ) {
        await readBuffer.mapAsync(GPUMapMode.READ);
        return readBuffer.getMappedRange(offset, size);
    }

    function unmap() {
        readBuffer.unmap();
    }

    return {
        buffer: readBuffer,
        copy,
        map,
        unmap,
    };
}

export function createSettingsBuffer(
    data: BufferData[],
    label: string = "Settings Buffer",
    usage = GPUBufferUsage.UNIFORM
) {
    const device = getCachedDevice();
    const settingsBuffer = device.createBuffer({
        label,
        size: data.length * 4,
        usage,
        mappedAtCreation: true,
    });
    const bufferData = new Uint32Array(settingsBuffer.getMappedRange());
    bufferData.set(new Uint32Array(multiTypeBuffer(data)));
    settingsBuffer.unmap();

    return settingsBuffer;
}

export function createSettingsBindGroup(
    pipeline: GPUComputePipeline,
    bindGroupIndex: number,
    data: BufferData[],
    label: string = "Settings"
) {
    const settingsBuffer = createSettingsBuffer(data, label);
    return createBindGroup(pipeline, [settingsBuffer], label, bindGroupIndex);
}

export function setSettingsBindGroup(
    pipeline: GPUComputePipeline,
    bindGroupIndex: number,
    pass: GPUComputePassEncoder,
    data: BufferData[],
    label: string = "Settings"
) {
    const settingsBuffer = createSettingsBuffer(data, label);
    return setBindGroup(pipeline, bindGroupIndex, pass, [settingsBuffer], label);
}
