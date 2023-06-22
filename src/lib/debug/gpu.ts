import { createReadBuffer, getDevice } from "$util/gpuCommon";

export async function debugBuffer(
    buffer: GPUBuffer,
    type: "u32" | "i32" | "f32" = "i32",
    start = 0,
    end = buffer.size / 4,
    { print = true } = {}
) {
    const device = await getDevice();
    const readBuffer = createReadBuffer(device, buffer);

    const encoder = device.createCommandEncoder();
    readBuffer.copy(encoder);

    device.queue.submit([encoder.finish()]);
    let result: number[];

    let data = await readBuffer.map(start * 4, (end - start) * 4);

    switch (type) {
        case "u32":
            result = [...new Uint32Array(data)];
            break;
        case "i32":
            result = [...new Int32Array(data)];
            break;
        case "f32":
            result = [...new Float32Array(data)];
            break;
        default:
            throw new Error("Invalid type");
    }

    readBuffer.unmap();

    print && console.log(result);

    return result;
}
