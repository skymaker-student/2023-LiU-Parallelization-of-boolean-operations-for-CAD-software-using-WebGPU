import { calculateShapeIntersections } from "./intersection";
import { Bounds } from "./bounds";
import { addDebugPoint, debugClear } from "$debug/visual";
import { profile } from "$components/Timing.svelte";

export function splitGeometry(_listOfGeometry: Geometry) {
    profile.start("Calculate.Split");
    const clonedGeometry = structuredClone(_listOfGeometry) as BoundShape[];
    for (let i = 0; i < clonedGeometry.length; i++) {
        const shape = clonedGeometry[i];
        Bounds.create(shape);
    }

    profile.start("Calculate.Split.Intersections");
    const intersectionMap = calculateShapeIntersections(clonedGeometry);
    profile.end("Calculate.Split.Intersections");

    profile.start("Calculate.Split.Sort");
    intersectionMap.forEach((result) => {
        result.sort((a, b) => {
            if (a.contourIndex !== b.contourIndex) {
                return b.contourIndex - a.contourIndex;
            }
            return b.s - a.s;
        });
    });
    profile.end("Calculate.Split.Sort");

    const sValuesMap: Map<Vec2, number> = new Map();

    profile.start("Calculate.Split.Insert");
    intersectionMap.forEach((intersections, shape) => {
        let lastLine: Line;
        let lastLineIndex: number;

        intersections.forEach((it) => {
            const index = it.contourIndex;
            let start = shape.nodes[shape.contour![index]];
            let end = shape.nodes[shape.contour![index + 1] ?? shape.contour![0]];

            if (lastLineIndex === index) {
                start = lastLine.start;
                end = lastLine.end;
            } else {
                lastLineIndex = index;
                lastLine = { start, end };
            }

            const p = {
                x: start.x * (1 - it.s) + end.x * it.s,
                y: start.y * (1 - it.s) + end.y * it.s,
            };
            sValuesMap.set(p, it.s);
            const newNodeIndex = shape.nodes.length;
            shape.nodes.push(p);
            shape.contour!.splice(index + 1, 0, newNodeIndex);
        });
    });
    profile.end("Calculate.Split.Insert");

    // console.log(clonedGeometry);

    profile.end("Calculate.Split");
    return { geometry: clonedGeometry, sValuesMap };
}
