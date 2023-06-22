<script lang="ts">
    //// IMPORTS ////
    import { onMount } from "svelte";

    import { writableLocalStorage } from "$util/localStorageStore";
    import Timing, { type ProfileOptions } from "$components/Timing.svelte";
    import { debugClear, debugNodes, debugNumber, updateNodes } from "$debug/visual";
    import { debugGeometryTypes, type DebugFunctions } from "$debug/geometry";
    import type { World } from "$skymaker/Visualization";
    import {
        buildWorld,
        createModeTypes,
        type RenderOptions,
        type CreateMode,
    } from "$components/worldBuilder";
    import { cases, runCases, type Case } from "$components/lazy";
    import LazyGraph from "$components/lazy/LazyGraph.svelte";
    import type { Implementation, Ref } from "$components/lazy/graph";
    import { GPU as oldGPU } from "$webgpu";
    import { GPU } from "$components/WebGPUHistoPyramid";
    import { CAD } from "$skymaker";

    //////////////////////////////////////// TYPES ////////////////////////////////////////

    //////////////////////////////////////// CONSTANTS ////////////////////////////////////////
    const selectedCase = writableLocalStorage<number>("lazy-case", 0);
    const gpu = writableLocalStorage<boolean>("lazy-gpu", true);

    //////////////////////////////////////// VARIABLES ////////////////////////////////////////
    let rendering = false;

    let canvas: HTMLCanvasElement;
    let world: World | null = null;

    //////////////////////////////////////// LOGIC ////////////////////////////////////////

    $: $debugNodes && world?.scene?.children && !rendering && updateNodes(world, $debugNodes);

    $: ($selectedCase >= cases.length || $selectedCase < 0) && selectedCase.set(0);

    const merge = writableLocalStorage<boolean>("lazy-merge", true);
    const removeUnused = writableLocalStorage<boolean>("lazy-remove-unused", true);

    function createSquare(positions: Vec2[]) {
        const geometry: Geometry = [];
        const radius = 1.25;

        positions.forEach((pos) => {
            const { x, y } = pos;
            geometry.push({
                nodes: [
                    { x: x - radius, y: y - radius },
                    { x: x + radius, y: y - radius },
                    { x: x + radius, y: y + radius },
                    { x: x - radius, y: y + radius },
                ],
                contour: [0, 1, 2, 3],
            });
        });
        return geometry;
    }

    const gpuImpl = {
        create: createSquare,
        union: (geometry) => {
            return GPU.union(geometry);
        },
        intersection: async (geometry) => {
            return GPU.intersections(geometry);
        },
        split: (geometry) => {
            return geometry;
        },
    } satisfies Implementation;

    const cpuImpl = {
        create: createSquare,
        union: (geometry) => {
            return CAD.union(geometry);
        },
        intersection: (geometry) => {
            return [{ x: 0, y: 0 }];
        },
        split: (geometry) => {
            return geometry;
        },
    } satisfies Implementation;

    $: impl = $gpu ? gpuImpl : cpuImpl;

    let selectedRef = writableLocalStorage<number>("lazy-selected-ref", -1);
    let displayGraphData: any;
    $: $selectedRef, render();
    async function render() {
        if (!canvas) return;

        const options = {
            functions: {
                create: () => [],
                calculate: async () => {
                    const res = await runCases([cases[$selectedCase]], {
                        merge: $merge,
                        removeUnused: $removeUnused,
                        impl,
                    });
                    if (res[0].maps) {
                        displayGraphData = res[0];
                    }

                    const display = res[0].result?.get($selectedRef) ?? res[0].output;

                    return display;
                },
            },
        } satisfies RenderOptions;

        world = await buildWorld(canvas, options, true);
    }

    onMount(async () => {
        new ResizeObserver(canvasResize).observe(document.body);
        await render();
        animate();
    });

    //////////////////////////////////////// FUNCTIONS ////////////////////////////////////////

    //////////////////// Others ////////////////////
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

    type ProfilingOption = {
        name: string;
        case: Case;
        merge: boolean;
        removeUnused: boolean;
        gpu: boolean;
    };

    const profilingOptions = cases.flatMap((caze, index) => [
        {
            name: `Case: ${caze.name}`,
            options: [
                {
                    name: "GPU " + caze.name,
                    case: caze,
                    merge: true,
                    removeUnused: true,
                    gpu: true,
                },
                {
                    name: "CPU Merge " + caze.name,
                    case: caze,
                    merge: true,
                    removeUnused: false,
                    gpu: false,
                },
                {
                    name: "CPU " + caze.name,
                    case: caze,
                    merge: false,
                    removeUnused: false,
                    gpu: false,
                },
            ],
        },
    ]) satisfies ProfileOptions<ProfilingOption>;

    async function profileFunction(count: number, options: unknown) {
        const opts = options as ProfilingOption;
        world = null;

        const buildOptions = {
            functions: {
                create: () => [],
                calculate: async () => {
                    const caze = {
                        name: "Profiling",
                        fn: async (functions) => {
                            const { join } = functions;
                            let res: Ref<Geometry>[] = [];
                            for (let i = 0; i < count; i++) {
                                if (false) {
                                    const { create, union } = opts.gpu ? gpuImpl : cpuImpl;
                                    const v0 = { x: 0, y: 0 };
                                    const v1 = { x: 1, y: 1 };
                                    const v2 = { x: 2, y: 2 };
                                    const v3 = { x: 3, y: 3 };
                                    const v4 = { x: 4, y: 4 };
                                    const v5 = { x: 5, y: 5 };

                                    let g1 = create([v0]);
                                    let g2 = create([v1]);
                                    let g3 = create([v2]);
                                    let g4 = create([v3]);

                                    const result = await union(
                                        [
                                            await union([g1, g2].flat()),
                                            await union([g3, g4].flat()),
                                        ].flat()
                                    );

                                    res.push(join(result));
                                } else {
                                    res.push(await opts.case.fn(functions));
                                }
                            }

                            return join(...res);
                        },
                    } satisfies Case;

                    const res = await runCases([caze], {
                        merge: opts.merge,
                        removeUnused: opts.removeUnused,
                        impl: opts.gpu ? gpuImpl : cpuImpl,
                    });

                    return res[0].output;
                },
            },
            triangulate: false,
        } satisfies RenderOptions;

        await buildWorld(canvas, buildOptions, false);
    }
</script>

<!----------------------------------------------------------------------------->

<svelte:body
    on:keydown={(e) => {
        if (e.key === "c") {
            debugClear();
            render();
        }
    }}
/>

<div class="wrapper">
    <div class="interaction">
        <label>
            Case
            <select bind:value={$selectedCase} on:change={render}>
                {#each cases as caze, index}
                    <option value={index}>{caze.name}</option>
                {/each}
            </select>
        </label>

        <label>
            GPU
            <input type="checkbox" bind:checked={$gpu} on:change={render} />
        </label>

        <label>
            Merge
            <input type="checkbox" bind:checked={$merge} on:change={render} />
        </label>

        <label>
            Unused
            <input type="checkbox" bind:checked={$removeUnused} on:change={render} />
        </label>
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
        <!-- <div class="colors">
            {#each dynamicColors as color, index}
                <div class="color" style={`background-color: ${color}`} />
                <span>{index}</span>
            {/each}
        </div> -->
        {#if displayGraphData}
            {#key displayGraphData}
                <LazyGraph
                    stages={displayGraphData.stages}
                    maps={displayGraphData.maps}
                    bind:selected={$selectedRef}
                />
            {/key}
        {/if}
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

    .colors {
        position: absolute;
        top: 0.5em;
        left: 0.5em;
        display: grid;
        grid-template-columns: max-content max-content;
        gap: 0.25em;
        line-height: 1;
    }
    .colors > div {
        width: 1em;
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

    .debug {
        border-left: currentColor 2px solid;
        padding-left: 1em;
        display: flex;
        gap: 0.5em;
    }
</style>
