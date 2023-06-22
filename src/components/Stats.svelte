<script lang="ts">
    import { checkWebGPU } from "../lib/webgpu/common/helloWebgpu";

    const result = checkWebGPU();
</script>

<!--
    1. Find line intersections (Find all points).
    2. Pair intersections (How should they be paired?).
    3. 

    Questions:
    * Should we use type inference at the cost of using more memory?
    * Check all lines against the same line for multiple passes, or
    * Each workgroup loads all lines into shared memory and checks which lines intersect with their assigned line?

-->

<!----------------------------------------------------------------------------->

<pre>
    {#await result then value}
        <h1>Hello WebGPU</h1>
        {#each value as line}
            <p>{line}</p>
        {/each}
    {:catch error}
        <h1 class="error">Error</h1>
        <p>{error.message}</p>
    {/await}
</pre>

<!----------------------------------------------------------------------------->
<style>
    pre {
        overflow-y: scroll;
        height: 100%;
    }

    h1 {
        margin: 0em;
        line-height: 1;
    }

    p {
        font-size: 14px;
        margin: 0;
    }

    .error {
        color: #ff0000;
    }
</style>
