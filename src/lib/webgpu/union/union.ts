import { get } from "svelte/store";

import { debug } from "$debug/visual";

import type { Intersection } from "$webgpu/split/lineIntesection";
import { splitGeometry } from "$webgpu/split/split";
import { TOLERANCE } from "$webgpu/common/constants";
import { create } from "./unionGuidanceGPU";
import { profile } from "$components/Timing.svelte";

import { joinShapes, type UnionShape } from "$skymaker/union";
import { Bounds } from "$skymaker/bounds";

type UnionIntersection = Intersection & {
    isInside: boolean;
    shape: number;
};

let calculateUnionGuidance: Awaited<ReturnType<typeof create>>["calculateUnionGuidance"];

export async function unionGeometry(listOfGeometry: Geometry) {
    const { geometry, intersectionMap, intersectionMapSorted, inputBuffer } = await splitGeometry(
        listOfGeometry
    ); // TODO change this to sequential

    if (!calculateUnionGuidance) {
        calculateUnionGuidance = (await create()).calculateUnionGuidance;
    }

    profile.start("Calculate.Union");
    intersectionMapSorted.forEach((intersectionIndices, j) => {
        let inserted = 1;
        for (let i = intersectionIndices.length - 1; i >= 0; --i) {
            const intersectionIndex = intersectionIndices[i];
            const intersection = intersectionMap[j][intersectionIndex];

            // console.log(j, intersectionMap[j][intersectionIndex].contourIndex);

            intersectionMap[j][intersectionIndex].contourIndex += inserted;

            // console.log(j, intersectionMap[j][intersectionIndex].contourIndex);

            if (intersection.s >= TOLERANCE && intersection.s <= 1.0 - TOLERANCE) {
                ++inserted;
            } else {
                intersectionMap[j][intersectionIndex].contourIndex -= 1;
            }
        }
    });

    const shapeLengths = listOfGeometry.map((shape) => shape.contour!.length);


    const intersectionCount = intersectionMap
        .map((intersections) => intersections.length)
        .reduce((acc, i) => acc + i, 0);

    let newIntersections: UnionIntersection[][];

    if (intersectionCount > 0) {
        const res = await calculateUnionGuidance(
            geometry,
            intersectionMap,
            inputBuffer,
            shapeLengths
        );
        newIntersections = res.newIntersections as UnionIntersection[][];
    } else {
        newIntersections = intersectionMap as UnionIntersection[][];
    }

    // Remove points inside other shapes
    profile.start("Calculate.Union.Remove Interior");
    for (let i = 0; i < geometry.length; i++) {
        const shape = geometry[i] as UnionShape;
        shape.interior = new Array(shape.contour!.length).fill(false);

        const intersections = newIntersections[i].sort(
            (a, b) => b.contourIndex + b.s / 2 - (a.contourIndex + a.s / 2)
        );

        function splice(index: number) {
            shape.interior[(index - 1 + shape.interior.length) % shape.interior.length] = true;
            shape.contour!.splice(index, 1);
            shape.interior.splice(index, 1);
        }

        for (let j = 0; j < intersections.length; j++) {
            const current = intersections[j];
            const prev = intersections[(j + 1) % intersections.length!];

            if (!prev.isInside) continue;
            if (prev.contourIndex < current.contourIndex) {
                for (
                    let k = current.contourIndex - +!current.isInside;
                    k > prev.contourIndex;
                    k--
                ) {
                    splice(k);
                }
            } else {
                for (let k = shape.contour!.length - 1; k > prev.contourIndex; k--) {
                    splice(k);
                }
                for (let k = current.contourIndex - +!current.isInside; k >= 0; k--) {
                    splice(k);
                }
            }
        }
    }
    profile.end("Calculate.Union.Remove Interior");

    geometry.forEach((shape) => Bounds.create(shape));

    const outGeometry = joinShapes(geometry as UnionShape[]);

    profile.end("Calculate.Union");

    return outGeometry;
}
