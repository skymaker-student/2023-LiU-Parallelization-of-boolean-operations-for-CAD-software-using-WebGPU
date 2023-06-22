import { evaluate } from "./evaluate";
import type { FunctionNames, Functions } from "./functions";

export type Bounds = {
    min: Vec2;
    max: Vec2;
};

export interface Value<T> {
    type: "value";
    value: T;
    min?: Vec2;
    max?: Vec2;
}

export type Id = number;
export interface Ref<T> {
    type: "ref";
    id: Id;
    min?: Vec2;
    max?: Vec2;
}

export type Arg<T> = Value<T> | Ref<T>;

export type CreateOp = {
    op: "create";
    args: Arg<Vec2[]>[];
    ret: Ref<Geometry>;
};

export type UnionOp = {
    op: "union";
    args: Arg<Geometry>[];
    ret: Ref<Geometry>;
};

export type SplitOp = {
    op: "split";
    args: Arg<Geometry>[];
    ret: Ref<Geometry>;
};

export type IntersectionOp = {
    op: "intersection";
    args: Arg<Geometry>[];
    ret: Ref<Vec2[]>;
};

export type JoinOp = {
    op: "join";
    args: Arg<Geometry>[];
    ret: Ref<Geometry>;
};

export type ReturnOp = {
    op: "return";
    args: [Arg<Geometry>];
};

export type Op = CreateOp | UnionOp | SplitOp | JoinOp | IntersectionOp;

type OpReturn<T> = T extends Extract<Op, { ret: Ref<T> }> ? T["ret"] : never;

export function isRef<T>(value: T | Ref<T> | Arg<T>): value is Ref<T> {
    if (!value) return false;
    if (typeof value !== "object") return false;
    return (value as any).type === "ref";
}

export function isValue<T>(value: T | Ref<T> | Arg<T>): value is Value<T> {
    if (!value) return false;
    if (typeof value !== "object") return false;
    return (value as any).type === "value";
}

export function bounds(args: Arg<Geometry>[]): Bounds {
    const min = args.reduce(
        (min, arg) => {
            return {
                x: Math.min(min.x, arg.min?.x ?? 0),
                y: Math.min(min.y, arg.min?.y ?? 0),
            };
        },
        { x: Infinity, y: Infinity }
    );

    const max = args.reduce(
        (max, arg) => {
            return {
                x: Math.max(max.x, arg.max?.x ?? 0),
                y: Math.max(max.y, arg.max?.y ?? 0),
            };
        },
        { x: -Infinity, y: -Infinity }
    );
    return { min, max };
}

export type Implementation = {
    create: (position: Vec2[]) => Geometry | Promise<Geometry>;
    union: (geometry: Geometry) => Geometry | Promise<Geometry>;
    split: (geometry: Geometry) => Geometry | Promise<Geometry>;
    intersection: (geometry: Geometry) => Vec2[] | Promise<Vec2[]>;
};
export type Options = {
    merge?: boolean;
    removeUnused?: boolean;
    impl: Implementation;
};

export type Input<T> = T | Ref<T>;
export type GraphContext = ReturnType<typeof start>;
export function start(options: Options) {
    let refIdCounter = 0;
    let operations: Op[] = [];

    function ref<T>(bounds: Bounds): Ref<T> {
        return {
            type: "ref",
            id: refIdCounter++,
            ...bounds,
        };
    }

    function value<T>(value: T): Value<T> {
        return {
            type: "value",
            value,
        };
    }

    function fromInput<T>(val: Input<T>): Value<T> | Ref<T> {
        if (isRef(val)) {
            return val;
        } else {
            return value(val);
        }
    }

    function fromInputGeometry<T>(val: Input<T>): Arg<T> {
        if (isRef(val)) {
            return val as Ref<T>;
        } else {
            return {
                type: "value",
                value: val,
                min: { x: 0, y: 0 },
                max: { x: 0, y: 0 }, // TODO: get bounds
            };
        }
    }

    function queue<T extends Op>(op: T) {
        operations.push(op);
        return op.ret as OpReturn<T>;
    }

    const context = {
        ref,
        value,
        fromInput,
        fromInputGeometry,
        queue,
        finish,
        impl: options.impl,
    };

    async function finish(op: ReturnOp) {
        return await evaluate(context, operations, op, options);
    }

    return context;
}

export const debugGraph = [
    {
        op: "create",
        args: [
            {
                type: "value",
                value: [{ x: 0, y: 0 }],
            },
            {
                type: "value",
                value: [{ x: 2, y: 2 }],
            },
        ],
        ret: { type: "ref", id: 0, min: { x: -1, y: -1 }, max: { x: 3, y: 3 } },
    },
    {
        op: "create",
        args: [
            {
                type: "value",
                value: [{ x: 4, y: 4 }],
            },
            {
                type: "value",
                value: [{ x: 5, y: 5 }],
            },
        ],
        ret: { type: "ref", id: 1, min: { x: 3, y: 3 }, max: { x: 6, y: 6 } },
    },
    {
        op: "union",
        args: [{ type: "ref", id: 0, min: { x: -1, y: -1 }, max: { x: 3, y: 3 } }],
        ret: { type: "ref", id: 2, min: { x: -1, y: -1 }, max: { x: 3, y: 3 } },
    },
    {
        op: "union",
        args: [{ type: "ref", id: 1, min: { x: 3, y: 3 }, max: { x: 6, y: 6 } }],
        ret: { type: "ref", id: 3, min: { x: 3, y: 3 }, max: { x: 6, y: 6 } },
    },
    {
        op: "union",
        args: [
            { type: "ref", id: 2, min: { x: -1, y: -1 }, max: { x: 3, y: 3 } },
            { type: "ref", id: 3, min: { x: 3, y: 3 }, max: { x: 6, y: 6 } },
        ],
        ret: { type: "ref", id: 4, min: { x: -1, y: -1 }, max: { x: 6, y: 6 } },
    },
] satisfies Op[];

const debugGraphRet = {
    op: "return",
    args: [{ type: "ref", id: 4, min: { x: -1, y: -1 }, max: { x: 6, y: 6 } }],
} satisfies ReturnOp;

export const debug = {
    graph: debugGraph,
    ret: debugGraphRet,
};
