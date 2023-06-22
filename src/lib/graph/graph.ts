import type { Benchmark } from "routes/halftime/Benchmarks.svelte";

export type GraphContext = ReturnType<typeof createContext>;
export type GraphData = GraphContext["data"];
export type Measurement = GraphContext["data"][number];

export type Mode = "logarithmic" | "linear" | "values";
export type Modes = { x: Mode; y: Mode };

export type ContextOptions = {
    axes: {
        x: {
            mode: Mode;
            rotation?: number;
        };
        y: {
            mode: Mode;
            rotation?: number;
            step: number;
            height?: number;
        };
    };
};

type BenchmarkData = {
    results: {
        x: number;
        points: number[];
    }[];
};

export function createCombinedContext(
    benchmarks: Benchmark[],
    height: number,
    options: ContextOptions
) {
    const combined = benchmarks.reduce(
        (acc, benchmark) => {
            benchmark.data.forEach((result, i) => {
                const d = acc.data.find((data) => data.x === result.x);
                if (d) {
                    d.data.push(...result.data);
                } else {
                    acc.data.push({
                        x: result.x,
                        data: [...result.data],
                    });
                }
            });
            return acc;
        },
        { name: "combined", data: [] } as Benchmark
    );

    return createContext(combined, height, options);
}

export function createData(benchmark: Benchmark): GraphData {
    const data = benchmark.data.map(({ x, data }) => {
        data = data.sort((a, b) => a - b);
        return {
            x: x,
            values: data,
            min: percentile(data, 0),
            q1: percentile(data, 25),
            median: percentile(data, 50),
            q3: percentile(data, 75),
            max: percentile(data, 100),
            percentile: (p: number) => percentile(data, p),
        };
    });

    return data;
}

export function createContext(benchmark: Benchmark, height: number, options: ContextOptions) {
    const min = {
        x: Math.min(...benchmark.data.map((result) => result.x)),
        y: Math.min(...benchmark.data.map((result) => Math.min(...result.data))),
    };
    min.y = 0;

    const max = {
        x: Math.max(...benchmark.data.map((result) => result.x)),
        y: Math.max(...benchmark.data.map((result) => Math.max(...result.data))),
    };

    max.y = options.axes.y.height ?? max.y;

    const values = {
        x: benchmark.data.map((result) => result.x),
    };

    const data = benchmark.data.map(({ x, data }) => {
        data = data.sort((a, b) => a - b);
        return {
            x: x,
            values: data,
            min: percentile(data, 0),
            q1: percentile(data, 25),
            median: percentile(data, 50),
            q3: percentile(data, 75),
            max: percentile(data, 100),
            percentile: (p: number) => percentile(data, p),
        };
    });

    const context = {
        height,
        width: 100,
        map: (x: number, y: number) => ({
            x: context.mapX(x),
            y: context.mapY(y),
        }),
        mapX: createMapX(options, min, max, values),
        mapY: createMapY(options, min, max, height),
        max,
        min,
        values,
        data,
        options,
    };

    return context;
}

function createMapX(options: ContextOptions, min: Vec2, max: Vec2, values: { x: number[] }) {
    function mapX(x: number) {
        const mappedX = padX(
            {
                logarithmic: mapXLog,
                linear: mapXLinear,
                values: mapXValues,
            }[options.axes.x.mode](x)
        );
        return mappedX;
    }

    function padX(x: number) {
        return x * 100;
    }

    function mapXLinear(x: number) {
        if (max.x - min.x === 0) {
            return 0.5;
        }
        return (x - min.x) / (max.x - min.x);
    }
    function mapXLog(x: number) {
        return Math.log10(x - max.x + 1) / Math.log10(max.x - min.x + 1);
    }

    function mapXValues(x: number) {
        return values.x.indexOf(x) / (values.x.length - 1);
    }

    return mapX;
}

function createMapY(options: Required<ContextOptions>, min: Vec2, max: Vec2, height: number) {
    function mapY(y: number) {
        return padY(
            {
                logarithmic: mapYLog,
                linear: mapYLinear,
                values: mapYValues,
            }[options.axes.y.mode](y)
        );
    }

    function padY(y: number) {
        return height - y * height;
    }

    function mapYLinear(y: number) {
        return (y - min.y) / (max.y - min.y);
    }

    function mapYLog(y: number) {
        return Math.log10(y + 1) / Math.log10(max.y + 1);
    }

    function mapYValues(y: number) {
        return y;
    }

    return mapY;
}

export function percentile(values: number[], percentile: number) {
    let left = values[Math.floor((values.length - 1) * (percentile / 100))];
    let right = values[Math.ceil((values.length - 1) * (percentile / 100))];
    return (left + right) / 2;
}
