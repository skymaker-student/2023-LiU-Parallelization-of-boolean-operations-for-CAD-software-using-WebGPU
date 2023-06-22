import { generateLinesFromShape } from "./geometry";
import { Bounds } from "./bounds";
import { Compare } from "$util/comparison";

const DECIMALS_FOR_CHECK = 9;

export function calculateShapeIntersections(listOfGeometry: Geometry) {
    type Intersection = { contourIndex: number; s: number };
    const intersectionMap: Map<Shape, Intersection[]> = new Map();

    const N = listOfGeometry.length;
    listOfGeometry.forEach((shapeA, i) => {
        const linesA = generateLinesFromShape(shapeA);
        linesA.forEach((lineA, m) => {
            for (let j = i + 1; j < N; j++) {
                const shapeB = listOfGeometry[j];
                // TODO AABB check
                let lineABounds = Bounds.fromLine(lineA);
                if (!Bounds.collides(shapeB.bounds, lineABounds)) {
                    continue;
                }

                const linesB = generateLinesFromShape(shapeB);
                linesB.forEach((lineB, n) => {
                    if (!Bounds.collides(Bounds.fromLine(lineB), lineABounds)) {
                        return;
                    }
                    // TODO AABB check
                    const intersection = calculateLineIntersections(lineA, lineB);
                    intersection.forEach((solution) => {
                        const strictInsideA =
                            Compare.greater(solution.sA, 0) && Compare.less(solution.sA, 1);
                        if (strictInsideA) {
                            const solutionsA = intersectionMap.get(shapeA) ?? [];
                            solutionsA.push({ contourIndex: m, s: solution.sA });
                            intersectionMap.set(shapeA, solutionsA);
                        }

                        const strictInsideB =
                            Compare.greater(solution.sB, 0) && Compare.less(solution.sB, 1);
                        if (strictInsideB) {
                            const solutionsB = intersectionMap.get(shapeB) ?? [];
                            solutionsB.push({ contourIndex: n, s: solution.sB });
                            intersectionMap.set(shapeB, solutionsB);
                        }
                    });
                });
            }
        });
    });

    intersectionMap.forEach((result) => {
        result.sort((a, b) => a.s - b.s);
        const N = result.length;
        for (let i = N - 1; i > 0; i--) {
            if (result[i].contourIndex !== result[i - 1].contourIndex) continue;
            const a = result[i].s;
            const b = result[i - 1].s;
            const removeDuplicate = Compare.equal(a, b);
            if (removeDuplicate) {
                result.splice(i, 1);
            }
        }
    });

    return intersectionMap;
}

export function calculateLineIntersections(lineA: Line, lineB: Line) {
    const x1 = lineA.start.x;
    const y1 = lineA.start.y;
    const x2 = lineA.end.x;
    const y2 = lineA.end.y;

    const x3 = lineB.start.x;
    const y3 = lineB.start.y;
    const x4 = lineB.end.x;
    const y4 = lineB.end.y;

    const t = (y1 - y3) * (x4 - x3) - (x1 - x3) * (y4 - y3);
    const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
    if (!Compare.equal(d, 0)) {
        const delta = t / d;
        let gamma = -1;
        if (!Compare.equal(x4 - x3, 0)) {
            gamma = (delta * (x2 - x1) + x1 - x3) / (x4 - x3);
        } else if (!Compare.equal(y4 - y3, 0)) {
            gamma = (delta * (y2 - y1) + y1 - y3) / (y4 - y3);
        } else {
            return []; // Invalid calculation. To short element
        }

        const p0 = { x: x2 * delta + x1 * (1 - delta), y: y2 * delta + y1 * (1 - delta) };

        const result = [{ sA: delta, sB: gamma, position: p0 }];

        const validSolutions = result.filter((item) => {
            return (
                Compare.greaterOrEqual(item.sA, 0) &&
                Compare.lessOrEqual(item.sA, 1) &&
                Compare.greaterOrEqual(item.sB, 0) &&
                Compare.lessOrEqual(item.sB, 1)
            );
        });
        return validSolutions;
    } else {
        return [];
    }
}
