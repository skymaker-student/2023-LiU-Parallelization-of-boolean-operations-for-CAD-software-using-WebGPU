<script lang="ts">
    import { updateNodes } from "$debug/visual";
    import Graph, { types, type GraphType, type Option } from "$graph/Graph.svelte";
    import { writableLocalStorage } from "$util/localStorageStore";
    import { get } from "svelte/store";
    import benchmarksJSON from "../assets/benchmarks?array!json";
    import type { Benchmark, FullBenchmark, Mode } from "../routes/halftime/Benchmarks.svelte";

    const fullBenchmarks: (FullBenchmark & { lineCountFactor?: number })[] = benchmarksJSON;

    // This is a hack to handle Random Grid Generation cases!
    fullBenchmarks.forEach((fb) => {
        fb.benchmarks.forEach((b) => {
            b.data.forEach((d) => {
                d.x *= fb.lineCountFactor ?? 1;
            });
        });
    });

    const selectedJSON = writableLocalStorage<number>("selectedJSON", 0) ?? 0;
    const selected = writableLocalStorage<number>("selectedBenchmark", 0) ?? 0;

    if ($selectedJSON >= fullBenchmarks.length) selectedJSON.set(0);

    $: $selectedJSON, update();
    function update() {
        selected.set(0);
    }

    $: benchmarks = fullBenchmarks[Math.min(Math.max(0, +$selectedJSON), fullBenchmarks.length)];
    $: benchmark =
        benchmarks.benchmarks[Math.min(Math.max(0, +$selected), benchmarks.benchmarks.length)];

    const type = writableLocalStorage<GraphType>("graphType", "box");

    let fullscreen = false;
    let graphOptions: Option[] = [];

    let otherBenchmarks = [] as Benchmark[];
    let activeComparison = [] as boolean[];
    $: comparison = otherBenchmarks.filter((_, i) => activeComparison[i]);

    $: benchmark, changeBenchmark();
    function changeBenchmark() {
        otherBenchmarks = benchmarks.benchmarks.filter((b) => b !== benchmark);
        activeComparison = new Array(otherBenchmarks.length).fill(true);
        comparison = otherBenchmarks.filter((_, i) => activeComparison[i]);
    }
</script>

<!----------------------------------------------------------------------------->

<svelte:body
    on:keydown={(e) => {
        if (e.key === "g") {
            fullscreen = !fullscreen;
            toggleNav();
            e.preventDefault();
        }
    }}
/>

<div class:fullscreen>
    <div class="configuration">
        <div class="graph-options">
            <label>
                Graph Type
                <select bind:value={$type}>
                    {#each Object.keys(types) as type}
                        <option value={type}>{type}</option>
                    {/each}
                </select>
            </label>

            <label class="collection">
                Benchmark Collection
                <select bind:value={$selectedJSON}>
                    {#each fullBenchmarks as benchmark, i}
                        <option value={i}>{benchmark.name}</option>
                    {/each}
                </select>
            </label>

            <label class="benchmark">
                Benchmark
                <select bind:value={$selected}>
                    {#each benchmarks.benchmarks as benchmark, i}
                        <option value={i}>{benchmark.name}</option>
                    {/each}
                </select>
            </label>
        </div>

        <div class="options">
            {#each graphOptions as option}
                {@const { name, type, value } = option}
                <label>
                    {name}
                    {#if type === "number"}
                        <input
                            type="number"
                            value={get(value)}
                            on:input={(e) => {
                                value.set(+e.target.value);
                            }}
                        />
                    {:else if type === "boolean"}
                        <input
                            type="checkbox"
                            checked={get(value)}
                            on:change={(e) => {
                                value.set(e.target.checked);
                            }}
                        />
                    {:else if type === "select"}
                        <select
                            value={get(value)}
                            on:change={(e) => {
                                value.set(e.target.value);
                            }}
                        >
                            {#each option.options as opt}
                                <option value={opt.value}>{opt.name}</option>
                            {/each}
                        </select>
                    {/if}
                </label>
            {/each}

            <label>
                Comparison
                <div class="check-select">
                    <span>{comparison.length} selected</span>
                    <div class="dropdown">
                        {#each otherBenchmarks as compare, index}
                            <label>
                                <input type="checkbox" bind:checked={activeComparison[index]} />
                                {compare.name}
                            </label>
                        {/each}
                    </div>
                </div>
            </label>
        </div>
    </div>

    {#key benchmark}
        {#key comparison}
            <div class="graphs">
                <Graph
                    {benchmark}
                    {comparison}
                    info={benchmarks.info ?? {}}
                    type={$type}
                    renderGrid={true}
                    bind:graphOptions
                />
                <!-- <Graph
                    benchmark={benchmarks.benchmarks[4]}
                    type={$type}
                    {options}
                    renderGrid={false}
                /> -->
            </div>
        {/key}
    {/key}
</div>

<!----------------------------------------------------------------------------->
<style>
    div {
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        background: white;
        color: #333;
        color-scheme: light;
    }

    .configuration {
        padding-inline: 2em;
        width: 100%;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: max-content max-content;
        height: max-content;
    }

    .options {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 1em;
        height: max-content;
    }

    .fullscreen .configuration {
        height: 0;
        display: none;
    }

    label {
        display: flex;
        flex-direction: column;
    }

    select {
        font-size: 1em;
    }

    input[type="number"] {
        min-width: 2em;
        width: 6em;
    }

    .graph-options {
        display: grid;
        grid-template-columns: max-content 3fr 1fr;
        gap: 1em;
    }

    .collection {
        flex-basis: 1em;
        min-width: 1em;
        flex-grow: 3;
    }

    .benchmark {
        flex-basis: 1em;
        min-width: 1em;
        flex-grow: 1;
    }

    .graphs {
        display: grid;
    }

    .graphs > :global(*) {
        grid-column: 1;
        grid-row: 1;
    }

    .check-select {
        position: relative;
    }

    .check-select .dropdown {
        border: 1px solid #ccc;
        position: absolute;
        height: max-content;
        width: max-content;
        top: 0;
        left: 0;
        display: none;
        padding-right: 0.5em;
    }

    .check-select:hover .dropdown {
        display: block;
    }

    .check-select label {
        display: flex;
        flex-direction: row;
    }
</style>
