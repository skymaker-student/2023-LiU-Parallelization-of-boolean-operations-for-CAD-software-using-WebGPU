<script context="module" lang="ts">
    export const options = {};
</script>

<script lang="ts">
    import type { Benchmark } from "routes/halftime/Benchmarks.svelte";

    import { get } from "svelte/store";

    import { createContext, percentile, type GraphContext } from "./graph";
    import type { NumberOption, Option, SelectOption } from "./Graph.svelte";
    import Grid from "./Grid.svelte";

    export let benchmark: Benchmark;
    export let options: Option[];
    export let comparison: Benchmark[];

    export let units = { x: "Time [ms]", y: "Frequency [Time Span Occurences]" };

    const yStep = options[0] as NumberOption;
    const barCount = Math.max(get((options[1] as NumberOption).value), 1) + 1;
    const shapeCount = options[2] as SelectOption;
    const labelRotation = get((options[3] as NumberOption).value);

    shapeCount.options = benchmark.data.map((result) => ({
        name: result.x.toString(),
        value: result.x.toString(),
    }));

    const data =
        benchmark.data.find((result) => result.x === +get(shapeCount.value)) ?? benchmark.data[0];

    const { data: values } = data;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const interval = max - min;
    const step = interval / (barCount - 1);

    const freqTable = new Array(barCount).fill(0);

    function xToIndex(x: number) {
        let index = Math.floor((x - min) / step);
        if (index === freqTable.length - 1) index = freqTable.length - 2;
        return index;
    }

    for (const value of values) {
        let index = xToIndex(value);
        freqTable[index]++;
    }

    const newContext = createContext(
        {
            name: "",
            data: freqTable.map((value, index) => ({
                x: min + index * step,
                data: [value],
            })),
        },
        60,
        {
            axes: {
                x: {
                    mode: "linear",
                    rotation: -labelRotation,
                },
                y: {
                    mode: "linear",
                    step: get(yStep.value),
                },
            },
        }
    );

    const newData = newContext.data;

    const p = (p: number) => percentile(data.data, p);

    const median = p(50);
    const labels = {
        x: [
            { value: p(0), label: "Min" },
            { value: p(25), label: "Q1" },
            { value: median, label: "Median" },
            { value: p(75), label: "Q3" },
            { value: p(100), label: "Max" },
        ],
    };

    const legend = {
        x: 75,
        y: 5,
        width: 25,
        height: 17.5,
    };
</script>

<!----------------------------------------------------------------------------->

<Grid context={newContext} {units} {labels} />

{#each { length: newData.length - 1 } as _, i}
    {@const x1 = newContext.mapX(newData[i].x)}
    {@const x2 = newContext.mapX(newData[i + 1].x)}

    {@const y = newContext.mapY(newData[i].median)}

    <rect class="bar" x={x1} {y} height={newContext.mapY(0) - y} width={x2 - x1} fill="black" />
{/each}

{#each labels.x as { value }}
    <!-- lines for labels -->
    <line
        class="median"
        x1={newContext.mapX(value)}
        x2={newContext.mapX(value)}
        y1={newContext.mapY(0)}
        y2={newContext.mapY(freqTable[xToIndex(value)]) - 0.0125}
    />
{/each}

<g>
    <rect
        class="legend-background"
        x={legend.x}
        y={legend.y}
        width={legend.width}
        height={legend.height}
        fill="white"
        rx="0.025em"
    />
    <foreignObject x={legend.x} y={legend.y} width={legend.width} height={legend.height}>
        <!--
          In the context of SVG embedded in an HTML document, the XHTML
          namespace could be omitted, but it is mandatory in the
          context of an SVG document
        -->
        <div class="legend">
            {#each labels.x as { value, label }}
                <span>{label}:</span>
                <span>{value.toFixed(2)}ms</span>
            {/each}
        </div>
    </foreignObject>
</g>

<!----------------------------------------------------------------------------->
<style>
    .bar {
        stroke: #0264c7;
        stroke-width: 0.0125em;
        stroke-linejoin: bevel;
        fill: none;
    }

    .median {
        stroke-width: 0.025em;
        stroke: black;
    }

    foreignObject {
        font-size: 0.125em;
        line-height: 1.5em;
        stroke: black;
    }

    .legend-background {
        fill: white;
        stroke: black;
        stroke-width: 0.0125em;
    }

    .legend {
        padding: 1em;
        display: grid;
        grid-template-columns: max-content 1fr;
        column-gap: 1em;
    }

    .legend *:nth-child(odd) {
        text-align: right;
    }
</style>
