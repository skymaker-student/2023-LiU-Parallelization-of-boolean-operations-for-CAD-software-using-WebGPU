// check webgpu support
export async function checkWebGPU() {
    let result = [];
    if (!navigator.gpu) throw new Error("Not support WebGPU");
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
        // forceFallbackAdapter: true,
    });
    if (!adapter) throw new Error("No adapter found");
    console.log(adapter);
    const info = await adapter.requestAdapterInfo();
    console.log(info);
    adapter.features.forEach((value) => {
        console.log(value);
    });
    let i: keyof GPUSupportedLimits;
    for (i in adapter.limits) result.push(`${i}:${adapter.limits[i]}`);
    return result;
}
