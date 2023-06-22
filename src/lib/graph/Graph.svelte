<script context="module" lang="ts">
    import type { Writable } from "svelte/store";
    import { writableLocalStorage } from "$util/localStorageStore";

    export type NumberOption = {
        name: string;
        type: "number";
        value: Writable<number>;
    };

    export type SelectOption = {
        name: string;
        type: "select";
        value: Writable<string>;
        options: { name: string; value: string }[];
    };

    export type BooleanOption = {
        name: string;
        type: "boolean";
        value: Writable<boolean>;
    };

    export type Option = NumberOption | SelectOption | BooleanOption;

    export const types = {
        box: {
            component: BoxGraph,
            options: [
                {
                    name: "Y Step",
                    type: "number",
                    value: writableLocalStorage<number>("boxGraphYStep", 100),
                },
                {
                    name: "X Axis scale",
                    type: "select",
                    value: writableLocalStorage<Mode>("boxGraphXAxisScale", "linear"),
                    options: [
                        { name: "linear", value: "linear" },
                        { name: "values", value: "values" },
                    ],
                },
                {
                    name: "Y Axis scale",
                    type: "select",
                    value: writableLocalStorage<Mode>("boxGraphYAxisScale", "linear"),
                    options: [
                        { name: "linear", value: "linear" },
                        { name: "log", value: "logarithmic" },
                    ],
                },
            ],
        },
        histogram: {
            component: HistogramGraph,
            options: [
                {
                    name: "Y Step",
                    type: "number",
                    value: writableLocalStorage<number>("histogramGraphYStep", 100),
                },
                {
                    name: "Bar Count",
                    type: "number",
                    value: writableLocalStorage<number>("histogramGraphBarCount", 10),
                },
                {
                    name: "Shape count",
                    type: "select",
                    value: writableLocalStorage<number>("histogramGraphShapeCount", 10),
                    options: [{ name: "auto", value: 1 }],
                },
                {
                    name: "Label rotation",
                    type: "number",
                    value: writableLocalStorage<number>("histogramGraphLabelRotation", 60),
                },
            ],
        },
        trend: {
            component: TrendGraph,
            options: [
                {
                    name: "Y Step",
                    type: "number",
                    value: writableLocalStorage<number>("trendGraphYStep", 1000),
                },
                {
                    name: "X Axis scale",
                    type: "select",
                    value: writableLocalStorage<Mode>("trendGraphXAxisScale", "linear"),
                    options: [
                        { name: "linear", value: "linear" },
                        { name: "values", value: "values" },
                    ],
                },
                {
                    name: "Y Axis scale",
                    type: "select",
                    value: writableLocalStorage<Mode>("trendGraphYAxisScale", "linear"),
                    options: [
                        { name: "linear", value: "linear" },
                        { name: "log", value: "logarithmic" },
                    ],
                },
                {
                    name: "Fixed Y Height",
                    type: "number",
                    value: writableLocalStorage<number>("trendGraphFixedYHeight", -1),
                },
                {
                    name: "Show 50%",
                    type: "boolean",
                    value: writableLocalStorage<boolean>("trendGraphShowPoints", true),
                },
                {
                    name: "Show 95%",
                    type: "boolean",
                    value: writableLocalStorage<boolean>("trendGraphShowPoints", true),
                },
            ],
        },
    } as Record<"box" | "histogram" | "trend", { component: any; options: Option[] }>;

    export type GraphType = keyof typeof types;
</script>

<script lang="ts">
    import type { Benchmark } from "routes/halftime/Benchmarks.svelte";
    import BoxGraph from "./BoxGraph.svelte";
    import HistogramGraph from "./HistogramGraph.svelte";
    import TrendGraph from "./TrendGraph.svelte";
    import type { Mode } from "./graph";
    import Info from "./Info.svelte";

    export let benchmark: Benchmark;
    export let type: GraphType;

    export let comparison: Benchmark[] = [];

    export let info: Record<string, string>;

    function sort() {
        benchmark.data.forEach((result) => {
            result.data = result.data.sort((a, b) => a - b);
        });
    }
    sort();

    const padding = {
        left: 11,
        top: 2,
        right: 3,
        bottom: 6,
    };

    export let aspect = 10 / 6;
    export let renderGrid = true;

    const height = 100 / aspect;

    const vb = {
        x: -padding.left,
        y: -padding.top,
        width: 100 + padding.left + padding.right,
        height: height + padding.top + padding.bottom,
    };

    export let graphOptions = [] as Option[];
    $: type, updateOptions();

    function update() {
        graphOptions = graphOptions;
    }

    let unsub = [() => {}];
    function updateOptions() {
        unsub.forEach((u) => u());
        graphOptions = types[type].options;
        unsub = graphOptions.map((opt) => opt.value.subscribe(update));
    }
</script>

<!----------------------------------------------------------------------------->

<div>
    <svg height="{(vb.height / vb.width) * 100}vw" viewBox="{vb.x} {vb.y} {vb.width} {vb.height}">
        {#key graphOptions}
            <svelte:component
                this={types[type].component}
                {benchmark}
                {comparison}
                options={graphOptions}
            />
        {/key}
    </svg>
    <Info benchmarks={[benchmark, ...comparison]} {info} {type} />
</div>

<!----------------------------------------------------------------------------->
<style>
    div {
        flex: 1;
    }

    svg {
        width: 100vw;
    }
</style>
