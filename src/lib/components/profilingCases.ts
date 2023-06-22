import type { RenderOptions } from "./worldBuilder";
import { customCases } from "./worldBuilderCases";
import type { ProfileOptions } from "./Timing.svelte";
import { debug } from "$debug/visual";
import { unionMultiple } from "./WebGPUHistoPyramid/union";
import type { Implementation } from "components/Playground.svelte";

type ProfilingFunctions = RenderOptions["functions"];

export type ProfilingOptions = {
    name: string;
    implementation: Implementation;
    union?: boolean;
    delay?: number;
    functions?: ProfilingFunctions;
    hyperparameters?: {
        seed?: number;
        count?: number | ((count: number) => number);
        density?: number | ((count: number) => number);
        maxVertices?: number;
        maximizeVertices?: boolean;
    };
};

export const profilingOptions = [
    {
        name: "Union",
        options: [
            {
                name: "Union [CPU]",
                implementation: "cpu",
            },
            {
                name: "Union [GPU Accelerated]",
                implementation: "accelerated",
            },
            {
                name: "Union [GPU HistoPyramid] ",
                implementation: "histopyramid",
            },
            {
                name: "Union [CPU Polygon Clipping]",
                implementation: "clipping",
            },
        ],
    },
    {
        name: "Sequential Union",
        options: [
            {
                name: "Sequential Union [CPU]",
                implementation: "cpu",
                functions: customCases.sequentialUnion(2000),
            },
            {
                name: "Sequential Union [GPU HistoPyramid]",
                implementation: "histopyramid",
                functions: customCases.sequentialUnion(2000),
            },
            {
                name: "Sequential Union [GPU Accelerated]",
                implementation: "accelerated",
                functions: customCases.sequentialUnion(2000),
            },
            {
                name: "Sequential Union [Polygon Clipping]",
                implementation: "clipping",
                functions: customCases.sequentialUnion(2000),
            },
        ],
    },

    // counts: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    {
        name: "Lazy Evaluation [GPU HistoPyramid] (40 Lines)",
        graphOptions: {
            axisLabelX: "Union operations",
        },
        options: [
            {
                name: "Lazy Evaluation",
                implementation: "histopyramid",
                functions: customCases.lazyEvaluation(40),
            },
            {
                name: "Sequential Union",
                implementation: "histopyramid",
                functions: customCases.sequentialUnion(40),
            },
        ],
    },
    // counts: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100
    {
        name: "Lazy Evaluation [GPU HistoPyramid] (400 Lines)",
        graphOptions: {
            axisLabelX: "Union operations",
        },
        options: [
            {
                name: "Lazy Evaluation",
                implementation: "histopyramid",
                functions: customCases.lazyEvaluation(400),
            },
            {
                name: "Sequential Union",
                implementation: "histopyramid",
                functions: customCases.sequentialUnion(400),
            },
        ],
    },
    {
        name: "Lazy Evaluation [GPU HistoPyramid] (2000 Lines)",
        graphOptions: {
            axisLabelX: "Union operations",
        },
        options: [
            {
                name: "Lazy Evaluation",
                implementation: "histopyramid",
                functions: customCases.lazyEvaluation(2000),
            },
            {
                name: "Sequential Union",
                implementation: "histopyramid",
                functions: customCases.sequentialUnion(2000),
            },
        ],
    },
    {
        name: "Lazy Evaluation [GPU HistoPyramid] (4000 Lines)",
        graphOptions: {
            axisLabelX: "Union operations",
        },
        options: [
            {
                name: "Lazy Evaluation",
                implementation: "histopyramid",
                functions: customCases.lazyEvaluation(4000),
            },
            {
                name: "Sequential Union",
                implementation: "histopyramid",
                functions: customCases.sequentialUnion(4000),
            },
        ],
    },

    // counts: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    {
        name: "Lazy Evaluation [Polygon clipping] (40 Lines)",
        graphOptions: {
            axisLabelX: "Union operations",
        },
        options: [
            {
                name: "Lazy Evaluation",
                implementation: "clipping",
                functions: customCases.lazyEvaluation(40),
            },
            {
                name: "Sequential Union",
                implementation: "clipping",
                functions: customCases.sequentialUnion(40),
            },
        ],
    },
    // counts: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100
    {
        name: "Lazy Evaluation [Polygon clipping] (400 Lines)",
        graphOptions: {
            axisLabelX: "Union operations",
        },
        options: [
            {
                name: "Lazy Evaluation",
                implementation: "clipping",
                functions: customCases.lazyEvaluation(400),
            },
            {
                name: "Sequential Union",
                implementation: "clipping",
                functions: customCases.sequentialUnion(400),
            },
        ],
    },
    {
        name: "Lazy Evaluation [Polygon clipping] (2000 Lines)",
        graphOptions: {
            axisLabelX: "Union operations",
        },
        options: [
            {
                name: "Lazy Evaluation",
                implementation: "clipping",
                functions: customCases.lazyEvaluation(2000),
            },
            {
                name: "Sequential Union",
                implementation: "clipping",
                functions: customCases.sequentialUnion(2000),
            },
        ],
    },
    {
        name: "Lazy Evaluation [Polygon clipping] (4000 Lines)",
        graphOptions: {
            axisLabelX: "Union operations",
        },
        options: [
            {
                name: "Lazy Evaluation",
                implementation: "clipping",
                functions: customCases.lazyEvaluation(4000),
            },
            {
                name: "Sequential Union",
                implementation: "clipping",
                functions: customCases.sequentialUnion(4000),
            },
        ],
    },

    {
        name: "Radial Polygons Union",
        options: [
            {
                name: "Union [CPU]",
                implementation: "cpu",
                functions: {
                    create: customCases.randomPolygons.create,
                },
            },
            {
                name: "Union [GPU Accelerated]",
                implementation: "accelerated",
                functions: {
                    create: customCases.randomPolygons.create,
                },
            },
            {
                name: "Union [GPU HistoPyramid] ",
                implementation: "histopyramid",
                functions: {
                    create: customCases.randomPolygons.create,
                },
            },
            {
                name: "Union [CPU Polygon Clipping]",
                implementation: "clipping",
                functions: {
                    create: customCases.randomPolygons.create,
                },
            },
        ],
    },
    {
        name: "Radial Polygons Sequential Union",
        options: [
            {
                name: "Sequential Union [CPU]",
                implementation: "cpu",
                functions: {
                    create: customCases.randomPolygons.create,
                    calculate: customCases.sequentialUnion(2000).calculate,
                },
            },
            {
                name: "Sequential Union [GPU HistoPyramid]",
                implementation: "histopyramid",
                functions: {
                    create: customCases.randomPolygons.create,
                    calculate: customCases.sequentialUnion(2000).calculate,
                },
            },
            {
                name: "Sequential Union [GPU Accelerated]",
                implementation: "accelerated",
                functions: {
                    create: customCases.randomPolygons.create,
                    calculate: customCases.sequentialUnion(2000).calculate,
                },
            },
            {
                name: "Sequential Union [Polygon Clipping]",
                implementation: "clipping",
                functions: {
                    create: customCases.randomPolygons.create,
                    calculate: customCases.sequentialUnion(2000).calculate,
                },
            },
        ],
    },
    {
        name: "polygon-clipping",
        options: [
            {
                name: "Union [GPU HistoPyramid]",
                implementation: "histopyramid",
            },
            {
                name: "polygon-clipping [CPU]",
                implementation: "clipping",
            },
        ],
    },
    {
        name: "random-polygons",
        options: [
            {
                name: "Union [GPU HistoPyramid]",
                implementation: "histopyramid",

                functions: {
                    create: customCases.randomPolygons.create,
                },
            },
            {
                name: "polygon-clipping [CPU]",
                implementation: "clipping",
                functions: {
                    create: customCases.randomPolygons.create,
                },
            },
        ],
    },
    {
        name: "HistoPyramid multiple",
        options: [
            {
                name: "Union sequential",
                implementation: "histopyramid",
                functions: {
                    calculate: async (geometry, { impl: { union } }) => {
                        let geometries = new Array(debug.num("union count"))
                            .fill(0)
                            .map(() => structuredClone(geometry) as Geometry);

                        let result = new Array(geometries.length);
                        for (let i = 0; i < result.length; i++) {
                            result[i] = await union(geometries[i]);
                        }

                        return result[0];
                    },
                },
            },
            {
                name: "Union Promise.all",
                implementation: "histopyramid",
                functions: {
                    calculate: async (geometry, { impl: { union } }) => {
                        let geometries = new Array(debug.num("union count"))
                            .fill(0)
                            .map(() => structuredClone(geometry) as Geometry);

                        let result = await Promise.all(
                            geometries.map((geometry) => union(geometry))
                        );

                        return result[0];
                    },
                },
            },
            {
                name: "Union interleaved",
                implementation: "histopyramid",
                functions: {
                    calculate: async (geometry) => {
                        let geometries = new Array(debug.num("union count"))
                            .fill(0)
                            .map(() => structuredClone(geometry) as Geometry);

                        let result = await unionMultiple(geometries);

                        return result[0];
                    },
                },
            },
        ],
    },

    ////// Hyperparameters //////

    /// Seed ///
    {
        name: "Parameter: Seed [CPU Polygon Clipping]",
        options: [
            {
                name: "Parameter: Seed 0",
                implementation: "clipping",

                hyperparameters: {
                    seed: 0,
                },
            },
            {
                name: "Parameter: Seed 1",
                implementation: "clipping",

                hyperparameters: {
                    seed: 1,
                },
            },
            {
                name: "Parameter: Seed 2",
                implementation: "clipping",

                hyperparameters: {
                    seed: 2,
                },
            },
            {
                name: "Parameter: Seed 3",
                implementation: "clipping",

                hyperparameters: {
                    seed: 3,
                },
            },
        ],
    },
    {
        name: "Parameter: Seed [CPU]",
        options: [
            {
                name: "Parameter: Seed 0",
                implementation: "cpu",

                hyperparameters: {
                    seed: 0,
                },
            },
            {
                name: "Parameter: Seed 1",
                implementation: "cpu",

                hyperparameters: {
                    seed: 1,
                },
            },
            {
                name: "Parameter: Seed 2",
                implementation: "cpu",

                hyperparameters: {
                    seed: 2,
                },
            },
            {
                name: "Parameter: Seed 3",
                implementation: "cpu",

                hyperparameters: {
                    seed: 3,
                },
            },
        ],
    },
    {
        name: "Parameter: Seed [GPU Accelerated]",
        options: [
            {
                name: "Parameter: Seed 0",
                implementation: "accelerated",

                hyperparameters: {
                    seed: 0,
                },
            },
            {
                name: "Parameter: Seed 1",
                implementation: "accelerated",

                hyperparameters: {
                    seed: 1,
                },
            },
            {
                name: "Parameter: Seed 2",
                implementation: "accelerated",

                hyperparameters: {
                    seed: 2,
                },
            },
            {
                name: "Parameter: Seed 3",
                implementation: "accelerated",

                hyperparameters: {
                    seed: 3,
                },
            },
        ],
    },
    {
        name: "Parameter: Seed [GPU HistoPyramid]",
        options: [
            {
                name: "Parameter: Seed 0",
                implementation: "histopyramid",

                hyperparameters: {
                    seed: 0,
                },
            },
            {
                name: "Parameter: Seed 1",
                implementation: "histopyramid",

                hyperparameters: {
                    seed: 1,
                },
            },
            {
                name: "Parameter: Seed 2",
                implementation: "histopyramid",

                hyperparameters: {
                    seed: 2,
                },
            },
            {
                name: "Parameter: Seed 3",
                implementation: "histopyramid",

                hyperparameters: {
                    seed: 3,
                },
            },
        ],
    },

    /// Density ///
    {
        name: "Parameter: Density [CPU Polygon Clipping]",
        options: [
            {
                name: "Parameter: Density 1",
                implementation: "clipping",

                hyperparameters: {
                    density: 1,
                },
            },
            {
                name: "Parameter: Density 0.75",
                implementation: "clipping",

                hyperparameters: {
                    density: 0.75,
                },
            },
            {
                name: "Parameter: Density 0.5",
                implementation: "clipping",

                hyperparameters: {
                    density: 0.5,
                },
            },
            {
                name: "Parameter: Density 0.25",
                implementation: "clipping",

                hyperparameters: {
                    density: 0.25,
                },
            },
        ],
    },
    {
        name: "Parameter: Density [CPU]",
        options: [
            {
                name: "Parameter: Density 1",
                implementation: "cpu",

                hyperparameters: {
                    density: 1,
                },
            },
            {
                name: "Parameter: Density 0.75",
                implementation: "cpu",

                hyperparameters: {
                    density: 0.75,
                },
            },
            {
                name: "Parameter: Density 0.5",
                implementation: "cpu",

                hyperparameters: {
                    density: 0.5,
                },
            },
            {
                name: "Parameter: Density 0.25",
                implementation: "cpu",

                hyperparameters: {
                    density: 0.25,
                },
            },
        ],
    },
    {
        name: "Parameter: Density [GPU Accelerated]",
        options: [
            {
                name: "Parameter: Density 1",
                implementation: "accelerated",
                hyperparameters: {
                    density: 1,
                },
            },
            {
                name: "Parameter: Density 0.75",
                implementation: "accelerated",
                hyperparameters: {
                    density: 0.75,
                },
            },
            {
                name: "Parameter: Density 0.5",
                implementation: "accelerated",
                hyperparameters: {
                    density: 0.5,
                },
            },
            {
                name: "Parameter: Density 0.25",
                implementation: "accelerated",
                hyperparameters: {
                    density: 0.25,
                },
            },
        ],
    },
    {
        name: "Parameter: Density [GPU HistoPyramid]",
        options: [
            {
                name: "Parameter: Density 1",
                implementation: "histopyramid",
                hyperparameters: {
                    density: 1,
                },
            },
            {
                name: "Parameter: Density 0.75",
                implementation: "histopyramid",
                hyperparameters: {
                    density: 0.75,
                },
            },
            {
                name: "Parameter: Density 0.5",
                implementation: "histopyramid",
                hyperparameters: {
                    density: 0.5,
                },
            },
            {
                name: "Parameter: Density 0.25",
                implementation: "histopyramid",
                hyperparameters: {
                    density: 0.25,
                },
            },
        ],
    },

    /// Max Vertices ///
    {
        name: "Parameter: Max Vertices [CPU Polygon Clipping]",
        options: [
            {
                name: "Parameter: Max Vertices 3",
                implementation: "clipping",
                hyperparameters: {
                    maxVertices: 3,
                    // count: (c) => Math.floor(c / 3),
                },
            },
            {
                name: "Parameter: Max Vertices 4",
                implementation: "clipping",
                hyperparameters: {
                    maxVertices: 4,
                    // count: (c) => Math.floor(c / 4),
                },
            },
            {
                name: "Parameter: Max Vertices 6",
                implementation: "clipping",
                hyperparameters: {
                    maxVertices: 6,
                    // count: (c) => Math.floor(c / 6),
                },
            },
            {
                name: "Parameter: Max Vertices 8",
                implementation: "clipping",
                hyperparameters: {
                    maxVertices: 8,
                    // count: (c) => Math.floor(c / 8),
                },
            },
        ],
    },

    {
        name: "Parameter: Max Vertices [CPU]",
        options: [
            {
                name: "Parameter: Max Vertices 3",
                implementation: "cpu",
                hyperparameters: {
                    maxVertices: 3,
                    // count: (c) => Math.floor(c / 3),
                },
            },
            {
                name: "Parameter: Max Vertices 4",
                implementation: "cpu",

                hyperparameters: {
                    maxVertices: 4,
                    // count: (c) => Math.floor(c / 4),
                },
            },
            {
                name: "Parameter: Max Vertices 6",
                implementation: "cpu",
                hyperparameters: {
                    maxVertices: 6,
                    // count: (c) => Math.floor(c / 6),
                },
            },
            {
                name: "Parameter: Max Vertices 8",
                implementation: "cpu",
                hyperparameters: {
                    maxVertices: 8,
                    // count: (c) => Math.floor(c / 8),
                },
            },
        ],
    },

    {
        name: "Parameter: Max Vertices [GPU Accelerated]",
        options: [
            {
                name: "Parameter: Max Vertices 3",
                implementation: "accelerated",
                hyperparameters: {
                    maxVertices: 3,
                    // count: (c) => Math.floor(c / 3),
                },
            },
            {
                name: "Parameter: Max Vertices 4",
                implementation: "accelerated",
                hyperparameters: {
                    maxVertices: 4,
                    // count: (c) => Math.floor(c / 4),
                },
            },

            {
                name: "Parameter: Max Vertices 6",
                implementation: "accelerated",
                hyperparameters: {
                    maxVertices: 6,
                    // count: (c) => Math.floor(c / 6),
                },
            },
            {
                name: "Parameter: Max Vertices 8",
                implementation: "accelerated",
                hyperparameters: {
                    maxVertices: 8,
                    // count: (c) => Math.floor(c / 8),
                },
            },
        ],
    },

    {
        name: "Parameter: Max Vertices [GPU HistoPyramid]",
        options: [
            {
                name: "Parameter: Max Vertices 3",
                implementation: "histopyramid",
                hyperparameters: {
                    maxVertices: 3,
                    // count: (c) => Math.floor(c / 3),
                },
            },
            {
                name: "Parameter: Max Vertices 4",
                implementation: "histopyramid",
                hyperparameters: {
                    maxVertices: 4,
                    // count: (c) => Math.floor(c / 4),
                },
            },
            {
                name: "Parameter: Max Vertices 6",
                implementation: "histopyramid",
                hyperparameters: {
                    maxVertices: 6,
                    // count: (c) => Math.floor(c / 6),
                },
            },
            {
                name: "Parameter: Max Vertices 8",
                implementation: "histopyramid",
                hyperparameters: {
                    maxVertices: 8,
                    // count: (c) => Math.floor(c / 8),
                },
            },
        ],
    },

    /// Maximize Vertices ///
    {
        name: "Parameter: Maximize Vertices [CPU Polygon Clipping]",
        options: [
            {
                name: "Parameter: Maximize false",
                implementation: "clipping",
                hyperparameters: {
                    maxVertices: 8,
                    maximizeVertices: false,
                },
            },
            {
                name: "Parameter: Maximize true",
                implementation: "clipping",
                hyperparameters: {
                    maxVertices: 8,
                    maximizeVertices: true,
                },
            },
        ],
    },
    {
        name: "Parameter: Maximize Vertices [CPU]",
        options: [
            {
                name: "Parameter: Maximize false",
                implementation: "cpu",
                hyperparameters: {
                    maxVertices: 8,
                    maximizeVertices: false,
                },
            },
            {
                name: "Parameter: Maximize true",
                implementation: "cpu",
                hyperparameters: {
                    maxVertices: 8,
                    maximizeVertices: true,
                },
            },
        ],
    },

    {
        name: "Parameter: Maximize Vertices [GPU Accelerated]",
        options: [
            {
                name: "Parameter: Maximize false",
                implementation: "accelerated",
                hyperparameters: {
                    maxVertices: 8,
                    maximizeVertices: false,
                },
            },
            {
                name: "Parameter: Maximize true",
                implementation: "accelerated",
                hyperparameters: {
                    maxVertices: 8,
                    maximizeVertices: true,
                },
            },
        ],
    },

    {
        name: "Parameter: Maximize Vertices [GPU HistoPyramid]",
        options: [
            {
                name: "Parameter: Maximize false",
                implementation: "histopyramid",
                hyperparameters: {
                    maxVertices: 8,
                    maximizeVertices: false,
                },
            },
            {
                name: "Parameter: Maximize true",
                implementation: "histopyramid",
                hyperparameters: {
                    maxVertices: 8,
                    maximizeVertices: true,
                },
            },
        ],
    },
] satisfies ProfileOptions<ProfilingOptions>;
