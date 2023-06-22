import type { GraphContext, Op, Ref, Value } from "../graph";

import create from "./create";
import union from "./union";
import split from "./split";
import intersection from "./intersection";
import join from "./join";
import type { evaluate } from "../evaluate";

/// Operations
export const operations = {
    create,
    split,
    union,
    intersection,
    join,
} as const;

/// Helper types
type AnyFn = (...args: any[]) => any;

export type StripContext<T extends AnyFn> = T extends (arg: any, ...args: infer K) => infer L
    ? (...args: K) => L
    : never;
type PrependContext<T extends AnyFn, New> = T extends (...args: infer K) => infer L
    ? (arg: New, ...args: K) => L
    : never;

type Resolved<T> = T extends Ref<infer K> ? K : T extends Value<infer K> ? K : never;
type ResolvedParams<T extends AnyFn> = Parameters<T> extends (infer K)[] ? Resolved<K>[] : never;
type ResolvedFn<Fn extends AnyFn> = (
    ...args: ResolvedParams<Fn>
) => Resolved<ReturnType<Fn>> | Promise<Resolved<ReturnType<Fn>>>;

export type ExecuteFn<T extends AnyFn> = {
    name: string;
    sequential: boolean;
    execute: PrependContext<ResolvedFn<T>, GraphContext>;
    merge?: (self: Op, other: Op) => Op | null;
    batch?: (
        context: GraphContext,
        ops: Parameters<ResolvedFn<T>>[]
    ) => ReturnType<ResolvedFn<T>>[] | Promise<ReturnType<ResolvedFn<T>>[]>;
};

export type Execute<T extends AnyFn> = ExecuteFn<StripContext<T>>;

type OperationName = keyof typeof operations;
type OperationFunction<T extends OperationName> = (typeof operations)[T]["lazy"];

/// Exports
export const execute = {} as {
    [K in OperationName]: Execute<OperationFunction<K>>;
};

Object.entries(operations).forEach(([key, value]) => {
    execute[key as OperationName] = value.execute as any;
});

const operationFunctions = {} as {
    [K in OperationName]: OperationFunction<K>;
};
Object.entries(operations).forEach(([key, value]) => {
    operationFunctions[key as OperationName] = value.lazy as any;
});

export function functions(context: GraphContext) {
    const contextLess = {} as {
        [K in OperationName]: StripContext<OperationFunction<K>>;
    } & {
        evaluate: (geometry: Ref<Geometry>) => Promise<Geometry>;
    };

    contextLess.evaluate = async (geometry) => {
        const res = await context.finish({
            op: "return",
            args: [geometry],
        });
        return res.output as Geometry;
    };

    Object.entries(operationFunctions).forEach(([key, value]) => {
        contextLess[key as OperationName] = (...args: [any]) => value(context, ...args);
    });

    return contextLess;
}

export function executes(context: GraphContext) {
    const contextLess = {} as {
        [K in OperationName]: StripContext<(typeof execute)[K]["execute"]>;
    };

    Object.entries(execute).forEach(([key, value]) => {
        contextLess[key as OperationName] = (...args: [any]) =>
            value.execute(context, ...args) as any;
    });

    return contextLess;
}

export type Functions = ReturnType<typeof functions>;
export type FunctionNames = keyof Functions;
