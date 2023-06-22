import { generateLinesFromShape } from "./geometry";
import { splitGeometry } from "./split";
import { calculateLineIntersections } from "./intersection";
import { debug } from "$debug/visual";
import { Bounds } from "./bounds";
import { Vec2 } from "$util/vector";
import { profile } from "$components/Timing.svelte";
import { Compare } from "$util/comparison";

const TOLERANCE = 0.000001;
type Direction = "up" | "down" | "on";

export type UnionShape = BoundShape & {
    interior: boolean[];
    deleted?: boolean;
};

export function unionGeometry(inGeometry: Shape[]) {
    const splitResult = splitGeometry(inGeometry);

    type CPUUnionShape = UnionShape & {
        deletedNodes: Set<number>;
    };

    profile.start("Calculate.Union");
    let geometry = splitResult.geometry as CPUUnionShape[];

    function removeInsidePoints(shapeA: CPUUnionShape, shapeB: CPUUnionShape) {
        // TODO Make this smarter, only looking at points after intersections

        for (let k = shapeA.contour!.length - 1; k >= 0; k--) {
            let point = shapeA.nodes[shapeA.contour![k]];

            if (isNodeInsidePolygon2(point, shapeB)) {
                shapeA.deletedNodes.add(k);
            } else {
            }
        }
    }

    geometry.forEach((shape) => {
        shape.deletedNodes = new Set<number>();
    });

    profile.start("Calculate.Union.Find Interior Points");
    // Mark points inside other shapes for deletion
    for (let i = 0; i < geometry.length; i++) {
        const shapeA = geometry[i];
        for (let j = i + 1; j < geometry.length; j++) {
            const shapeB = geometry[j];
            if (i === j) continue;

            if (!Bounds.collides(shapeA.bounds, shapeB.bounds)) {
                continue;
            }
            removeInsidePoints(shapeA, shapeB);
            removeInsidePoints(shapeB, shapeA);
        }
    }
    profile.end("Calculate.Union.Find Interior Points");

    // Remove deleted points
    profile.start("Calculate.Union.Remove Interior");
    geometry.forEach((shape, shapeIndex) => {
        shape.interior = new Array(shape.contour!.length).fill(false);
        shape.deletedNodes.forEach((i) => {
            shape.interior[(i - 1 + shape.contour!.length) % shape.contour!.length] = true;
        });

        for (let i = shape.contour!.length - 1; i >= 0; i--) {
            if (shape.deletedNodes.has(i)) {
                shape.interior.splice(i, 1);
                shape.contour!.splice(i, 1);
            }
        }
    });
    profile.end("Calculate.Union.Remove Interior");

    // Join shapes
    let outGeometry: Shape[] = [];
    outGeometry = joinShapes(geometry);

    profile.end("Calculate.Union");
    return outGeometry;
}

export function joinShapes(geometry: UnionShape[]) {
    profile.start("Calculate.Union.Join Shapes");


    for (let i = 0; i < geometry.length; i++) {
        const shapeA = geometry[i];
        for (let j = i + 1; j < geometry.length; j++) {

            const shapeB = geometry[j];
            if (i === j) continue;
            if (shapeA.deleted || shapeB.deleted) continue;

            if (!Bounds.collides(shapeA.bounds, shapeB.bounds)) {
                continue;
            }
            merge: for (let k = 0; ; k++) {
                if (k >= shapeA.contour!.length) break;

                let point = shapeA.nodes[shapeA.contour![k]];

                for (let l = 0; l < shapeB.contour!.length; l++) {
                    if (l >= shapeB.contour!.length) break;

                    let pointB = shapeB.nodes[shapeB.contour![l]];

                    if (!Vec2.isEqual(point, pointB)) continue;

                    let aLen = shapeA.contour!.length;
                    let bLen = shapeB.contour!.length;
                    function getNode(shape: UnionShape, i: number) {
                        return shape.nodes[shape.contour![i]];
                    }

                    function getNodeMod(shape: UnionShape, i: number) {
                        return shape.nodes[
                            shape.contour![(i + shape.contour!.length) % shape.contour!.length]
                        ];
                    }

                    function getInteriorMod(shape: UnionShape, i: number) {
                        return shape.interior[(i + shape.contour!.length) % shape.contour!.length];
                    }

                    let aStart = k;
                    if (!getInteriorMod(shapeA, k)) {
                        if (getInteriorMod(shapeA, k - 1)) {
                            aStart = (k - 1 + aLen) % aLen;
                        } else if (getInteriorMod(shapeA, k + 1)) {
                            aStart = (k + 1) % aLen;
                        }
                    }
                    let aEnd = (aStart + 1) % aLen;

                    let bStart = (l - 1 + bLen) % bLen;
                    if (
                        !getInteriorMod(shapeB, l - 1) &&
                        !Vec2.isEqual(getNodeMod(shapeB, l - 1), getNode(shapeA, aEnd))
                    ) {
                        bStart = l;
                    }
                    let bEnd = (bStart + 1) % bLen;

                    let aStartNode = getNode(shapeA, aStart);
                    let aEndNode = getNode(shapeA, aEnd);
                    let bStartNode = getNode(shapeB, bStart);
                    let bEndNode = getNode(shapeB, bEnd);

                    let linesEqual = Vec2.isEqual(aEndNode, bStartNode);
                    let linesOffset = Vec2.isEqual(aStartNode, bEndNode) ? 0 : 1;

                    const offset = shapeB.nodes.length;
                    shapeB.nodes = shapeB.nodes.concat(shapeA.nodes);

                    let newContour: number[] = [];
                    let newInterior: boolean[] = [];
                    let removeCount = linesEqual && !linesOffset ? 2 : 1;
                    if (aLen >= removeCount) {
                        newContour = new Array(aLen - removeCount);
                        newInterior = new Array(aLen - removeCount);
                        for (let m = 0; m < aLen - removeCount; m++) {
                            let index = (m + aStart + linesOffset + removeCount) % aLen;
                            newContour[m] = shapeA.contour![index] + offset;
                            newInterior[m] = shapeA.interior[index];
                        }
                    }

                    shapeB.contour!.splice(bStart + 1, 0, ...newContour);
                    shapeB.interior!.splice(bStart + 1, 0, ...newInterior);

                    shapeB.bounds = Bounds.join(shapeA, shapeB);
                    shapeA.deleted = true;
                    break merge;
                }
            }
        }
    }

    geometry = geometry.filter((shape) => !shape.deleted);
    profile.end("Calculate.Union.Join Shapes");

    profile.start("Calculate.Union.Merge Edges");
    for (let shape of geometry) {
        joinInternal(shape);
    }
    profile.end("Calculate.Union.Merge Edges");

    return geometry;
}

function joinInternal(shape: UnionShape, parent: UnionShape = shape) {
    let dbgHole = shape !== parent;

    let minX = Infinity;
    let minXIndex = -1;
    for (let i = 0; i < shape.contour!.length; ++i) {
        let node = shape.nodes[shape.contour![i]];
        if (node.x < minX) {
            minX = node.x;
            minXIndex = i;
        }
    }

    // move minX to the front, rotating the array
    if (minXIndex !== -1) {
        shape.contour!.push(...shape.contour!.splice(0, minXIndex));
        shape.interior!.push(...shape.interior!.splice(0, minXIndex));
    }

    const contour = shape.contour!;

    let interior = [...Array(contour.length).keys()].filter(
        (index) => shape.interior[index as any]
    );

    // find first interior node
    // check if it collides with another node after an other interior node
    // if so, join them
    for (let i = interior.length - 1; i >= 0; --i) {
        let nodeA = shape.nodes[contour[interior[i]]];

        for (let j = i + 1; j < interior.length; ++j) {
            let nodeB = shape.nodes[contour[(interior[j] + 1) % contour.length]];
            if (!Vec2.isEqual(nodeA, nodeB)) continue;

            let nextA = shape.nodes[contour[(interior[i] + 1) % contour.length]];
            let prevB = shape.nodes[contour[interior[j] % contour.length]];
            if (Vec2.isEqual(nextA, prevB)) {
                let start = interior[i];
                let end = interior[j];
                let count = end - start + 1;

                // debug.node(nodeA, { color: "violet" });
                // debug.node(nodeB, { color: "violet" });

                // TODO Check speed
                let holeContour = contour.splice(start, count);
                let holeInterior = interior.splice(i, j - i);
                interior = interior.map((i) => (i > start ? i - count : i));

                let hole = holeContour.map((index) => shape.nodes[index]).slice(1, -1);
                if (!parent.holes) parent.holes = [];
                if (hole.length > 0) {
                    // if (debug.bool("recursive") && !dbgHole) {
                    //     let cont = [...Array(hole.length).keys()];
                    //     let int = cont.map(() => false);
                    //     for (let i = 0; i < holeInterior.length; ++i) {
                    //         int[holeInterior[i] - start] = true;
                    //     }
                    //     const holeShape = {
                    //         nodes: hole,
                    //         contour: cont,
                    //         interior: int,
                    //     };
                    //     joinInternal(Bounds.create(holeShape), parent);
                    //     if (holeShape.contour.length > 0) {
                    //         parent.holes.push(
                    //             holeShape.contour.map((index) => holeShape.nodes[index])
                    //         );
                    //     }
                    // } else {
                    parent.holes.push(hole);
                    // }
                }
            } else {
                let start = interior[i];
                let end = interior[j] + 1;
                const count = end - start + 1;

                let holeContour = contour.splice(start, count);
                let holeInterior = interior.splice(i, j - i);
                interior = interior.map((i) => (i > start ? i - count : i));

                let hole = holeContour.map((index) => shape.nodes[index]).slice(1, -1);
                if (!parent.holes) parent.holes = [];
                if (hole.length > 0) {
                    // if (debug.bool("recursive") && !dbgHole) {
                    //     let cont = [...Array(hole.length).keys()];
                    //     let int = cont.map(() => false);
                    //     for (let i = 0; i < holeInterior.length; ++i) {
                    //         int[holeInterior[i] - start] = true;
                    //     }
                    //     const holeShape = {
                    //         nodes: hole,
                    //         contour: cont,
                    //         interior: int,
                    //     };
                    //     joinInternal(Bounds.create(holeShape), parent);
                    //     if (holeShape.contour.length > 0) {
                    //         parent.holes.push(
                    //             holeShape.contour.map((index) => holeShape.nodes[index])
                    //         );
                    //     }
                    // } else {
                    parent.holes.push(hole);
                    // }
                }
                // newShapes.push({ nodes: hole });
            }
            break;
        }
    }
}

//

function findLast(targetLine: Line, lines: Line[]): Direction {
    const y = targetLine.start.y;
    for (let i = 0; i > -lines.length; --i) {
        const line = lines.at(i) as Line;

        if (line.end.y <= y + TOLERANCE && line.start.y < y - TOLERANCE) {
            return "down";
        } else if (line.end.y >= y - TOLERANCE && line.start.y > y + TOLERANCE) {
            return "up";
        }
    }

    return "on";
}

function endPointLocation(targetLine: Line, line: Line): Direction {
    const { start: _startA, end: endA } = line;
    const { start: _startB, end: endB } = targetLine;

    if (Math.abs(endA.y - endB.y) <= TOLERANCE) {
        return "on";
    } else if (endA.y < endB.y) {
        return "down";
    } else {
        return "up";
    }
}

export function isNodeInsidePolygon(point: Vec2, shape: Shape, dbg = false) {
    const lines = generateLinesFromShape(shape) as Line[];

    const targetLine = {
        start: point,
        end: {
            x: shape.nodes.reduce((max, node) => Math.max(max, node.x), -Infinity) + 1,
            y: point.y,
        },
    } as Line;

    let winding = 0;
    let position: Direction = findLast(targetLine, lines);
    let wasOn = false;

    // if (dbg) {
    // console.log(position, point);
    // console.log(structuredClone(lines.slice(1)));
    // }

    for (let line of lines.slice(1)) {
        /* if (isEqual(line.start.y, point.y)) {
            line.start.y += 2 * TOLERANCE;
        }
        if (isEqual(line.end.y, point.y)) {
            line.end.y += 2 * TOLERANCE;
        } */
        const result = calculateLineIntersections(targetLine, line); // TODO: This function is not reliable

        if (result.length > 0) {
            let target = result[0].position;
            // if (dbg) {
            //     debug.node(target, { color: "orange" });
            // }
            if (Vec2.isEqual(target, point)) {
                return false;
            }

            const newPosition = endPointLocation(targetLine, line);

            if (newPosition === "on" || newPosition === position) {
                if (dbg) {
                    console.log("\tSearching: ", line);
                    // console.log("\t", newPosition, position);
                }
                wasOn = true;
                continue;
            } else if (newPosition === "up") {
                //  && position === "down"
                if (dbg) {
                    console.log("\tWinding up: ", line);
                }

                ++winding;
            } else if (newPosition === "down") {
                //  && position === "up"
                if (dbg) {
                    console.log("\tWinding down: ", line);
                }
                --winding;
            }

            position = newPosition;
        }
    }

    if (dbg) {
        console.log("Winding is " + winding);
    }

    // return winding % 2 === 1;
    return winding !== 0;
}

function isNodeInsidePolygon2(point: Vec2, shape: Shape) {
    function isInRange(value: number, min: number, max: number) {
        return Compare.greaterOrEqual(value, min) && Compare.lessOrEqual(value, max);
    }

    function isOnLine(point: Vec2, line: Line) {
        let { start, end } = line;

        let v1 = Vec2.sub(end, start);
        let v2 = Vec2.sub(point, start);

        let cross = Vec2.cross(v1, v2);
        let dot = Vec2.dot(v1, v2) / Vec2.dot(v1, v1);

        return {
            result: isInRange(dot, 0, 1) && Compare.zero(cross),
            value: dot,
        };
    }

    const offset = 0.001;
    function intersects(ray: Line, line: Line) {
        let p1 = ray.start;
        let p2 = ray.end;
        let p3 = { ...line.start };
        let p4 = { ...line.end };

        let p1OnLine = isOnLine(p1, ray);
        if (isOnLine(p1, line).result) {
            return {
                a: 0,
                b: p1OnLine.value,
            };
        }

        if (Compare.equal(p1.y, p3.y)) {
            p3.y += offset;
        }

        if (Compare.equal(p1.y, p4.y)) {
            p4.y += offset;
        }

        let p13 = Vec2.sub(p1, p3);
        let p43 = Vec2.sub(p4, p3);
        let p21 = Vec2.sub(p2, p1);

        let d1343 = Vec2.dot(p13, p43);
        let d4321 = Vec2.dot(p43, p21);
        let d1321 = Vec2.dot(p13, p21);
        let d4343 = Vec2.dot(p43, p43);
        let d2121 = Vec2.dot(p21, p21);

        let denom = d2121 * d4343 - d4321 * d4321;
        if (Compare.zero(denom)) {
            return {
                a: -10,
                b: -10,
            };
        }
        let numer = d1343 * d4321 - d1321 * d4343;

        var mua = numer / denom;
        var mub = (d1343 + d4321 * mua) / d4343;

        let pa = Vec2.add(p1, Vec2.scale(p21, mua));
        let pb = Vec2.add(p3, Vec2.scale(p43, mub));

        let result = Vec2.sub(pa, pb);

        let valid_a = isInRange(mua, 0.0, 1.0);
        let valid_b = isInRange(mub, 0.0, 1.0);
        let valid_r = Compare.zero(Vec2.dot(result, result));

        if (valid_a && valid_b && valid_r) {
            return {
                a: mua,
                b: mub,
                valid: true,
            };
        }
        return {
            a: mua,
            b: mub,
        };
    }

    const lines = generateLinesFromShape(shape);

    const ray = {
        start: point,
        end: {
            x: lines.reduce((max, { end }) => Math.max(max, end.x), -Infinity) + 1,
            y: point.y,
        },
    } as Line;

    let winding = 0;
    for (let line of lines) {
        let int = intersects(ray, line);
        if (Compare.zero(int.a) && isInRange(int.b, 0, 1)) {
            winding = -2;

            // dbg &&
            //     debug.node(line.start, {
            //         text: int.a.toFixed(2) + ", " + int.b.toFixed(2),
            //         color: "green",
            //     });
            break;
        }

        if (int.valid) {
            winding += 1;
        }

        // if (dbg) {
        //     debug.node(line.start, {
        //         text: int.a.toFixed(2) + ", " + int.b.toFixed(2),
        //         color: "red",
        //     });
        //     debug.node(Vec2.add(line.start, Vec2.scale(Vec2.sub(line.end, line.start), 0.1)), {
        //         color: "red",
        //     });
        // }
    }

    // dbg && debug.node(ray.start, {});

    // dbg &&
    //     debug.node(ray.end, {
    //         text: "Wind: " + winding + "",
    //         color: "violet",
    //     });

    // dbg &&
    //     debug.node(Vec2.add(ray.end, { x: 0, y: 0.25 }), {
    //         text: "",
    //         color: "violet",
    //     });

    return winding % 2 === 1;
}
