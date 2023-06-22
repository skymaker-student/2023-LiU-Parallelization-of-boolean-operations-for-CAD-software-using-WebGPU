import { CAD } from "$skymaker";
import { grid, square } from "$skymaker/geometry";
//
type GeometryGenerator = {
    (options?: any): Geometry;
};

type GeneratorMap = Record<string, GeometryGenerator>;
export type DebugFunctions = keyof typeof geometryMap;

export function debugGeometryTypes(): DebugFunctions[] {
    return Object.keys(geometryMap) as DebugFunctions[];
}

export function debugGeometry(name: DebugFunctions, options: any = undefined) {
    return (geometryMap[name] as GeometryGenerator)(options);
}

const geometryMap = {
    hole,
    hole2,
    grid3,
    grid4,
    stacked,
    gridInverse,
    square1,
    square2,
    square4,
    square2_overlap,
    parallel,
    parallelUnion,
    polygon,
    brokenCPU,
    random10error,
    unionSelfJoin,
} as const satisfies GeneratorMap;

function hole() {
    return [
        CAD.generateRectangleShape(0, 0, 5, 1),
        CAD.generateRectangleShape(0, 0, 1, 5),
        CAD.generateRectangleShape(0, 4, 5, 1),
        CAD.generateRectangleShape(4, 0, 1, 5),
    ];
}

function hole2() {
    return [cgrid(1, 0), cgrid(3, 0), cgrid(2, 1), cgrid(2.5, -2)];
}

function grid3() {
    return [square({ x: 3, y: 1 }), square({ x: 0, y: 0 }), square({ x: 4, y: -1 })];
}

function grid4() {
    return [
        square({ x: 3, y: 1 }),
        square({ x: 0, y: 0 }),
        square({ x: 4, y: -1 }),
        square({ x: 1, y: -3 }),
    ];
}

function gridInverse() {
    return [
        square({ x: 0, y: 0 }),
        {
            nodes: [
                { x: -1.5, y: -1.5 },
                { x: -1.5, y: 1.5 },
                { x: 1.5, y: 1.5 },
                { x: 1.5, y: -1.5 },
            ],
            contour: [0, 1, 2, 3],
        },
        {
            nodes: [
                { x: -1, y: -1 },
                { x: 1, y: -1 },
                { x: 1, y: 1 },
                { x: -1, y: 1 },
            ],
            contour: [0, 1, 2, 3],
        },
    ];
}

function stacked() {
    return [
        // CAD.generateRectangleShape(0, -4, 4, 4),

        CAD.generateRectangleShape(0, 0, 4, 4),
        CAD.generateRectangleShape(0, 2, 4, 4),
        // CAD.generateRectangleShape(4, 2, 4, 4),
        CAD.generateRectangleShape(2, 3, 4, 4),

        // CAD.generateRectangleShape(2, 3, 4, 4),
        //CAD.generateRectangleShape(0, 8, 4, 4),
        //CAD.generateRectangleShape(2, -6, 4, 12),
    ];
}

function square1() {
    return [square({ x: 0, y: 0 })];
}

function square2() {
    return [square({ x: 0, y: 0 }), square({ x: 6, y: 1 })];
}

function square4() {
    return [
        square({ x: 0, y: 0 }),
        square({ x: 6, y: 1 }),
        square({ x: 0, y: 6 }),
        square({ x: 6, y: 7 }),
    ];
}

function square2_overlap() {
    return [square({ x: 0, y: 0 }), square({ x: 3, y: 3 })];
}

function parallel() {
    return [cgrid(0, 0), cgrid(3, 0)];
}

function cgrid(x: number, y: number) {
    return square(grid({ x, y }));
}

function parallelUnion() {
    return [cgrid(0, 0), cgrid(1, 0), cgrid(3, 0)];
}

function polygon() {
    return [
        {
            nodes: [
                { x: 1, y: 0 },
                { x: 2, y: 0 },
                { x: 2, y: -2 },
                { x: 3, y: -2 },
                { x: 3, y: 2 },
                { x: 1, y: 2 },
            ],
            holes: [],
        },
        {
            nodes: [
                { x: -2, y: 0 },
                { x: -1, y: 0 },
                { x: -1, y: 1 },
                { x: -2, y: 1 },
            ],
            holes: [],
        },
        {
            nodes: [
                { x: 2.5, y: 0.5 },
                { x: 4, y: 0.5 },
                { x: 4, y: 1.5 },
                { x: 2.5, y: 1.5 },
            ],
            holes: [],
        },
    ];
}

export function brokenCPU() {
    return [
        square({ x: 0, y: 0 }),
        square({ x: 4, y: -4 }),
        square({ x: 0, y: -8 }),
        square({ x: 0, y: 10 }),
    ];
}

function random10error() {
    return [
        {
            nodes: [
                { x: 3.7912624285475003, y: 2.8726304054703844 },
                { x: 6.575781110279058, y: 2.971876220169362 },
                { x: 6.551374241291894, y: 6.0718769039463965 },
                { x: 3.839874957539025, y: 5.346595214420553 },
            ],
            contour: [0, 1, 2, 3],
        },

        {
            nodes: [
                { x: 6.918938564992453, y: 2.850454636477357 },
                { x: 9.158929424042748, y: 3.123163531416248 },
                { x: 9.740534320697686, y: 5.410329996291855 },
                { x: 5.633745751375096, y: 6.0851592506609474 },
            ],
            contour: [0, 1, 2, 3],
        },
    ];
}

function unionSelfJoin() {
    return [
        square({ x: 0, y: 0 }), 
        square({ x: 2, y: 2 }),
        square({ x: 1, y: -2 }),
        square({ x: 3, y: 1 }),
        square({ x: 4.5, y: -3 }),
        square({ x: 5.25, y: 1.5 }),
    ];
}
