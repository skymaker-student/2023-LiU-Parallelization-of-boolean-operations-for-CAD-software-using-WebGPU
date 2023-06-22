import { TOLERANCE } from "$webgpu/common/constants";
import { create } from "./lineIntesection";

let calculateShapeIntersections: Awaited<ReturnType<typeof create>>["CalculateShapeIntersections"];

export async function splitGeometry(_listOfGeometry: Geometry, useWorkers = false) {
    if (!calculateShapeIntersections) {
        calculateShapeIntersections = (await create()).calculateShapeIntersections;
    }

    const geometry = structuredClone(_listOfGeometry) as typeof _listOfGeometry;

    const { intersectionMap, inputBuffer } = await calculateShapeIntersections(
        geometry,
        useWorkers
    );

    let intersectionMapSorted = intersectionMap.map((intersections, j) => {
        return [...Array(intersections.length).keys()];
    });

    intersectionMapSorted.forEach((result, i) => {
        result.sort((a, b) => {
            const l = intersectionMap[i][a];
            const r = intersectionMap[i][b];
            if (l.contourIndex !== r.contourIndex) {
                return r.contourIndex - l.contourIndex;
            }
            return r.s - l.s;
        });
    });

    intersectionMapSorted.forEach((intersectionsIndices, shapeIndex) => {
        const shape = geometry[shapeIndex];

        let lastLine: Line;
        let lastLineIndex: number;

        intersectionsIndices.forEach((ii) => {
            let intersection = intersectionMap[shapeIndex][ii];

            if (intersection.s <= TOLERANCE || intersection.s >= 1.0 - TOLERANCE) return;

            const index = intersection.contourIndex;
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
                x: start.x * (1 - intersection.s) + end.x * intersection.s,
                y: start.y * (1 - intersection.s) + end.y * intersection.s,
            };
            const newNodeIndex = shape.nodes.length;
            shape.nodes.push(p);
            shape.contour!.splice(index + 1, 0, newNodeIndex);
        });
    });

    return { geometry, intersectionMap, intersectionMapSorted, inputBuffer };
}
