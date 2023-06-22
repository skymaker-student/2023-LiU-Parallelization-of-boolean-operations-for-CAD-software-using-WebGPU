<script context="module" lang="ts">
    export type ProfilingGroup = Profiling[];

    export type ShapeCount = number;

    export type Profiling = {
        name: string;
        data: number[];
        subData?: ProfilingGroup;
    };

    export type ProfilingCase = {
        name: string;
        samples: Record<ShapeCount, ProfilingGroup>;
    };

    export type FullProfiling = {
        name: string;
        date: string;
        type: "profiling";
        info?: Record<string, string>;
        include?: boolean[];
        cases: ProfilingCase[];
    };
</script>

<script lang="ts">
    import Info from "$graph/Info.svelte";
    import Timeline from "$graph/Timeline.svelte";
    import profilingJSON from "../assets/profilings?array!json";

    const fullProfiling: FullProfiling[] = profilingJSON;

    let selectedProfile = 0;
    let selectedCase = 0;

    const profilings = fullProfiling.map((profiling) => {
        return profiling.name;
    });

    $: selectedProfile, changeProfile();
    function changeProfile() {
        selectedCase = 0;
        selectedShapeCount = 0;
    }

    $: cases = fullProfiling[selectedProfile].cases.map((caze) => {
        return caze.name;
    });

    $: shapeCounts = Object.keys(
        fullProfiling[selectedProfile].cases[0].samples
    ) as any[] as number[];

    $: include = fullProfiling[selectedProfile].include?.[selectedCase];

    let selectedShapeCount = 0;

    // window.location.hash?.substring(1) ?? "0"
    $: data = fullProfiling[selectedProfile];

    $: profilingCase = data!.cases[selectedCase];

    const defaultColors = [
        "#d97706",
        "#65a30d",
        "#09bba0",
        "#0264c7",
        "#7c3aed",
        "#db2777",
        "#dc2626",
    ];

    export let colors = defaultColors;

    const width = 100;
    const height = 60;

    // const type = writableLocalStorage<GraphType>("profilingGraphType", "gantt");
    let fullscreen = false;

</script>

<!--------------------------------------------------data.samples[0]--------------------------->

<svelte:body
    on:keydown={(e) => {
        if (e.key === "g") {
            fullscreen = !fullscreen;
            toggleNav();
            e.preventDefault();
        }
    }}
/>
{#if !fullscreen}
    <label>
        Profiling
        <select bind:value={selectedProfile}>
            {#each profilings as profiling, index}
                <option value={index}>{profiling}</option>
            {/each}
        </select>
    </label>
    <label>
        Case
        <select bind:value={selectedCase}>
            {#each cases as caze, index}
                <option value={index}>{caze}</option>
            {/each}
        </select>
    </label>
    <label>
        Shape Count
        <select bind:value={selectedShapeCount}>
            {#each shapeCounts as count, index}
                <option value={index}>{count}</option>
            {/each}
        </select>
    </label>
{/if}

<div class="profiling">
    <!-- <svg viewBox="0 0 120 100" width="1000" height="1000"> -->
    {#if profilingCase}
        {#key "" + selectedShapeCount + "|" + selectedCase + "|" + selectedProfile}
            {#if include}
                <Timeline data={[profilingCase.samples[shapeCounts[selectedShapeCount]][1]]} />
            {:else if include === false}
                <Timeline
                    data={profilingCase.samples[shapeCounts[selectedShapeCount]][1].subData}
                />
            {:else if include === undefined}
                <Timeline data={profilingCase.samples[shapeCounts[selectedShapeCount]]} />
            {/if}
        {/key}
    {/if}
    <!-- </svg> -->
    <!-- {JSON.stringify(fullProfiling)} -->
    <Info info={data.info} />
</div>

<!----------------------------------------------------------------------------->

<style>
    .profiling {
        background: white;
        color: black;
        font-size: 2vw;
        padding: 0.25em;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }
</style>
