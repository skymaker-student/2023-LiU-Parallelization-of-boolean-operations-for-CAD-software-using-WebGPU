import type { HistoPyramidGPU } from "./gpu/generateBuffers";
import * as GPU from "./gpu";
import { DEBUG, type ShapePack } from ".";
import { packPolygonShapes, extractNewShapes, LOOP_MAX } from ".";
import { debugArray } from "$debug/visual";
import { holesInsideShapes } from "./gpu/holesInShapes";
import { getDevice } from "$util/gpuCommon";
import { profile } from "$components/Timing.svelte";
import {
    bindGroups,
    createLayerSize,
    type BatchInfo,
    type PyramidBase,
    type ShapeInput,
    type ShapeOutput,
    type LayerSize,
} from "./gpu/shaders/bindGroup";
import {
    buildNewShapesBatched,
    buildPyramidBatched,
    extractNewShapesBatched,
    filterSegmentsBatched,
    segmentLinesBatched,
    type ExtractedShapes,
} from "./gpu/batch";
import type { Layers } from "three";

const GENERATE_SHAPE_BUFFERS = "Calculate.Generate Shape Buffers";
const GENERATE_HISTOPYRAMID_BUFFERS = "Calculate.Generate HistoPyramid Buffers";
const SEGMENT_LINES = "Calculate.Segment Lines";
const BUILD_PYRAMID = "Calculate.Build Pyramid";
const FILTER_PYRAMID = "Calculate.Filter Pyramid";
const REBUILD_PYRAMID = "Calculate.Rebuild Pyramid";
const EXTRACT_NEW_SHAPES = "Calculate.Extract New Shapes";
const GENERATE_NEW_SHAPE_BUFFERS = "Calculate.Generate New Shape Buffers";
const BUILD_NEW_SHAPES = "Calculate.Build New Shapes";
const FORMAT_NEW_SHAPES = "Calculate.Format New Shapes";

const COLLECT_ALL_SHAPES = false;

export type BindGroups = {
    shapeInput: ShapeInput;
    pyramidBase: PyramidBase;
    batchInfo: BatchInfo;
    shapeOutput?: ShapeOutput;
    size: LayerSize;
};

export async function union(geometry: Geometry) {
    if (geometry.length <= 1) {
        return geometry;
    }

    await getDevice();
    profile.start("Calculate.Upload");

    function createBatch(baseSize: LayerSize) {
        const min = 16;
        const maxBatch = baseSize.layerBaseSize * baseSize.layerBaseSize;

        const width = Math.max(Math.pow(2, Math.ceil(Math.log2(count))), min);
        const height = Math.min(maxBatch / width, width);

        return { width, height, batches: Math.ceil(count / height) };
    }

    const geometryPack = packPolygonShapes(geometry);
    const count = geometryPack.lineCount;
    const layerSize = createLayerSize(count);

    const { width, height, batches } = createBatch(layerSize);

    const input = bindGroups.shapeInput(geometryPack);

    const base = bindGroups
        .pyramidBase(layerSize)
        .update(width, 0, geometryPack.lineCount, geometryPack.maxX);

    const batchInfo = bindGroups.batchInfo({ count: batches, width, height });

    const groups: BindGroups = {
        shapeInput: input,
        pyramidBase: base,
        batchInfo: batchInfo,
        size: layerSize,
    };

    let output: ExtractedShapes | undefined = undefined;
    let outputSize = new Array<number>(batches);

    await profile.end("Calculate.Upload", true);

    console.log(
        `%cStarting ${batches} batches ${JSON.stringify({ width, height })}`,
        "font-weight: bold;"
    );
    for (let i = 0; i < batches; i++) {
        console.log(`%cStarting batch ${i + 1}/${batches}`, "font-weight: bold;");
        // console.time("Calculate.Batch " + i);
        // profile.start(`Calculate.Batch [${i}]`);
        DEBUG && console.log(`batch ${i + 1}/${batches}`);

        profile.start(`Calculate.Init Batch [${i}]`);
        batchInfo.startBatch(i);
        await profile.end(`Calculate.Init Batch [${i}]`, true);

        profile.start(`Calculate.Segment Lines [${i}]`);
        await segmentLinesBatched(groups);
        await profile.end(`Calculate.Segment Lines [${i}]`, true);

        // await groups.pyramidBase.debug(SEGMENT_LINES);
        profile.start(`Calculate.Build Pyramid [${i}]`);
        await buildPyramidBatched(groups, "Segment");
        await profile.end(`Calculate.Build Pyramid [${i}]`, true);

        profile.start(`Calculate.Filter [${i}]`);
        await filterSegmentsBatched(groups);
        await profile.end(`Calculate.Filter [${i}]`, true);

        DEBUG && (await groups.pyramidBase.debugBases(FILTER_PYRAMID, batches));
        profile.start(`Calculate.Rebuild Pyramid [${i}]`);
        await buildPyramidBatched(groups, "Filter");
        await profile.end(`Calculate.Rebuild Pyramid [${i}]`, true);

        DEBUG && (await groups.pyramidBase.debugBases("Build pyramid", batches));

        profile.start(`Calculate.Allocate Output [${i}]`);
        groups.shapeOutput = await bindGroups.shapeOutput(base);
        await profile.end(`Calculate.Allocate Output [${i}]`, true);

        profile.start(`Calculate.Build Shapes [${i}]`);
        await buildNewShapesBatched(groups);
        await profile.end(`Calculate.Build Shapes [${i}]`, true);

        profile.start(`Calculate.Extract Shapes [${i}]`);
        output = await extractNewShapesBatched(groups, output);
        await profile.end(`Calculate.Extract Shapes [${i}]`, true);

        outputSize[i] = output.info.length;

        // console.timeEnd("Calculate.Batch " + i);
        // profile.end(`Calculate.Batch [${i}]`);
    }

    // console.table(
    //     output?.points.zip(output.info).map(([point, info], index) => ({
    //         ...point,
    //         ...info,
    //         index: outputSize.findIndex((size) => index < size),
    //     }))
    // );
    profile.start("Calculate.Format New Shapes");
    let newGeometry: Geometry = await formatNewShapes(output!);
    profile.end("Calculate.Format New Shapes", false);
    // console.log({ length: newGeometry.length });
    return newGeometry;
}

export async function unionMultiple(geometries: Geometry[]) {
    throw new Error("Not implemented");
    // geometries = geometries.filter(g => g.length > 1);
    if (geometries.length === 0) {
        return [];
    }

    // function all<T>(fn: (g: Geometry, index: number) => T) {
    //     return Promise.all(geometries.map(fn));
    // }

    // const shapePackBuffers = await all((geometry) =>
    //     GPU.generateShapeBuffers(packPolygonShapes(geometry))
    // );
    // const pyramid = await all((_, i) =>
    //     GPU.generateHistoPyramidBuffers(shapePackBuffers[i].lineCount)
    // );
    // await all((_, i) => GPU.segmentLines(shapePackBuffers[i], pyramid[i]));

    // await all((_, i) => GPU.buildPyramid(pyramid[i]));
    // await all((_, i) => GPU.filterInsideSegments(shapePackBuffers[i], pyramid[i]));
    // await all((_, i) => GPU.buildPyramid(pyramid[i]));

    // const newShapePackBuffers = await all((_, i) => GPU.generateNewShapesBuffers(pyramid[i].top));
    // await all((_, i) =>
    //     GPU.buildNewShapesFromPyramid(pyramid[i], shapePackBuffers[i], newShapePackBuffers[i])
    // );

    // let extraction = await all((_, i) => extractNewShapes(newShapePackBuffers[i]));
    // let newGeometry: Geometry[] = await all((_, i) => formatNewShapes(extraction[i]));

    // return newGeometry;
}

export async function formatNewShapes({ info: ids, points }: ExtractedShapes) {
    const idMap = new Map(ids.map((id, index) => [id.id, index]));
    const info = ids.map(({ next }) => idMap.get(next) ?? -1); // TODO: -1 is not correct

    let newGeometry: Geometry = [];
    let newHoles: Vec2[][] = [];
    let notVisited = new Set(Array(points.length).keys());

    let current = 0;
    let nodes: Vec2[] = [];
    let minNode = { x: Infinity, y: Infinity };
    let minNodeIndex = -1;
    for (let i = 0; i < LOOP_MAX; i++) {
        if (i + 1 === LOOP_MAX) {
            console.warn("Reached the final loop of building shapes. The shapes could be bad.");
        }
        // If there is no next node, break the loop.
        if (current === undefined) {
            break;
        }

        // If current is visited
        if (!notVisited.has(current)) {
            // is hole
            if (nodes.length === 0) throw new Error("Current nodes length is 0");

            if (!COLLECT_ALL_SHAPES && nodes.length < 3)
                DEBUG && console.warn(`Found shape with ${nodes.length} nodes!`);

            if (!COLLECT_ALL_SHAPES && nodes.length > 2) {
                if (isHole(nodes, minNodeIndex)) {
                    newHoles.push(nodes);
                } else {
                    newGeometry.push({ nodes, holes: [] });
                }
            }

            if (COLLECT_ALL_SHAPES) {
                newGeometry.push({ nodes, holes: [] });
            }

            nodes = [];
            minNode = { x: Infinity, y: Infinity };
            current = notVisited[Symbol.iterator]().next().value;
            continue;
        }

        if (notVisited.size == 0) {
            throw new Error("There are no more nodes to visit!");
        }

        notVisited.delete(current);
        const node = points[current];
        if (node.x <= minNode.x) {
            if (node.y < minNode.y) {
                minNode = node;
                minNodeIndex = nodes.length;
            }
        }

        nodes.push(node);
        current = info[current];
    }

    if (newHoles.length > 0) {
        const newShapePack = await GPU.generateShapeBuffers(packPolygonShapes(newGeometry));
        const holePointsPack = await GPU.generateHolePointsBuffer(newHoles);

        const targets = await holesInsideShapes(newShapePack, holePointsPack);

        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            if (target === -1) {
                continue;
            } else {
                // TODO Check when this happens and fix this...
                if (!newGeometry[target]) continue; //throw new Error("Hole target shape not found");
                newGeometry[target].holes!.push(newHoles[i]);
            }
        }
    }
    return newGeometry;
}

function isHole(nodes: Vec2[], minNodeIndex: number) {
    const nodeA = nodes[(minNodeIndex - 1 + nodes.length) % nodes.length];
    const nodeB = nodes[minNodeIndex];
    const nodeC = nodes[(minNodeIndex + 1) % nodes.length];

    const AB = { x: nodeB.x - nodeA.x, y: nodeB.y - nodeA.y };
    const AC = { x: nodeC.x - nodeA.x, y: nodeC.y - nodeA.y };

    const cross = AB.x * AC.y - AB.y * AC.x;

    return cross < 0;
}

let batch = {} as Record<
    string,
    {
        all: number[];
    }[]
>;
export async function debugBases2(
    { base: { anglesValues, width } }: { base: HistoPyramidGPU["base"] },
    msg: string | null = null,
    batchSize = 1
) {
    if (!DEBUG) {
        return;
    }

    const device = await getDevice();
    const commandEncoder = device.createCommandEncoder();

    const readBufferAnglesValues = device.createBuffer({
        size: anglesValues.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    commandEncoder.copyBufferToBuffer(
        anglesValues,
        0,
        readBufferAnglesValues,
        0,
        readBufferAnglesValues.size
    );

    device.queue.submit([commandEncoder.finish()]);

    await readBufferAnglesValues!.mapAsync(GPUMapMode.READ);

    const resultBufferAnglesValues = new Float32Array(readBufferAnglesValues!.getMappedRange());

    // console.log("angle values", [...resultBufferAnglesValues]);

    // random 4 density 1
    const debugTarget = new Map<string, "+" | "-">();
    if (!batch[msg ?? "default"]) {
        batch[msg ?? "default"] = [];
    }

    batch[msg ?? "default"].push({
        all: [...resultBufferAnglesValues],
    });
    readBufferAnglesValues!.unmap();

    if (batch[msg ?? "default"].length < batchSize) return;

    const data = batch[msg ?? "default"].map((b) => b.all).flat();
    const anglesArr = data.filter((_, i) => i % 2 == 0);
    const valuesArr = data.filter((_, i) => i % 2 == 1);
    batch[msg ?? "default"] = [];

    debugArray(valuesArr, width, undefined, {
        name: msg ?? undefined,
        text(value, x, y) {
            const angle = anglesArr[y * width + x];

            const valStr = `<span>${value?.toFixed(2)}</span>`;

            let angleStr;

            let pies = angle / Math.PI;

            if (value < -3 || value == 1 || pies > 2) {
                angleStr = `<span>${pies.toFixed(2)}π</span>`;
            } else {
                angleStr = `<span style="color: goldenrod;">${pies.toFixed(2)}π</span>`;
            }

            return angleStr + valStr;
        },
        color(value, x, y) {
            const angle = anglesArr[y * width + x];
            const str = `${y},${x}`;
            if (debugTarget.has(str)) {
                const target = debugTarget.get(str);
                if (target === "+" && angle < 0) {
                    return "red";
                }
                if (target === "-" && angle > 0) {
                    return "red";
                }
                return "green";
            }

            return value < -3 || value == 1 || angle > 2 * Math.PI ? "gray" : "white";
        },
        background(value, x, y) {
            const batch = Math.floor(y / (width / batchSize));

            const angle = anglesArr[y * width + x];

            return batch % 2 == 0 ? "#3c3c3c" : "#4c4c4c";
            return value < -3 || value == 1 || angle > 2 * Math.PI ? "#3c3c3c" : "";
        },
    });
}
