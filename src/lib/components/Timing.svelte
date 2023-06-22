<script context="module" lang="ts">
    interface ProfileFunctionOption {
        name: string;
        enabled?: boolean;
    }
    interface ProfileFunctionOptions {
        name: string;
        options: ProfileFunctionOption[];
    }

    type GraphOptions = {
        [K in keyof Omit<Benchmark, "name" | "data">]?: Benchmark[K];
    };

    export type ProfileOptions<T extends ProfileFunctionOption> = {
        name: string;
        graphOptions?: GraphOptions;
        options: T[];
    }[];

    const defaultValues =
        "40, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000";

    type ms = number;
    let profilingResults: Record<string, number[]> = {};
    const voidFn = () => {};
    export const profile = {
        start(name: string) {},
        end(name: string, waitQueue?: boolean): Promise<void> | void {},
        set(name: string, time: ms) {},
        startLogging(results: Record<string, number[]>) {
            profilingResults = results;
            profile.start = (name: string) => {
                profilingResults[name] = profilingResults[name] ?? [];
                profilingResults[name].push(performance.now());
            };
            profile.end = async (name: string, waitQueue: boolean = false) => {
                waitQueue && (await getCachedDevice().queue.onSubmittedWorkDone());
                profilingResults[name][profilingResults[name].length - 1] =
                    performance.now() - profilingResults[name].at(-1)!;
            };
            profile.set = (name: string, time: ms) => {
                profilingResults[name] = profilingResults[name] ?? [];
                profilingResults[name].push(time);
            };
        },
        stopLogging() {
            console.table(profilingResults);

            profile.start = voidFn;
            profile.end = voidFn;
            profile.set = voidFn;
            profilingResults = {};
        },
    };
</script>

<script lang="ts">
    import { writable } from "svelte/store";
    import type { Benchmark, FullBenchmark, Result } from "../../routes/halftime/Benchmarks.svelte";
    import { writableLocalStorage } from "../util/localStorageStore";
    import type {
        FullProfiling,
        Profiling,
        ProfilingGroup,
        ProfilingCase,
    } from "components/Profiling.svelte";
    import { getCachedDevice, getDevice } from "$util/gpuCommon";

    const cpu = writableLocalStorage<string>("env-cpu");
    const gpu = writableLocalStorage<string>("env-gpu");
    const ram = writableLocalStorage<string>("env-ram");
    const os = writableLocalStorage<string>("env-os");
    const pc = writableLocalStorage<string>("env-pc");

    let adapterInfo: GPUAdapterInfo | undefined;

    async function generateAdapterInfo() {
        if (!adapterInfo) {
            adapterInfo = await (
                await navigator.gpu.requestAdapter({
                    powerPreference: "high-performance",
                })
            )?.requestAdapterInfo();
        }
    }

    generateAdapterInfo();

    type ProfileFunction = (
        x: number,
        options: ProfileFunctionOption,
        seed: number
    ) => Promise<any> | any;

    export let fn: ProfileFunction;
    export let options: ProfileFunctionOptions[];

    options.forEach((o) => {
        o.options.forEach((oo) => {
            oo.enabled = oo.enabled ?? true;
        });
    });

    export let keys: string[];

    const seed = writableLocalStorage("TIMING-seed", 123);
    const iterations = writableLocalStorage("TIMING-iterations", 100);

    let values: number[];
    const valuesString = writableLocalStorage("TIMING-values", defaultValues);
    $: {
        try {
            values = $valuesString
                .split(" ")
                .flatMap((v) => v.split(","))
                .map((v) => parseInt(v, 10));
            values = values.filter((v) => !isNaN(v));
        } catch (e) {
            console.log(e);
        }
    }

    /** Rounds of warmup */
    let selectedOption = writableLocalStorage("TIMING-selected", 0);
    const warmup = writableLocalStorage("TIMING-warmup", 1);

    type ProfileResult = Record<string, number[]>;
    type ProfileResults = Record<number, ProfileResult>;

    let results: Record<string, ProfileResults> = {};
    let resultType = "benchmark" as "benchmark" | "profile";
    let profiling = false;
    let abort = false;

    const output = writable<string[]>([]);

    function sleep(timeout: number = 0) {
        return new Promise((resolve) => setTimeout(resolve, timeout));
    }

    async function run() {
        const opts = options[$selectedOption].options;
        for (let i = 0; i < opts.length; i++) {
            if (abort) return;
            if (!opts[i].enabled) continue;
            for (let x of values) {
                await fn(x, opts[i], $seed);
            }
        }
    }

    async function startBenchmarking() {
        results = {};
        abort = false;
        if (profiling) return;
        profiling = true;
        resultType = "benchmark";

        await profileOptionGroup(options[$selectedOption]);

        $output = [
            "Results:",
            ...Object.entries(results).flatMap(([name, benchmark]) => {
                return [
                    `(${name})`,
                    ...Object.entries(benchmark).map(([x, r]) => {
                        return `${x}: ${Object.entries(r)
                            .map(([k, v]) => `${k}: ${average(v).toFixed(2)}ms`)
                            .join(", ")}`;
                    }),
                ];
            }),
        ];

        if (abort) {
            $output = ["Aborted", ...$output];
        }

        profiling = false;
    }

    async function startProfiling() {
        results = {};
        abort = false;
        if (profiling) return;
        profiling = true;
        resultType = "profile";

        await profileOptionGroup(options[$selectedOption]);

        Object.entries(results).forEach(([name, benchmark]) => {
            console.warn(`(${name})`);
            Object.entries(benchmark).forEach(([x, r]) => {
                console.log(`%c${x}`, "font-weight: bold;");
                console.table(
                    Object.entries(r).reduce((acc, [k, v]) => {
                        acc[k] = average(v).toFixed(2) + "ms";
                        return acc;
                    }, {} as Record<string, string>)
                );
            });
        });

        $output = [
            "Results:",
            ...Object.entries(results).flatMap(([name, benchmark]) => {
                return [
                    `(${name})`,
                    ...Object.entries(benchmark).map(([x, r]) => {
                        return `${x}: ${Object.entries(r)
                            .map(([k, v]) => `${k}: ${average(v).toFixed(2)}ms`)
                            .join(", ")}`;
                    }),
                ];
            }),
        ];

        if (abort) {
            $output = ["Aborted", ...$output];
        }

        profiling = false;
    }

    async function profileOptionGroup(options: ProfileFunctionOptions) {
        for (let i = 0; i < options.options.length; i++) {
            if (abort) return;
            if (!options.options[i].enabled) continue;
            await runBenchmark(fn, options.options[i]);
        }
    }

    let blockConsole = true;
    async function runBenchmark(fn: ProfileFunction, options: ProfileFunctionOption) {
        $output = [`Profiling (${options.name})`];
        let result = {} as ProfileResults;
        const timers: Record<string, any> = {};

        const voidFn = () => {};
        const realConsole = {
            log: console.log,
            trace: console.trace,
            group: console.group,
            groupEnd: console.groupEnd,
            time: console.time,
            timeEnd: console.timeEnd,
        };
        console.group = voidFn;
        console.groupEnd = voidFn;
        if (blockConsole) {
            console.log = voidFn;
            console.trace = voidFn;
        }

        for (let v of values) {
            result[v] = {};
            for (let k of keys) {
                // result[v][k] = [];
            }
        }

        for (let x of values) {
            $output = [...$output, `${x} (0/${iterations})`];

            if ($warmup > 0) {
                if (blockConsole) {
                    console.time = (timer: string) => {};
                    console.timeEnd = (timer: string) => {};
                }

                for (let i = 0; i < $warmup; i++) {
                    if (abort) return;

                    $output = [...$output.slice(0, -1), `${x}: warmup (${i}/${$warmup})`];
                    await sleep(0);
                    await fn(x, options, $seed);
                }
                $output = [...$output.slice(0, -1), `${x}: warmup (${$warmup}/${$warmup})`];
                await sleep(100); // yes, this is needed for aesthetic reasons
            }
            await sleep(0);

            if (resultType === "benchmark") {
                console.time = (timer: string) => {
                    if (timer !== keys[0]) return;
                    timers[timer] = performance.now();
                };
                console.timeEnd = (timer: string) => {
                    if (timer !== keys[0]) return;
                    const time = performance.now() - timers[timer];
                    result[x][timer] = [...(result[x][timer] ?? []), time];
                };
            } else {
                console.time = (timer: string) => {
                    timers[timer] = performance.now();
                };
                console.timeEnd = (timer: string) => {
                    const time = performance.now() - timers[timer];
                    result[x][timer] = [...(result[x][timer] ?? []), time];
                };
                profile.start = console.time;
                profile.end = console.timeEnd;
                profile.set = (timer: string, time: number) => {
                    timers[timer] = time;
                };
                profile.startLogging(result[x]);
            }

            let delay = (options as any).delay;

            for (let i = 0; i < $iterations; i++) {
                if (abort) return;
                $output = [...$output.slice(0, -1), `${x}: benchmark (${i}/${$iterations})`];
                delay && (await sleep(delay));
                await fn(x, options, $seed);
                await sleep(0);
            }
            $output = [...$output.slice(0, -1), `${x}: done`];
            await sleep(0);

            results[options.name] = result;
        }

        console.time = realConsole.time;
        console.timeEnd = realConsole.timeEnd;
        console.group = realConsole.group;
        console.groupEnd = realConsole.groupEnd;
        console.log = realConsole.log;
        console.trace = realConsole.trace;
        profile.start = voidFn;
        profile.end = voidFn;
        profile.set = voidFn;

        return results;
    }

    function average(values: number[]) {
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    function max(values: number[]) {
        return values.reduce((a, b) => Math.max(a, b), 0);
    }

    function min(values: number[]) {
        return values.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
    }

    function copy() {
        if (!$gpu) $gpu = prompt("GPU", adapterInfo!.description) as string;
        if (!$cpu) $cpu = prompt("CPU") as string;
        if (!$ram) $ram = prompt("RAM", "??GB @ ????MHz") as string;
        if (!$os) $os = prompt("OS") as string;
        if (!$pc) $pc = prompt('PC (E.g. "Alice\'s MacBook" or "Bob\'s Desktop")') as string;

        if (resultType === "benchmark") {
            copyResults();
        } else {
            copyProfiling();
        }
    }

    function copyResults() {
        const output = {
            name:
                new Date().toISOString().split("T")[0] +
                " | " +
                options[$selectedOption].name +
                " | " +
                $pc,
            date: new Date().toISOString(),
            type: "benchmark",
            info: {
                Iterations: "" + $iterations,
                Seed: "" + $seed,
                GPU: $gpu,
                CPU: $cpu,
                RAM: $ram,
                OS: $os,
            },
            benchmarks: Object.entries(results).map(([name, res], index) => {
                const data = Object.entries(res).map(([x, r]) => {
                    const res = r["Calculate"];
                    return {
                        x: +x,
                        data: res,
                    } satisfies Result;
                });

                return {
                    name,
                    data,
                    ...((options[$selectedOption] as any).extra ?? {}),
                } satisfies Benchmark;
            }),
        } satisfies FullBenchmark;

        navigator.clipboard.writeText(JSON.stringify(output, null, 4));
    }

    function copyProfiling() {
        console.log(results);

        function addProfilingResults(obj: ProfilingGroup, data: number[], path: string[]) {
            let parent = obj.find((x) => x.name === path[0]);
            if (path.length === 1) {
                if (parent) {
                    parent.data = data;
                } else {
                    obj.push({
                        name: path[0],
                        data,
                    });
                }
                return;
            }
            if (!parent) {
                parent = {
                    name: path[0],
                    data: [],
                    subData: [],
                } as Profiling;
                obj.push(parent);
            }
            if (!parent.subData) parent.subData = [];
            addProfilingResults(parent.subData, data, path.slice(1));
        }

        const cases: ProfilingCase[] = Object.entries(results).map(([name, fullData]) => {
            console.log(name, fullData);
            const samples = Object.entries(fullData).reduce((acc, [count, rec]) => {
                // Profiling Implementation
                acc[+count] = [];

                for (let [name, profile] of Object.entries(rec)) {
                    const path = name.split(".");
                    addProfilingResults(acc[+count], profile, path);
                }

                return acc;
            }, {} as Record<number, ProfilingGroup>);

            return {
                name,
                samples,
            } satisfies ProfilingCase;
        });

        const output = {
            name:
                new Date().toISOString().split("T")[0] +
                " | " +
                options[$selectedOption].name +
                " | " +
                $pc,
            date: new Date().toISOString(),
            type: "profiling",
            info: {
                Iterations: "" + $iterations,
                Seed: "" + $seed,
                GPU: $gpu,
                CPU: $cpu,
                RAM: $ram,
                OS: $os,
            },
            cases,
            // profilings: data,
        } satisfies FullProfiling;

        navigator.clipboard.writeText(JSON.stringify(output, null, 4));
    }

    function resetValues() {
        $valuesString = defaultValues;
    }

    let visible = writableLocalStorage<boolean>("timing-visible", true);
</script>

<!----------------------------------------------------------------------------->

<div class="timing">
    <label>
        <span>Profiling</span>
        <input type="checkbox" bind:checked={$visible} />
    </label>

    {#if $visible}
        <div class="controls">
            <div class="options">
                <select bind:value={$selectedOption} class="opts">
                    {#each options as option, index}
                        <option value={index}>{option.name}</option>
                    {/each}
                </select>
                <div class="selected">
                    {#each options[$selectedOption].options as option}
                        <label>
                            <input type="checkbox" bind:checked={option.enabled} />
                            <span>{option.name}</span>
                        </label>
                    {/each}
                </div>
                <label for="seed"> Seed </label>
                <input id="seed" type="number" bind:value={$seed} />
                <label for="iterations"> Iterations </label>
                <input id="iterations" type="number" bind:value={$iterations} />
                <label for="warmup"> Warmup </label>
                <input id="warmup" type="number" bind:value={$warmup} />
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <label for="values">
                    Values <div class="place-left" on:click={resetValues}>🔄</div></label
                >

                <input id="values" type="text" bind:value={$valuesString} />
            </div>

            <div>
                <button on:click={startBenchmarking}>Benchmark</button>
                <button on:click={startProfiling}>Profile</button>
                {#if Object.keys(results).length > 0 && !profiling}
                    <button on:click={copy}>Copy</button>
                    <button on:click={() => (results = {})}>Clear</button>
                {/if}
                {#if profiling}
                    <button on:click={() => (abort = true)}>Abort</button>
                {/if}
                {#if !profiling}
                    <button on:click={run}>Run</button>
                {/if}
            </div>
        </div>

        <div class="results">
            {#each $output as line}
                <span>{line}</span>
            {/each}
        </div>
    {/if}
</div>

<!----------------------------------------------------------------------------->
<style>
    .timing {
        background: #111;
        padding: 0.5em 1em;
    }

    .opts {
        grid-column: span 2;
        font-size: 1em;
        padding-block: 0.25em;
    }
    .options {
        display: grid;
        grid-template-columns: 1fr max-content;
        column-gap: 0.5em;
        row-gap: 0.5em;
        grid-auto-rows: max-content;
        margin-bottom: 1em;
    }

    .selected {
        grid-column: span 2;
    }

    label {
        display: contents;
    }

    input[type="text"] {
        width: 14ch;
    }

    .place-left {
        margin-left: auto;
    }

    .results {
        display: flex;
        flex-direction: column;
    }
    .results span {
        max-width: 19em;
    }

    .controls {
        display: flex;
        flex-direction: column;
    }

    label {
        display: flex;
        flex-direction: row;
        column-gap: 0.5em;
    }
</style>
