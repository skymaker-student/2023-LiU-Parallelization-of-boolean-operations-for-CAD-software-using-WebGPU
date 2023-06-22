<script lang="ts">
    import UnionCreate from "./svg/UnionCreate.svelte";
    import UnionSplit from "./svg/UnionSplit.svelte";
    import UnionFilter from "./svg/UnionFilter.svelte";
    import UnionMerge from "./svg/UnionMerge.svelte";

    import IntersectionFilter from "./svg/IntersectionFilter.svelte";
    import IntersectionMerge from "./svg/IntersectionMerge.svelte";

    import PyramidBuffers from "./svg/PyramidBuffers.svelte";
    import PyramidBuild from "./svg/PyramidBuild.svelte";
    import PyramidTraverse from "./svg/PyramidTraverse.svelte";
    import PyramidArray from "./svg/PyramidArray.svelte";

    import Graph from "./svg/Graph.svelte";
    import GraphMerge from "./svg/GraphMerge.svelte";
    import Benchmarks from "routes/halftime/Benchmarks.svelte";

    import unionBenchmarks from "../../assets/benchmarks/old/2023-03-24_union-all_linus-laptop_nvidia_1.json";
    import GradientText from "./svg/GradientText.svelte";
    import UnionAnimated from "./svg/UnionAnimated.svelte";

    let print = false;

    function keydown(e: KeyboardEvent) {
        if (e.key === "b") {
            print = !print;
        }
    }

    const colors = ["#d8437e", "#15c27d"];

    const textGradient = ["#3e7adc", "#008fe4", "#00a0dc", "#00adc8", "#00b7ad"];
    const benchmarkColors = [
        // CPU
        "#8B2B73",
        "#d8437e",
        // HistoPyramid
        "#3E288F",
        "#3e7adc",
        // Accelerated
        "#0C7565",
        "#15c27d",
    ];
</script>

<!----------------------------------------------------------------------------->

<svelte:body on:keydown={keydown} />

<main class="content" class:print>
    <!-- <UnionAnimated {colors} /> -->
    <h1>
        <GradientText height={3} gradient={textGradient}>
            WebGPU Boolean Parallelization Project
        </GradientText>
    </h1>
    <h3>Union</h3>
    <ul class="sequence" id="union">
        <li class="image">
            <h4>Define geometry</h4>
            <UnionCreate {colors} />
            <p>
                Define what geometry to do the union operation on. This may be any number of polygon
                shapes.
            </p>
        </li>
        <li class="image">
            <h4>Split lines into segments</h4>
            <UnionSplit {colors} />
            <p>Find intersections between lines on the squares.</p>
        </li>
        <li class="image">
            <h4>Remove segments</h4>
            <UnionFilter {colors} />
            <p>Mark the segments inside another shape for removal.</p>
        </li>
        <li class="image">
            <h4>Build final the shape</h4>
            <UnionMerge {colors} />
            <p>
                Traverse the shape, jumping every time the next segment is marked for removal and
                build the new shape from the path.
            </p>
        </li>
    </ul>

    <h3>Theoretical Intersection</h3>
    <ul class="sequence" id="intersection">
        <li class="image">
            <h4>Define geometry</h4>
            <UnionCreate {colors} />
            <!-- <p>
                Define what geometry to do the union operation on. This may be any number of polygon
                shapes.
            </p> -->
        </li>
        <li class="image">
            <h4>Split lines into segments</h4>
            <UnionSplit {colors} />
            <!-- <p>Find intersections between lines on the squares.</p> -->
        </li>
        <li class="image">
            <h4>Remove segments</h4>
            <IntersectionFilter {colors} />
            <!-- <p>Mark the segments outside all shapes for removal.</p> -->
        </li>
        <li class="image">
            <h4>Build final the shape</h4>
            <IntersectionMerge {colors} />
            <!-- <p>
                Traverse the shape, jumping every time the next segment is marked for removal and
                build the new shape from the path.
            </p> -->
        </li>
    </ul>

    <h3>HistoPyramid</h3>
    <ul class="sequence" id="histopyramid">
        <li class="image">
            <h4>Generate buffers</h4>
            <PyramidBuffers />
            <p>Each layer is one fourth the size of the previous layer.</p>
        </li>
        <li class="image">
            <h4>Build layers</h4>
            <PyramidBuild {colors} />
            <p>Sum four squares and place the sum in the next layer.</p>
        </li>
        <li class="image">
            <h4>Traverse</h4>
            <PyramidTraverse {colors} />
            <p>
                The HistoPyramid can be traversed to get the position in the base layer from a given
                index, and vice versa.
            </p>
        </li>
        <li class="image">
            <h4>Array expansion & contraction</h4>
            <PyramidArray />
            <p>
                The HistoPyramid can be used to expand and contract arrays of data, using the
                traversal algorithm to find the correct position in the base layer.
            </p>
        </li>
    </ul>

    <br />
    <h2>
        <GradientText height={2.5} gradient={textGradient}>Benchmarks</GradientText>
    </h2>
    <ul class="list" id="benchmarks">
        <li>
            <div class="clamp">
                <Benchmarks onlyLegend light data={unionBenchmarks} colors={benchmarkColors} />
            </div>
            <!-- <img src="/image/benchmark-union.png" alt="benchmark union" /> -->
        </li>
        <li>
            <h4>Union Benchmarks</h4>

            <p>
                In the figure to the left, curves depicting the performance of different
                implementations of the union operator. The Y axis describes the processing time in
                milliseconds, while the X axis describes the number of randomly placed squares
                processed. The squares are made up of 4 line segments each, meaning that 4000 line
                segments are processed at X=1000.
            </p>

            <p>
                As we can see, there is little to no difference between the benchmarks with and
                without delays. The reason we tested with delays between tests is to let the garbage
                collector work before each test. However, it seems like there was little to no
                effect. Perhaps, the garbage collector can work while the GPU is dispatched, for
                example.
            </p>

            <!-- <h4>Implementations</h4> -->
            <h5>CPU</h5>
            <p>Full CPU implementation</p>
            <h5>GPU Accelerated</h5>
            <p>
                Implementation that largely follows the CPU implementation, but with the most
                expensive operations moved to the GPU. The largest drawback with this approach is
                that the data needs to be converted between different formats and transferred
                between the CPU and GPU multiple times.
            </p>
            <h5>GPU HistoPyramid</h5>
            <p>
                GPU implementation using the HistoPyramid, where almost all of the computation is
                done on the GPU. The only operations that are done on the CPU are the conversion of
                the data to the GPU format and the traversal and construction of the final shape.
            </p>
        </li>
    </ul>

    <br />
    <h2>
        <GradientText height={2.5} gradient={textGradient}>CPU vs GPU</GradientText>
    </h2>
    <ul class="list" id="cpu-vs-gpi">
        <li>
            <h4>Early termination checks (e.g. AABB)</h4>

            <!-- <h5>CPU → Threads are not blocked → Can continue working</h5>

            <h5>GPU → Workgroup blocking → Termination unnecessary</h5> -->

            <p>
                The threads in a workgroup are blocked from terminating until all threads are done.
                Thus, some early termination checks can be a waste on the GPU, while improving the
                performance on the CPU.
            </p>
        </li>
        <li>
            <h4>Arbitrary insertions into arrays</h4>

            <!-- <h5>CPU → Good memory allocation performance → Arbitrary insertions are reasonable</h5>

            <h5>GPU → Poor memory allocation performance → Arbitrary insertions are slow</h5> -->

            <p>
                A CPU is able to dynamically scale buffers such as Vectors during runtime with some
                performance impact. However, it is unreasonable to do so on a GPU. Thus, we should
                plan ahead and define GPU buffers according to known delimitations. The same can be
                said about the threads doing the insertions into said GPU buffer. Arbitrary
                concurrent insertions can be done with sequential consistency using locks and CAS
                operations, however, this can severely penalize performance. Thus, we would like
                each thread to have mutually exclusive access to assigned memory addresses.
            </p>
        </li>
        <li>
            <h4>Parallelism</h4>

            <!-- <h5>CPU → Few powerful threads → Small scale parallelism, many dependencies</h5>

            <h5>GPU → Huge amount of weaker threads → Large scale parallelism, few dependencies</h5> -->

            <p>
                GPUs can run a lot of threads at once, making algorithms with few dependencies in
                between operations quicker. By analyzing the dependency tree of a pipeline, program,
                or algorithm, we are able to do further optimizations and perhaps run different
                operations in parallel. This is if said operations do not operate on the same memory
                address or affect each other in any way.
            </p>
        </li>
    </ul>

    <br />
    <h2>
        <GradientText height={2.5} gradient={textGradient}>Lazy Evaluation</GradientText>
    </h2>
    <ul class="list col2" id="evaluation">
        <li class="image-right">
            <h4>Build Dependency Graph</h4>
            <div>
                <p>
                    The graph is acyclic and made up of nodes representing an operation and the
                    memory space the operation reads and/or writes from/to. In our case, memory
                    space can be represented by memory ranges or 3D volumes.
                </p>
                <br />
                <p>
                    The edges represent the dependency of memory space between nodes. If node 2 is
                    dependent on node 1, we also need to know what kind of dependency it is. If it
                    is a "read" dependency and node 1 has a read dependency on same memory, then
                    node 2 does not need to wait, and vice versa if node 1 has a write dependency to
                    the same memory instead.
                </p>
            </div>
            <Graph {colors} />
        </li>

        <li class="image-right">
            <h4>Merge nodes and remove unused nodes</h4>
            <p>
                Nodes that depend on each other can sometimes be merged into one node. This can be
                done if the order of the operations do not affect the result.
            </p>
            <GraphMerge {colors} />
        </li>
        <li>
            <h4>Place nodes in stages</h4>
            <p>
                Nodes that do not depend on each other can be placed in the same stage. This can
                then be used to execute all nodes in a stage in parallel. Optimizations can be done
                to merge operations in a stage if they do not depend on each other.
            </p>
        </li>
        <li>
            <h4>Execute stages sequentially</h4>
            <p>Stages must be executed sequentially, as they depend on each other.</p>
        </li>
    </ul>
    <footer>
        <ul>
            <li>Max Helmrich</li>
            <li>Linus Käll</li>
        </ul>
        <img src="image/skymaker_logo.png" alt="SkyMaker Logo" />
    </footer>
</main>

<!----------------------------------------------------------------------------->
<style>
    .clamp {
        height: 30em;
    }
    .content {
        --font-size: 0.85;
        --border-width: 0.25em;
        --arrow-indent: 1.25em;

        font-size: calc(var(--font-size) * 1vw);
        padding: 2em;
        box-sizing: border-box;
        background: white;
        color: #334;
        position: relative;
        isolation: isolate;
        font-family: Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
        text-rendering: optimizeLegibility;
    }

    .print {
        width: 297mm;
        font-size: calc(297mm * var(--font-size) / 100);

        aspect-ratio: 297 / 420;
        overflow: hidden;
        margin: auto;
        min-height: 100%;
    }

    @media print {
        @page {
            size: 297mm 420mm;
        }

        :global(:root, html, body, main) {
            background: white;
        }
    }

    p {
        line-height: 1.25em;
    }

    h1,
    h2 {
        font-size: 1em;
        margin: 0;
    }

    h2 {
        margin-top: 0.5em;
    }

    h3 {
        font-size: 1.25em;
        margin: 0;
        font-weight: 400;
    }

    h4 {
        margin: 0;
        padding: 0;
        font-weight: 400;
        font-size: 1.15em;
        margin-bottom: 0.5em;
    }

    p ~ h4 {
        margin-top: 0.5em;
    }

    h5 {
        margin: 0;
        margin-top: 0.5em;
        font-size: 1.1em;
        font-weight: 400;
    }

    .sequence,
    .list {
        --bg-steps: var(--color1, #743ad5), var(--color2, #d53a9d), var(--color1, #743ad5);
        --bg-angle: 110deg;
        --background: linear-gradient(var(--bg-angle), var(--bg-steps)) border-box;

        list-style: none;
        padding: 0;
        margin: 0;

        display: flex;
        flex-direction: row;
    }

    .sequence {
        gap: 0em;

        border: var(--border-width) solid transparent;
        border-radius: 0.5em;
        background: linear-gradient(white, white) padding-box, var(--background);
        background-attachment: fixed;
        background-position: top left;
        background-size: contain;
    }

    .list {
        gap: 1em;
    }

    .sequence li,
    .list li {
        position: relative;
        isolation: isolate;

        flex: 1;
        padding-inline: 0.5em;
        padding-top: 0.25em;
        padding-bottom: 0.5em;

        border-left: none;
        border-right: none;
    }

    .sequence li ~ li:before {
        content: "";
        position: absolute;
        top: -1px;
        bottom: -1px;
        left: calc((var(--border-width) - var(--arrow-indent)) / 2);

        width: calc(var(--border-width) + var(--arrow-indent));

        background: var(--background);
        background-attachment: fixed;
        background-position: top left;
        background-size: contain;
        clip-path: polygon(
            0 0,
            var(--border-width) 0,
            calc(var(--border-width) + var(--arrow-indent)) 50%,
            var(--border-width) 100%,
            0 100%,
            var(--arrow-indent) 50%
        );
    }

    .sequence ~ h3 {
        margin-top: 1em;
    }

    .sequence h4 {
        text-align: center;
    }

    .list li {
        border: var(--border-width) solid transparent;
        border-radius: 0.5em;
        background: linear-gradient(white, white) padding-box, var(--background);
        /* background: linear-gradient(white, white) padding-box, var(--background); */
        background-attachment: fixed;
        background-position: top left;
        background-size: contain;
    }

    .image {
        display: grid;
        grid-template-rows: max-content max-content max-content;
        justify-items: center;
        text-align: center;
    }

    .image :global(*:nth-child(2)) {
        height: 7em;
    }

    .image-right {
        display: grid;

        grid-template:
            "content image" max-content
            "content image" 1fr
            / 1fr max-content;
        column-gap: 1em;
        place-items: flex-start;
    }

    .image-right :global(svg) {
        width: 16em;
        grid-area: image;
        margin-top: 1em;
    }

    p {
        margin: 0;
    }

    img {
        max-width: 100%;
    }

    .col2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }

    #union,
    #intersection,
    #histopyramid {
        /* --bg-steps: #743ad5, #8e35cc, #a331c2, #b430b8, #c131af, #cc34a6, #d53a9d, #cc34a6, #c131af,
            #b430b8, #a331c2, #8e35cc, #743ad5; */

        --bg-steps: #8360c3, #3e7adc, #008fe4, #00a0dc, #00adc8, #00b7ad, #2ebf91, #2ebf91, #00b7ad,
            #00adc8, #00a0dc;
        --bg-angle: 230deg;
    }

    #cpu-vs-gpi,
    #evaluation,
    #benchmarks {
        --bg-steps: #00a0dc, #00adc8, #00b7ad, #2ebf91, #2ebf91, #00b7ad, #00adc8, #00a0dc, #008fe4,
            #3e7adc, #8360c3;
    }

    footer {
        margin-top: 7em;
        place-items: center;
        justify-content: center;
        display: flex;
        gap: 3em;
    }

    footer > ul {
        font-size: 1em;
        list-style-type: none;
        padding: 0;
        margin: 0;
    }

    footer > ul > li {
        line-height: 1.5em;
    }

    footer > img {
        height: 4em;
    }
</style>
