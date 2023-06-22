<script context="module" lang="ts">
    export type Label = {
        value: number;
        label: string;
    };
</script>

<script lang="ts">
    import type { GraphContext } from "./graph";

    export let context: GraphContext;
    export let units: { x: string; y: string };
    export let labels: { x?: Label[]; y?: Label[] } = {};

    const { mapX, mapY, max, min, height, data, options } = context;

    function step(value: number, direction: "up" | "down") {
        if (options.axes.y.mode === "logarithmic") {
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

    let stepY = Math.max(options.axes.y.step, 1);
    const grid = {
        horizontal: true,
        vertical: false,
    };

    function axisY() {
        if (options.axes.y.mode === "values") {
            return [...new Set(data.map((r) => r.median))].sort((a, b) => a - b);
        } else if (options.axes.y.mode === "logarithmic") {
            const values = [0];
            for (let i = 1; i <= max.y; i *= 10) {
                for (let j = 1; j < 10; ++j) {
                    if (i * j <= max.y) values.push(i * j);
                }
            }
            return values;
        } else if (options.axes.y.mode === "linear") {
            const values = [];
            for (let i = min.y; i <= max.y; i += stepY) {
                values.push(i);
            }
            return values;
        }
        return [];
    }

    function axisX() {
        if (labels.x) return labels.x;

        return [...new Set(data.map((r) => r.x))].sort().map(
            (x) =>
                ({
                    value: x,
                    label: Math.round(x).toString(),
                } as Label)
        );
    }

    function toExponential(value: number) {
        if (value == 0) return 0;
        let exponent = Math.floor(Math.log10(value));
        let val = value / 10 ** exponent;

        return `${val}e${exponent}`;
    }
</script>

<!----------------------------------------------------------------------------->

<g class="axis y-axis">
    {#each axisY() as value, i}
        {@const y = mapY(value)}
        {#if grid.horizontal}
            <line class="grid-line" x1="-2.5" y1={y} x2="102.5" y2={y} />
        {/if}
        {#if options.axes.y.mode !== "logarithmic" || i % 9 === 1 || i % 9 === 5 || i === 0}
            <text x="-3.5" {y}>{value.toFixed(0)}</text>
        {/if}
    {/each}
    <g transform="translate(-8.5, {height / 2})">
        <text class="unit" transform="rotate(-90)">{units.y}</text>
    </g>
</g>

<g class="axis x-axis">
    {#each axisX() as value}
        {@const x = mapX(value.value)}
        {#if grid.vertical}
            <line class="grid-line" x1={x} y1={0} x2={x} y2={height} />
        {/if}
    {/each}
</g>

<g class="axis x-axis">
    {#each axisX() as value}
        {@const x = mapX(value.value)}
        <g transform="translate({x}, {height + (options.axes.x.rotation ? 1.25 : 2.5)})">
            <text
                class:rotate={options.axes.x.rotation}
                transform="rotate({options.axes.x.rotation ?? 0})">{value.label}</text
            >
        </g>
    {/each}
    <g transform="translate(50, {height + 5})">
        <text class="unit">{units.x}</text>
    </g>
</g>

<!----------------------------------------------------------------------------->
<style>
    text {
        font-size: 0.1em;
        fill: currentColor;
        line-height: 1em;
    }

    .y-axis text {
        translate: 0 0.35em;
        text-anchor: end;
    }

    .y-axis .unit {
        text-anchor: middle;
    }

    .unit {
    }

    .x-axis text {
        text-anchor: middle;
    }

    .x-axis .rotate {
        text-anchor: end;
    }

    .grid-line {
        stroke: currentColor;
        stroke-opacity: 0.4;
        stroke-width: 0.01em;
        stroke-dasharray: 0.01em;
    }
</style>
