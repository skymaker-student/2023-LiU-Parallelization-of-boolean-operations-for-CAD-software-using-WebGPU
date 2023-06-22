<script context="module" lang="ts">
    export type Result = {
        x: number;
        data: number[];
        comment?: string;
    };

    export type Benchmark = {
        name: string;
        axisLabelX?: string;
        data: Result[];
    };

    export type FullBenchmark = {
        name: string;
        date: string;
        type: "benchmark";
        display?: DisplayInfo;
        info?: Record<string, string>;
        benchmarks: Benchmark[];
    };

    export type DisplayInfo = {
        scale?: { x?: Mode; y?: Mode };
        step?: { x?: number; y?: number };
        colors?: string[];
    };

    export type Mode = "logarithmic" | "linear" | "values";
    export type Modes = { x: Mode; y: Mode };
</script>

<script lang="ts">
    import { onMount } from "svelte";
    import benchmarksJSON from "../../assets/benchmarks?array!json";

    const fullBenchmarks: FullBenchmark[] = benchmarksJSON;

    let selectedIndex = 0;
    export let data: FullBenchmark | undefined = undefined;

    $: selectedBenchmarks = data ?? fullBenchmarks[selectedIndex];
    $: benchmarks = selectedBenchmarks.benchmarks;
    $: info = selectedBenchmarks.info;

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

    let stepY = 100;

    export let mode: Modes = {
        x: "values",
        y: "logarithmic",
    };
    const padding = {
        left: 5,
        right: 2,
        top: 1,
        bottom: 3,
    };
    const grid = {
        horizontal: true,
        vertical: false,
    };

    $: updateDisplayInfo(selectedBenchmarks);
    function updateDisplayInfo(benchmark: FullBenchmark) {
        const info = benchmark.display;
        mode.x = info?.scale?.x ?? "values";
        mode.y = info?.scale?.y ?? "logarithmic";
        stepY = info?.step?.y ?? 100;
        colors = info?.colors ?? defaultColors;
    }

    function step(value: number, direction: "up" | "down") {
        if (mode.y === "logarithmic") {
            if (direction === "up") {
                return 10 ** Math.ceil(Math.log10(value));
            } else {
                return 10 ** Math.floor(Math.log10(value));
            }
        } else {
            if (direction === "up") {
                return Math.ceil(value / stepY) * stepY;
            } else {
                return Math.floor(value / stepY) * stepY;
            }
        }
    }

    function mapResult<T>(benchmarks: Benchmark[], fn: (result: Result) => T) {
        return benchmarks.flatMap((benchmark) => benchmark.data.map(fn));
    }

    $: maxY = step(Math.max(...mapResult(benchmarks, (r) => r.max)), "up");
    $: minY = 0; //step(Math.min(...mapResult(benchmarks, (r) => r.min)), "down");
    $: maxX = Math.max(...mapResult(benchmarks, (r) => r.x));
    $: minX = Math.min(...mapResult(benchmarks, (r) => r.x));

    $: xValues = [...new Set(mapResult(benchmarks, (r) => r.x))].sort((a, b) => a - b);
    $: yValues = [...new Set(mapResult(benchmarks, (r) => r.average))].sort((a, b) => a - b);

    let graphWrapper: HTMLElement;
    let height = 0;
    onMount(() => {
        const obs = new ResizeObserver(() => {
            height = (graphWrapper.clientHeight / graphWrapper.clientWidth) * 100 - 2;
        });
        obs.observe(graphWrapper);

        return () => {
            obs.disconnect();
        };
    });

    function mapX(x: number) {
        return padX(
            {
                logarithmic: mapXLog,
                linear: mapXLinear,
                values: mapXValues,
            }[mode.x](x)
        );
    }

    function padX(x: number) {
        return x * (100 - padding.left - padding.right) + padding.left;
    }

    function mapXLinear(x: number) {
        return (x - minX) / (maxX - minX);
    }

    function mapXLog(x: number) {
        return Math.log10(x - minX + 1) / Math.log10(maxX - minX + 1);
    }

    function mapXValues(x: number) {
        return xValues.indexOf(x) / (xValues.length - 1);
    }

    function mapY(y: number, height: number) {
        return padY(
            {
                logarithmic: mapYLog,
                linear: mapYLinear,
                values: mapYValues,
            }[mode.y](y),
            height
        );
    }

    function padY(y: number, height: number) {
        return height - (y * (height - padding.top - padding.bottom) + padding.bottom);
    }

    function mapYLinear(y: number) {
        return (y - minY) / (maxY - minY);
    }

    function mapYLog(y: number) {
        return Math.log10(y) / Math.log10(maxY);
    }

    function mapYValues(y: number) {
        return y;
    }

    function createPoints(benchmark: Benchmark, height: number) {
        return benchmark.data
            .map((result) => `${mapX(result.x)},${mapY(result.average, height)}`)
            .join(" ");
    }

    function axisY(benchmarks: Benchmark[]) {
        if (mode.y === "values")
            return [...new Set(mapResult(benchmarks, (r) => r.average))].sort((a, b) => a - b);
        else if (mode.y === "logarithmic") {
            const values = [];
            for (let i = 1; i <= maxY; i *= 10) {
                for (let j = 1; j < 10; ++j) {
                    if (i * j <= maxY) values.push(i * j);
                }
            }
            return values;
        } else if (mode.y === "linear") {
            const values = [];
            for (let i = minY; i <= maxY; i += stepY) {
                values.push(i);
            }
            return values;
        }
        return [];
    }

    function axisX(benchmarks: Benchmark[]) {
        return [...new Set(mapResult(benchmarks, (r) => r.x))].sort();
    }

    function toExponential(value: number) {
        if (value == 0) return 0;
        let exponent = Math.floor(Math.log10(value));
        let val = value / 10 ** exponent;

        return `${val}e${exponent}`;
    }

    export let onlyLegend = false;
    export let light = false;

    function lightMode(e: KeyboardEvent) {
        if (e.key !== "l") return;
        // colors = defaultColors;

        onlyLegend = !onlyLegend;
        light = true;
        document.body.style.setProperty("background", "white");
        document.body.style.setProperty("color", "#333");
    }
</script>

<!----------------------------------------------------------------------------->

<svelte:body on:keydown={lightMode} />
<div class="benchmarks" class:light>
    <div
        bind:this={graphWrapper}
        class="graph-wrapper"
        style:--padding-left="{padding.left}%"
        style:--padding-top="{(padding.top * 100) / height}%"
    >
        <div class="float-tl">
            {#if !onlyLegend}
                <select bind:value={selectedIndex}>
                    {#each fullBenchmarks as fullBenchmark, index}
                        <option value={index}>{fullBenchmark.name}</option>
                    {/each}
                </select>
            {/if}
            <div class="legend">
                {#each benchmarks as benchmark, index}
                    <div style:order={-index} style:background={colors[index]} />
                    <span style:order={-index}>{benchmark.name}</span>
                {/each}
            </div>
            {#if !onlyLegend}
                {#if info}
                    <div class="info">
                        {#each Object.entries(info) as [key, value], index}
                            <span>{key}</span><span>{value}</span>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>
        {#key benchmarks}
            <svg class="graph" viewBox="0 0 100 {height}">
                {#if benchmarks.length > 0}
                    <g class="axis y-axis">
                        {#each axisY(benchmarks) as value, i}
                            {@const y = mapY(value, height)}
                            {#if grid.horizontal}
                                <line
                                    class="grid-line"
                                    x1={padding.left}
                                    y1={y}
                                    x2={100 - padding.right}
                                    y2={y}
                                />
                            {/if}
                            {#if mode.y !== "logarithmic" || i % 9 === 0 || i % 9 === 4}
                                <text x="0" {y}>{toExponential(value)}</text>
                            {/if}
                        {/each}
                    </g>

                    <g class="axis x-axis">
                        {#each axisX(benchmarks) as value}
                            {@const x = mapX(value)}
                            {#if grid.vertical}
                                <line
                                    class="grid-line"
                                    x1={x}
                                    y1={padding.top}
                                    x2={x}
                                    y2={height - padding.bottom}
                                />
                            {/if}
                        {/each}
                    </g>

                    {#each benchmarks as benchmark, index (benchmark.name)}
                        <g class="deviation">
                            {#each benchmark.data as result (result.x)}
                                {@const x = mapX(result.x)}
                                <!-- small line to indicate max and min values -->
                                <line
                                    x1={x}
                                    y1={mapY(result.max, height)}
                                    x2={x}
                                    y2={mapY(result.min, height)}
                                    stroke={colors[index]}
                                    stroke-width="0.025em"
                                />

                                <!-- <circle
                            cx={x}
                            cy={mapY(result.max, height)}
                            r="0.025em"
                            fill={colors[index]}
                        />
                        <circle
                            cx={x}
                            cy={mapY(result.min, height)}
                            r="0.025em"
                            fill={colors[index]}
                        /> -->
                            {/each}
                        </g>
                    {/each}

                    {#each benchmarks as benchmark, index (benchmark.name)}
                        <g>
                            <polyline
                                points={createPoints(benchmark, height)}
                                stroke={colors[index]}
                                fill="none"
                                stroke-width="0.025em"
                            />
                            {#each benchmark.data as result (result.x)}
                                {@const x = mapX(result.x)}
                                {@const y = mapY(result.average, height)}

                                <circle cx={x} cy={y} r="0.025em" fill={colors[index]} />
                            {/each}
                        </g>
                    {/each}

                    <g class="axis x-axis">
                        {#each axisX(benchmarks) as value}
                            {@const x = mapX(value)}
                            <text {x} y={height}>{value}</text>
                        {/each}
                    </g>
                {/if}
            </svg>
        {/key}
    </div>
</div>

<!----------------------------------------------------------------------------->
<style>
    .benchmarks {
        display: grid;
        grid-template-rows: 1fr;
        height: 100%;
        isolation: isolate;
    }

    .float-tl {
        z-index: 100;
        position: absolute;
        top: var(--padding-top);
        left: var(--padding-left);
        padding: 0.5em;
        font-size: 1em;
        display: flex;
        flex-direction: column;
        gap: 0.5em;
    }

    .float-tl select {
        font-size: 1em;
        padding: 0.5em;
        border: 1px solid #444;
        border-radius: 4px;
        background: #242424;
        color: #fff;
    }

    .legend {
        display: grid;
        grid-template-columns: max-content 1fr;
        grid-auto-rows: max-content;
        row-gap: 0.5em;
        padding: 0.5em;
        background: #242424;
        border: 1px solid #444;
        border-radius: 4px;
    }

    .light .legend {
        background: #fff9;
        border: 1px solid #ddd;
    }

    .legend > div {
        content: "";
        display: inline-block;
        width: 1em;
        height: 1em;
        margin-right: 0.5em;
        background-color: var(--color);
        border-radius: 5px;
    }

    .legend > span {
        line-height: 1em;
        text-transform: capitalize;
    }

    .info {
        padding: 0.5em;
        background: #242424;
        border: 1px solid #444;
        border-radius: 4px;
        display: grid;
        grid-template-columns: max-content max-content;
        grid-auto-rows: max-content;
        column-gap: 1em;
    }

    .graph-wrapper {
        position: relative;
        overflow: hidden;
        margin: 0em 1em 1em 1em;
    }

    .light .graph-wrapper {
        /* margin: 0;
        margin-bottom: -2%; */
    }

    .graph text {
        font-size: 0.1em;
        fill: currentColor;
        line-height: 1em;
    }

    .y-axis text {
        translate: 0 0.5em;
        text-align: right;
    }

    .x-axis text {
        text-anchor: middle;
    }

    .grid-line {
        stroke: currentColor;
        stroke-opacity: 0.1;
        stroke-width: 0.01em;
        stroke-dasharray: 0.01em;
    }

    .deviation {
        opacity: 0.5;
    }
</style>
