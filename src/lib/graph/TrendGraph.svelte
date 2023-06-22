<script context="module" lang="ts">
    export const options = {};

    const colorMap = {
        "Union [CPU]": "#d97706",
        "Union [GPU Accelerated]": "#0264c7",
        "Union [GPU HistoPyramid]": "#65a30d",
        "Union [CPU Polygon Clipping]": "#dc2626",
    } as Record<string, string>;

    const colorList = ["#d97706", "#65a30d", "#09bba0", "#0264c7", "#7c3aed", "#db2777", "#dc2626"];

    export function color(name: string, index: number) {
        return colorMap[name] ?? colorList[index];
    }
</script>

<script lang="ts">
    import type { Benchmark } from "routes/halftime/Benchmarks.svelte";
    import { get } from "svelte/store";
    import { createCombinedContext, type Mode } from "./graph";
    import type { BooleanOption, NumberOption, Option, SelectOption } from "./Graph.svelte";
    import Grid from "./Grid.svelte";
    import Trend from "./Trend.svelte";

    export let benchmark: Benchmark;
    export let options: Option[];
    export let comparison: Benchmark[];

    const benchmarks = [benchmark, ...comparison];

    const yStep = options[0] as NumberOption;
    const xAxisMode = get((options[1] as SelectOption).value) as Mode;
    const yAxisMode = get((options[2] as SelectOption).value) as Mode;

    const fixedYHeight = get((options[3] as NumberOption).value);

    const show = {
        50: get((options[4] as BooleanOption).value),
        95: get((options[5] as BooleanOption).value),
    };

    const intervals = [] as { min: number; max: number; fill: number }[];
    if (show[50]) intervals.push({ min: 25, max: 75, fill: 0.6 });
    if (show[95]) intervals.push({ min: 2.5, max: 97.5, fill: 0.3 });

    let context = createCombinedContext(benchmarks, 60, {
        axes: {
            x: {
                mode: xAxisMode,
            },
            y: {
                mode: yAxisMode,
                step: get(yStep.value),
                height: fixedYHeight > 0 ? fixedYHeight : undefined,
            },
        },
    });


    export let units = { x: benchmark.axisLabelX ?? "Line count", y: "Time [ms]" };
</script>

<!----------------------------------------------------------------------------->
<Grid {context} {units} />

{#each benchmarks as benchmark, index}
    <Trend {benchmark} {context} {intervals} color={color(benchmark.name, index)} />
{/each}

<!----------------------------------------------------------------------------->
<style>
</style>
