<script context="module" lang="ts">
    const implementations = ["cpu", "accelerated", "histopyramid", "clipping", "none"] as const;
    export type Implementation = (typeof implementations)[number];
</script>

<script lang="ts">
    //////////////////////////////////////// IMPORTS ////////////////////////////////////////
    import { onMount } from "svelte";

    import { writableLocalStorage } from "$util/localStorageStore";
    import Timing, { profile } from "$components/Timing.svelte";
    import {
        debug,
        debugClear,
        debugIsolate,
        debugNodes,
        debugNumber,
        debugShapes,
        updateNodes,
    } from "$debug/visual";
    import { debugGeometryTypes, type DebugFunctions } from "$debug/geometry";
    import type { World } from "$skymaker/Visualization";
    import {
        buildWorld,
        createModeTypes,
        type RenderOptions,
        type CreateMode,
    } from "$components/worldBuilder";

    import "$components/WebGPUHistoPyramid/union";

    import { customCases } from "$components/worldBuilderCases";
    import { Compare } from "$util/comparison";

    import { CAD as CPU } from "$skymaker";
    import { GPU as HistoPyramid } from "$components/WebGPUHistoPyramid";
    import { GPU as Accelerated } from "$webgpu";
    import { profilingOptions, type ProfilingOptions } from "$components/profilingCases";
    import { randomPolygonGrid } from "$skymaker/geometry";

    //////////////////////////////////////// TYPES ////////////////////////////////////////

    //////////////////////////////////////// CONSTANTS ////////////////////////////////////////
    const useUnion = writableLocalStorage<boolean>("SplitUnionWebGPU-useUnion", false);
    const renderProfiling = writableLocalStorage<boolean>(
        "SplitUnionWebGPU-renderProfiling",
        false
    );
    const implementation = writableLocalStorage<Implementation>(
        "SplitUnionWebGPU-implementation",
        "cpu"
    );

    const comparisonImplementation = writableLocalStorage<"ulp" | "skymaker">(
        "SplitUnionWebGPU-comparison",
        "ulp"
    );

    comparisonImplementation.subscribe((value) => {
        Compare.change(value);
    });

    const modes = createModeTypes();
    const mode = writableLocalStorage<CreateMode>("SplitUnionWebGPU-mode", "debug");

    //////////////////////////////////// PROFILING OPTIONS ////////////////////////////////////
    //////////////////// Debug ////////////////////
    const debugTypes = debugGeometryTypes();
    const debugType = writableLocalStorage<DebugFunctions>("SplitUnionWebGPU-debugType", "hole");

    //////////////////// Random ////////////////////
    const count = writableLocalStorage<number>("SplitUnionWebGPU-count", 100);
    const density = writableLocalStorage<number>("SplitUnionWebGPU-density", 0.75);
    const dynamicColors = ["#ff00ff", "#00ffff", "#ffff00", "#00ff00", "#ff0000"]; // , "#0000ff"

    const randomizerSeed = 123; // default: 123

    //////////////////////////////////////// VARIABLES ////////////////////////////////////////
    let rendering = false;

    let canvas: HTMLCanvasElement;
    let world: World | null = null;

    //////////////////////////////////////// LOGIC ////////////////////////////////////////

    $: $debugNodes && world?.scene?.children && !rendering && updateNodes(world, $debugNodes);

    $: modes.indexOf($mode) === -1 && mode.set(modes[0]);
    $: debugTypes.indexOf($debugType) === -1 && debugType.set(debugTypes[0]);

    onMount(async () => {
        new ResizeObserver(canvasResize).observe(document.body);
        await render();
        animate();
    });

    //////////////////////////////////////// FUNCTIONS ////////////////////////////////////////

    //////////////////// Others ////////////////////
    const unionImplementations = {
        none: (g: Geometry) => g,
        clipping: customCases.polygonClipping.calculate,
        accelerated: Accelerated.union,
        histopyramid: HistoPyramid.union,
        cpu: CPU.union,
    };

    const splitImplementations = {
        none: (g: Geometry) => g,
        clipping: undefined,
        accelerated: Accelerated.split,
        histopyramid: HistoPyramid.split,
        cpu: CPU.split,
    };

    Object.entries(unionImplementations).forEach(([key, fn]) => {
        if (!fn) return;
        (fn as any).__implementation__ = key;
    });

    Object.entries(splitImplementations).forEach(([key, fn]) => {
        if (!fn) return;
        (fn as any).__implementation__ = key;
    });

    function operations(implementation: Implementation) {
        return {
            union: unionImplementations[implementation],
            split: splitImplementations[implementation],
        };
    }

    async function render() {
        if (!canvas) return;
        if (rendering) return;

        let createOptions: RenderOptions["create"];
        if ($mode === "debug") {
            createOptions = {
                mode: "debug",
                function: $debugType,
            };
        } else {
            createOptions = {
                mode: "random",
                count: $count,
                density: $density,
                seed: randomizerSeed,
            };
        }

        const options = {
            useUnion: $useUnion,
            create: createOptions,
            operations: operations($implementation),
        } satisfies RenderOptions;

        profile.startLogging({});
        world = await buildWorld(canvas, options, true);
        profile.stopLogging();
    }

    function animate() {
        if (world) {
            world.render();
        }
        requestAnimationFrame(animate);
    }

    function canvasResize() {
        // const { width, height } = canvasContainer.getBoundingClientRect();
        // canvas.width = width;
        // canvas.height = height;
        // render();
    }

    async function profileFunction(count: number, options: unknown, seed: number = 0) {
        const opts = options as ProfilingOptions;
        const params = opts.hyperparameters ?? {};

        function evalOrNum(value: number | ((val: number) => number) | undefined, def: number) {
            return typeof value === "function" ? value(count) : value ?? def;
        }

        world = null;

        world = await buildWorld(
            canvas,
            {
                useUnion: opts.union ?? true,
                create: {
                    mode: "random",
                    count: evalOrNum(params.count, count),
                    density: evalOrNum(params.density, 0.75),
                    seed: params.seed ?? seed,
                },
                operations: operations(opts.implementation),
                functions: opts.functions ?? {
                    create: params.maxVertices
                        ? (options) => {
                              if (options.create.mode !== "random") throw new Error("Invalid mode");
                              return randomPolygonGrid({
                                  count: options.create.count,
                                  maxVertices: params.maxVertices ?? 4,
                                  maximize: params.maximizeVertices ?? true,
                                  seed: options.create.seed,
                                  density: options.create.density,
                              });
                          }
                        : undefined,
                },
                triangulate: $renderProfiling,
            },
            $renderProfiling
        );
    }

    const debugVariables = debug.variables;
    const debugOutputs = debug.outputs;
    const debugSync = debug.sync;

    $: $debugVariables, render();
</script>

<!----------------------------------------------------------------------------->

<svelte:body
    on:keydown={(e) => {
        if (e.key === "c") {
            debugClear();
            render();
        }
        if (e.key === "]") {
            implementations.indexOf($implementation) === implementations.length - 1
                ? implementation.set(implementations[0])
                : implementation.set(implementations[implementations.indexOf($implementation) + 1]);
            render();
        } else if (e.key === "[") {
            implementations.indexOf($implementation) === 0
                ? implementation.set(implementations[implementations.length - 1])
                : implementation.set(implementations[implementations.indexOf($implementation) - 1]);
            render();
        }
        if (e.key === "'") {
            debugNumber.update((n) => n - 1);
            render();
        } else if (e.key === "\\") {
            debugNumber.update((n) => n + 1);
            render();
        }
    }}
/>

<div class="wrapper">
    <div class="interaction">
        <label>
            Mode
            <select bind:value={$mode} on:change={render}>
                {#each modes as mode}
                    <option value={mode}>{mode}</option>
                {/each}
            </select>
        </label>
        {#if $mode === "debug"}
            <label>
                Type
                <select bind:value={$debugType} on:change={render}>
                    {#each debugTypes as type}
                        <option value={type}>{type}</option>
                    {/each}
                </select>
            </label>
        {/if}
        {#if $mode === "random"}
            <label>
                Count
                <input type="number" bind:value={$count} on:change={render} />
            </label>
            <label>
                Density
                <input
                    type="number"
                    max={1}
                    min={0.05}
                    step={0.05}
                    bind:value={$density}
                    on:change={render}
                />
            </label>
        {/if}
        <label>
            Implementation
            <select bind:value={$implementation} on:change={render}>
                {#each implementations as impl}
                    <option value={impl}>{impl}</option>
                {/each}
            </select>
        </label>
        <label>
            Compare
            <select bind:value={$comparisonImplementation} on:change={render}>
                <option value="ulp">ULP</option>
                <option value="skymaker">Decimal</option>
            </select>
        </label>
        <label>
            Union
            <input type="checkbox" bind:checked={$useUnion} on:change={render} />
        </label>
        <label>
            Render Bench
            <input type="checkbox" bind:checked={$renderProfiling} on:change={render} />
        </label>

        <div class="debug-top">
            <label>
                Number
                <input type="number" bind:value={$debugNumber} on:change={render} />
            </label>
            <label>
                Isolate
                <input type="number" bind:value={$debugIsolate} on:change={render} />
            </label>
            <label>
                Shapes
                <input type="checkbox" bind:checked={$debugShapes} on:change={render} />
            </label>
        </div>
    </div>

    <div class="canvas-container">
        <canvas bind:this={canvas} />
        <!-- <div class="timing">
            {#each timing as result}
                <div>{result.name}: {result.time.toFixed(2)}ms</div>
            {/each}
        </div> -->
        <div class="profiler">
            <Timing fn={profileFunction} keys={["Calculate"]} options={profilingOptions} />
        </div>
        <div class="debug">
            {#each dynamicColors as color, index}
                <div class="color" style={`background-color: ${color}`} />
                <span>{index}</span>
            {/each}
            <span class="split" />

            <span>Sync</span>
            <input type="checkbox" bind:checked={$debugSync} />

            <span class="split" />

            {#each Object.entries($debugVariables) as [name, variable], index}
                <span>{name}</span>
                {#if variable.type === "number"}
                    <input type="number" bind:value={variable.value} />
                {:else if variable.type === "boolean"}
                    <input type="checkbox" bind:checked={variable.value} />
                {:else if variable.type === "string"}
                    <input type="text" bind:value={variable.value} />
                {/if}
            {/each}
            <span class="split" />
            {#each Object.entries($debugOutputs) as [name, value], index}
                <span>{name}</span>
                <span>{value}</span>
            {/each}
        </div>
    </div>
</div>

<!----------------------------------------------------------------------------->
<style>
    .wrapper {
        display: flex;
        flex-direction: column;
        padding: 1em;
        height: 100%;
        box-sizing: border-box;
        gap: 1em;
    }

    .interaction {
        display: flex;
        flex-direction: row;
        gap: 1em;
    }

    .profiler {
        position: absolute;
        top: 0.5em;
        right: 0.5em;
        display: flex;
        flex-direction: column;
        font-size: 0.8em;
    }

    .debug {
        position: absolute;
        z-index: 1000;
        top: 0.5em;
        left: 0.5em;
        display: grid;
        grid-template-columns: max-content max-content;
        gap: 0.25em;
        line-height: 1;
    }
    .debug .color {
        width: 1em;
        height: 1em;
    }

    .debug .split {
        grid-column: 1 / -1;
        height: 1em;
    }

    .canvas-container {
        position: relative;
        width: 100%;
        height: 100%;
    }

    canvas {
        position: absolute;
        inset: 0;
        outline: 1px solid #ccc;
        width: 100%;
        height: 100%;
    }

    label {
        display: flex;
        flex-direction: column;
    }

    input[type="number"] {
        width: 10ch;
    }

    select {
        font-size: 1em;
    }

    .debug-top {
        border-left: currentColor 2px solid;
        padding-left: 1em;
        display: flex;
        gap: 0.5em;
    }
</style>
