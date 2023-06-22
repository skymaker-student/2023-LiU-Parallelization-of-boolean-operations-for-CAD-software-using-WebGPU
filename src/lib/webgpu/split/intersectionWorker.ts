import { TOLERANCE } from "../common/constants";
import type { UniIntersection } from "./lineIntesection";

onmessage = (e) => {
    let { start, end, result, width, height, lineToShape, shapeToIndex } = e.data;

    let intersections = processRows(
        start,
        end,
        result,
        { width, height },
        lineToShape,
        shapeToIndex
    );

    postMessage(intersections);
};

function processRows(
    start: number,
    end: number,
    result: Float32Array,
    { width, height }: { width: number; height: number },
    lineToShape: Uint16Array,
    shapeToIndex: Uint16Array
) {
    let intersections: UniIntersection[] = [];

    function leftSide(y: number) {
        if (width % 2 === 0 && y === height - 1) return [];

        let line = width - 2 - y;

        for (let x = 0; x < y + 1; x++) {
            let targetLine = width - 1 - x;
            process(x, y, line, targetLine);
        }
    }

    function rightSide(y: number) {
        let line = y;

        for (let x = y + 1; x < width; x++) {
            let targetLine = x;
            process(x, y, line, targetLine);
        }
    }

    function process(x: number, y: number, lineA: number, lineB: number) {
        let shapeA = lineToShape[lineA];
        let shapeB = lineToShape[lineB];

        let index = (y * width + x) * 2;

        let dataA = result[index];
        let dataB = result[index + 1];

        if (dataA < TOLERANCE || dataA > 1.0 - TOLERANCE) return;

        intersections.push(
            {
                shapeIndex: shapeA,
                neighborShapeIndex: shapeB,
                neighborIndex: lineB - (shapeToIndex[shapeB - 1] ?? 0),
                contourIndex: lineA - (shapeToIndex[shapeA - 1] ?? 0),
                s: dataA,
            },
            {
                shapeIndex: shapeB,
                neighborShapeIndex: shapeA,
                neighborIndex: lineA - (shapeToIndex[shapeA - 1] ?? 0),
                contourIndex: lineB - (shapeToIndex[shapeB - 1] ?? 0),
                s: dataB,
            }
        );
    }

    console.time(`process ${start} - ${end}`);
    for (let y = start; y < end; y++) {
        leftSide(y);
        rightSide(y);
    }
    console.timeEnd(`process ${start} - ${end}`);

    return intersections;
}

export {};
