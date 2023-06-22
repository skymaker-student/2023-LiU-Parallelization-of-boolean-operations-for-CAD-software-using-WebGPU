<script lang="ts">
    import type { Benchmark } from "routes/halftime/Benchmarks.svelte";
    import { createContext, type GraphContext, type Mode } from "./graph";
    import BoxWhiskers from "./BoxWhiskers.svelte";
    import Grid from "./Grid.svelte";
    import type { NumberOption, Option, SelectOption } from "./Graph.svelte";
    import { get } from "svelte/store";

    export let benchmark: Benchmark;
    export let options: Option[];
    export let comparison: Benchmark[];

    const yStep = options[0] as NumberOption;
    const xAxisMode = get((options[1] as SelectOption).value) as Mode;
    const yAxisMode = get((options[2] as SelectOption).value) as Mode;

    let context = createContext(benchmark, 60, {
        axes: {
            x: {
                mode: xAxisMode,
            },
            y: {
                mode: yAxisMode,
                step: get(yStep.value),
            },
        },
    });
    const { data } = context;

    export let units = { x: "Line count", y: "Time [ms]" };
</script>

<!----------------------------------------------------------------------------->

<Grid {context} {units} />

{#each data as result}
    <BoxWhiskers data={result} {context} />
{/each}

<!----------------------------------------------------------------------------->
<style>
</style>
