<script lang="ts">
    import type { ProfilingGroup } from "components/Profiling.svelte";
    import { percentile } from "./graph";

    export let data: ProfilingGroup;
    console.log(structuredClone(data));

    const combineBatches = true;
    if (combineBatches) {
        let remappedData: Record<string, number[]> = {};

        data = data.filter(({ name }) => !name.startsWith("Batch"));

        let first = data.findIndex(({ name }) => name.match(/\[\d+\]$/));

        data = data.filter(({ name, data }) => {
            console.log(name);
            if (!name.match(/ \[\d+\]$/)) return true;

            name = name.replace(/ \[\d+\]$/, "");

            if (remappedData[name] === undefined) {
                remappedData[name] = data;
            } else {
                remappedData[name] = remappedData[name].zip(data).map(([a, b]) => a + b);
            }
            return false;
        });

        data.splice(
            first,
            0,
            ...Object.entries(remappedData).map(([name, data]) => ({ name, data }))
        );
    }

    console.log(data);

    export let min = 0;
    export let width = 100;
    export let layer = 0;

    function median(values: number[]) {
        return percentile(values, 50);
    }

    const total = data.reduce((acc, { data }) => acc + median(data), 0);

    const widths = data.map(({ data }) => (median(data) / total) * width);
    const start = data.map((_, i) => widths.slice(0, i).reduce((acc, w) => acc + w, 0));

    const colors = ["#d97706", "#65a30d", "#09bba0", "#0264c7", "#7c3aed", "#db2777", "#dc2626"];
</script>

<!----------------------------------------------------------------------------->

<div class="timeline">
    {#each data as { name, data: content, subData }, index}
        {@const s = min + start[index]}
        {@const w = widths[index]}

        <div class="result" style:flex-grow={w}>
            <div class="bar" style:background={colors[index % colors.length]}>
                <span>{name}</span>
            </div>

            <span class="time">{median(content).toFixed(1)}<span class="unit">ms</span></span>

            {#if subData}
                <div class="sub-data">
                    <svelte:self data={subData} min={s} width={w} layer={layer + 1} />
                </div>
            {/if}
        </div>
        <!-- <rect x={s} width={w} y={layer * 15} height="10" fill={colors[index]} /> -->
    {/each}
</div>

<!----------------------------------------------------------------------------->

<style>
    .timeline {
        display: flex;
        flex-direction: row;
        gap: 0.125em;
        line-height: 1;
    }

    .result {
        /* flex-basis: 1em; */
        /* border-radius: 0.5em; */
        display: flex;
        flex-direction: column;
        gap: 0.5em;
    }

    .bar {
        color: white;
        padding-inline: 0.125em;
        writing-mode: vertical-rl;
        transform: rotate(-180deg);
        height: 6em;
        text-rendering: geometricPrecision; /* optimizeLegibility */
        display: flex;
        flex-direction: column;
        place-items: center;
        text-align: center;
        border-radius: 0.05em;
        text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black;
    }
    .time {
        color: black;
        writing-mode: vertical-rl;
        transform: rotate(-180deg);
        height: 6ch;
        place-self: center;
        text-align: right;
        font-size: 0.75em;
    }

    .unit {
        color: #777;
    }

    .sub-data {
        padding-inline: 0.125em;
    }
</style>
