import { packPolygonShapes, DEBUG, type ShapePack } from ".";
import {
    buildNewShapesBatched,
    buildPyramidBatched,
    extractNewShapesBatched,
    segmentLinesBatched,
    type ExtractedShapes,
} from "./gpu/batch";
import { formatNewShapes, type BindGroups } from "./union";
import { profile } from "$components/Timing.svelte";
import { bindGroups, createLayerSize, type LayerSize } from "./gpu/shaders/bindGroup";
import { getDevice } from "$util/gpuCommon";

export async function split(geometry: Geometry, useWorkers = false) {
    if (geometry.length <= 1) {
        return geometry;
    }

    await getDevice();
    profile.start("GPU.Upload");

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

    await profile.end("GPU.Upload", true);

    console.log(
        `%cStarting ${batches} batches ${JSON.stringify({ width, height })}`,
        "font-weight: bold;"
    );
    for (let i = 0; i < batches; i++) {
        console.log(`%cStarting batch ${i + 1}/${batches}`, "font-weight: bold;");
        console.time("batch " + i);
        DEBUG && console.log(`batch ${i + 1}/${batches}`);

        profile.start(`${i} GPU.Update Batch`);
        batchInfo.startBatch(i);
        await profile.end(`${i} GPU.Update Batch`, true);

        profile.start(`${i} GPU.Segment Lines`);
        await segmentLinesBatched(groups);
        await profile.end(`${i} GPU.Segment Lines`, true);

        // await groups.pyramidBase.debug(SEGMENT_LINES);
        profile.start(`${i} GPU.Build Segment Pyramid`);
        await buildPyramidBatched(groups, "Segment");
        await profile.end(`${i} GPU.Build Segment Pyramid`, true);

        // profile.start(`${i} GPU.Filter`);
        // await filterSegmentsBatched(groups);
        // await profile.end(`${i} GPU.Filter`, true);

        // DEBUG && (await groups.pyramidBase.debugBases(FILTER_PYRAMID, batches));
        // profile.start(`${i} GPU.Build Filter Pyramid`);
        // await buildPyramidBatched(groups, "Filter");
        // await profile.end(`${i} GPU.Build Filter Pyramid`, true);

        DEBUG && (await groups.pyramidBase.debugBases("Build pyramid", batches));

        profile.start(`${i} GPU.Allocate Output`);
        groups.shapeOutput = await bindGroups.shapeOutput(base);
        await profile.end(`${i} GPU.Allocate Output`, true);

        profile.start(`${i} GPU.Build New Shapes`);
        await buildNewShapesBatched(groups);
        await profile.end(`${i} GPU.Build New Shapes`, true);

        profile.start(`${i} GPU.Extract New Shapes`);
        output = await extractNewShapesBatched(groups, output);
        await profile.end(`${i} GPU.Extract New Shapes`, true);

        outputSize[i] = output.info.length;

        console.timeEnd("batch " + i);
    }

    // console.table(
    //     output?.points.zip(output.info).map(([point, info], index) => ({
    //         ...point,
    //         ...info,
    //         index: outputSize.findIndex((size) => index < size),
    //     }))
    // );
    console.time("format new shapes");
    let newGeometry: Geometry = await formatNewShapes(output!);
    console.timeEnd("format new shapes");
    // console.log({ length: newGeometry.length });
    return newGeometry;
}

async function createSplitShape() {}
