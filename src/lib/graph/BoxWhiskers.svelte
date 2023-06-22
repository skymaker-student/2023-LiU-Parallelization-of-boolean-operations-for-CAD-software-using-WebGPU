<script lang="ts">
    import type { GraphContext, Measurement } from "./graph";

    export let data: Measurement;
    export let context: GraphContext;

    const { mapX, mapY } = context;

    const x = mapX(data.x);

    const mapped = {
        min: mapY(data.min),
        q1: mapY(data.q1),
        median: mapY(data.median),
        q3: mapY(data.q3),
        max: mapY(data.max),
    };

    const boxWidth = 3;
    const whiskerWidth = 0.25;
    const lineWidth = 0.125;
    const medianWidth = 0.2;
</script>

<!----------------------------------------------------------------------------->

<!-- whisker center -->
<line class="whisker" x1={x} x2={x} y1={mapped.min} y2={mapped.q1} stroke-width={whiskerWidth} />
<line class="whisker" x1={x} x2={x} y1={mapped.q3} y2={mapped.max} stroke-width={whiskerWidth} />

<line
    class="cap"
    x1={x}
    x2={x}
    y1={mapped.min}
    y2={mapped.min + lineWidth}
    stroke-width={boxWidth / 2}
/>
<line
    class="cap"
    x1={x}
    x2={x}
    y1={mapped.max - lineWidth}
    y2={mapped.max}
    stroke-width={boxWidth / 2}
/>

<rect
    class="box"
    x={x - boxWidth / 2}
    y={mapped.q3}
    width={boxWidth}
    height={mapped.q1 - mapped.q3}
/>

<line
    class="median"
    x1={x}
    x2={x}
    y1={mapped.median - medianWidth / 2}
    y2={mapped.median + medianWidth / 2}
    stroke="red"
    stroke-width={boxWidth + 0.25}
/>

<!----------------------------------------------------------------------------->

<style>
    line {
        stroke: black;
    }

    .whisker {
        stroke: #aaa;
    }

    .median {
        stroke: black;
    }

    .box {
        fill: none;
        stroke: #0264c7;
        stroke-width: 0.2;
    }
</style>
