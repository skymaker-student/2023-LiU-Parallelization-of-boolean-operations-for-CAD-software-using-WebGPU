<script lang="ts">
    import type { Benchmark } from "routes/halftime/Benchmarks.svelte";
    import type { GraphType } from "./Graph.svelte";
    import { color } from "./TrendGraph.svelte";

    export let benchmarks: Benchmark[] = [];
    export let info: Record<string, string>;
    export let type: GraphType | undefined = undefined;

    const hardware = {
        CPU: info["CPU"],
        GPU: info["GPU"],
        RAM: info["RAM"],
        OS: info["OS"],
    };

    const runInfo = {
        Iterations: info["Iterations"],
        "Warm-up": info["Warm-up"],
        Seed: info["Seed"],
        Density: info["Density"],
    };

    const other = {
        "Normalize input": info["Normalize input"],
        "Rescale factor": info["Rescale factor"],
        "Maximum vertices": info["Maximum vertices"],
        "Maximize vertices": info["Maximize vertices"],
    };

    const displayInfo = [Object.entries(hardware), Object.entries(runInfo), Object.entries(other)];
</script>

<!----------------------------------------------------------------------------->

<div class="wrapper">
    {#if type === "trend"}
        <div class="legend">
            {#each benchmarks as benchmark, index}
                <div class="item">
                    <div class="color" style:background={color(benchmark.name, index)} />
                    <div class="name">{benchmark.name}</div>
                </div>
            {/each}
        </div>
    {/if}

    <div class="info">
        {#each displayInfo as column}
            <div class="column">
                {#each column as [name, value]}
                    <div class="name">{name}</div>
                    <div class="value">{value}</div>
                {/each}
            </div>
        {/each}
    </div>
</div>

<!----------------------------------------------------------------------------->

<style>
    .wrapper {
        display: grid;
        grid-auto-flow: column;
        gap: 4em;
        padding: 1em;
        place-content: center;
        font-size: 1.5vw;
        margin-top: 1em;
    }

    .legend {
        width: max-content;
        display: flex;
        flex-direction: column;
        gap: 0.75em;
    }

    .legend .item {
        display: flex;
        flex-direction: row;
        gap: 0.5em;
    }

    .legend .color {
        width: 1em;
        height: 1em;
        border-radius: 2px;
    }

    .legend .name {
        line-height: 1;
        font-size: 1em;
    }

    .info {
        display: grid;
        grid-auto-flow: column;
        gap: 3em;
        line-height: 1;
    }

    .info .column {
        display: grid;
        grid-template-columns: max-content max-content;
        gap: 0.75em;
    }
</style>
