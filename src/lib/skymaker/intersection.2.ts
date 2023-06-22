import { Compare } from "$util/comparison";
import { generateLinesFromShape } from "./geometry";

const DECIMALS_FOR_CHECK = 9;

export function calculateShapeIntersections(listOfGeometry: Geometry) {
    // const intersectionMap: { contourIndex: number; s: number }[] = [];

    const N = listOfGeometry.length;
    const intersectionMap = new Array(listOfGeometry.length)
        .fill(undefined)
        .map(() => [] as { contourIndex: number; s: number }[]);

    let shapeIntersections: { shapeIndexA: number; shapeIndexB: number }[] = [];

    listOfGeometry.forEach((shapeA, shapeIndexA) => {
        const linesA = generateLinesFromShape(shapeA);
        linesA.forEach((lineA, lineIndexA) => {
            for (let shapeIndexB = shapeIndexA + 1; shapeIndexB < N; shapeIndexB++) {
                const shapeB = listOfGeometry[shapeIndexB];
                const linesB = generateLinesFromShape(shapeB);

                // Check all lines of A with all lines of B
                linesB.forEach((lineB, lineIndexB) => {
                    const intersections = calculateLineIntersections(lineA, lineB);
                    const lastIntersection = shapeIntersections.at(-1);
                    // if (shapeIndexA == 0 && shapeIndexB == 65) {
                    //     console.log(lineIndexA, lineIndexB, intersections);
                    // }
                    if (
                        intersections.length > 0 &&
                        (shapeIntersections.length === 0 ||
                            lastIntersection.shapeIndexA < shapeIndexA ||
                            lastIntersection.shapeIndexB < shapeIndexB)
                    ) {
                        shapeIntersections.push({ shapeIndexA, shapeIndexB });
                    }
                    intersections.forEach((solution) => {
                        const strictInsideA =
                            Compare.greater(solution.sA, 0) && Compare.less(solution.sA, 1);
                        if (strictInsideA) {
                            const solutionsA = intersectionMap[shapeIndexA];
                            solutionsA.push({
                                contourIndex: lineIndexA,
                                s: solution.sA,
                            });
                        }

                        const strictInsideB =
                            Compare.greater(solution.sA, 0) && Compare.less(solution.sA, 1);
                        if (strictInsideB) {
                            const solutionsB = intersectionMap[shapeIndexB];
                            solutionsB.push({
                                contourIndex: lineIndexB,
                                s: solution.sB,
                            });
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
            const a = result[i].s;
            const b = result[i - 1].s;
            const removeDuplicate = Compare.equal(a, b);
            if (removeDuplicate) {
                result.splice(i, 1);
            }
        }
    });

    // console.log(structuredClone(shapeIntersections));
    // console.log(structuredClone(intersectionMap));

    return { intersectionMap, shapeIntersections };
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
