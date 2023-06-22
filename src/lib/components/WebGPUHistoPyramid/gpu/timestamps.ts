import { profile } from "$components/Timing.svelte";
import { createReadBuffer, getCachedDevice } from "$util/gpuCommon";

export type Timestamps = ReturnType<typeof createTimestamps>;
export function createTimestamps(encoder: GPUCommandEncoder, count: number = 1) {
    const device = getCachedDevice();
    const enabled = device.features.has("timestamp-query");
    if (!enabled) {
        return {
            start: () => {},
            end: () => {},
            submit: async () => {
                device.queue.submit([encoder.finish()]);
            },
        };
    }

    const queryBuffer =
        count > 0 &&
        device.createBuffer({
            size: count * 2 * 8,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        });

    const querySet = device.createQuerySet({
        type: "timestamp",
        count: count * 2,
    });

    let names: string[] = [];

    let i = 0;
    function start(name: string) {
        names.push(name);
        encoder.writeTimestamp(querySet, i++);
    }

    function end() {
        encoder.writeTimestamp(querySet, i++);
    }

    async function submit() {
        let readBuffer;
        if (count > 0) {
            encoder.resolveQuerySet(
                querySet,
                0, // First query to write
                count * 2, // Number of queries to count
                queryBuffer,
                0 // Buffer offset
            );

            readBuffer = createReadBuffer(device, queryBuffer, "Timestamps");
            readBuffer.copy(encoder);
        }

        // submit
        device.queue.submit([encoder.finish()]);
        const results = [];

        if (count > 0) {
            const timestamps = new BigUint64Array(await readBuffer.map());

            for (let i = 0; i < count; ++i) {
                const start = timestamps[i * 2];
                const end = timestamps[i * 2 + 1];
                const duration = end - start;

                const ms = Number(duration) / 1_000_000;
                results.push({ name: names[i], ms, duration });
            }
            readBuffer.unmap();

            results.forEach((result) => {
                profile.set(result.name, result.ms);
            });
        }

        return results;
    }

    return {
        start,
        end,
        submit,
    };
}

export async function createTimestampEncoder(
    label: string,
    fn: (encoder: GPUCommandEncoder) => Promise<void> | void
) {
    const device = getCachedDevice();
    const encoder = device.createCommandEncoder();
    const ts = createTimestamps(encoder);
    ts.start(label);
    await fn(encoder);
    ts.end();
    await ts.submit();
}
