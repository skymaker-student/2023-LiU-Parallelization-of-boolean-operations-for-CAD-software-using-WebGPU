import { execute } from "./functions";
import type { Id, Op, Ref, ReturnOp, Arg, GraphContext, Options } from "./graph";
import { isRef } from "./graph";

export type Stage = Id[];

const debugPrint = false;

const visualization = true;
export async function evaluate(
    context: GraphContext,
    operations: Op[],
    ret: ReturnOp,
    options: Options
) {
    const maps = buildMaps(operations, ret);
    const { references, dependants, operationMap } = maps;

    if (options.removeUnused) {
        for (const [id, deps] of dependants) {
            removeUnused(maps, id, deps);
        }
    }

    if (options.merge) {
        merge(maps);
    }

    const stages = buildStages(references, operationMap);

    if (debugPrint) {
        console.log("stages");
        stages.forEach((stage, i) => printStage(operationMap, stage, i));
        console.log(
            `${stages.length}: %c${(ret.args[0] as Ref<any>).id}:return`,
            "color: cornflowerblue;"
        );
    }

    if (visualization) {
        stages.forEach((stage, y) => {
            stage.forEach((id, x) => {
                maps.operationInfo.get(id)!.place = { x, y };
            });
        });
    }

    const res = await compute(context, maps, stages);

    return {
        maps,
        stages,
        return: (ret.args[0] as Ref<any>).id,
        result: res as Map<number, Geometry>,
        output: res.get((ret.args[0] as Ref<any>).id)!,
    };
}

export type EvalMaps = ReturnType<typeof buildMaps>;
function buildMaps(operations: Op[], ret: ReturnOp) {
    const references = new Map<Id, Ref<any>[]>();
    const dependants = new Map<Id, Id[]>();
    const operationMap = new Map<Id, Op>();
    const operationInfo = new Map<Id, { sequential: boolean; place: Vec2; merge?: boolean }>();

    /// Builds maps
    for (const op of operations) {
        references.set(op.ret.id, (op.args as Arg<any>[]).filter(isRef));
        dependants.set(op.ret.id, []);
        operationMap.set(op.ret.id, op);
    }   

    for (const [id, refs] of references) {
        for (const ref of refs) {
            dependants.get(ref.id)!.push(id);
        }
    }

    const retRefs = (ret.args as Arg<any>[]).filter(isRef);
    for (const ref of retRefs) {
        dependants.get(ref.id)!.push(ref.id);
    }

    // for debugging
    for (const [id, op] of operationMap) {
        operationInfo.set(id, {
            sequential: execute[op.op].sequential,
            place: { x: 0, y: 0 },
        });
    }

    return {
        references,
        dependants,
        operationMap,
        operationInfo,
    };
}

function removeUnused(maps: EvalMaps, id: Id, deps: Id[]) {
    const { references, dependants } = maps;
    if (deps === undefined) return;
    if (deps.length === 0) {
        let args = references.get(id)!.map((ref) => ref.id);
        resolve(references, id);
        maps.operationMap.delete(id);

        args.forEach((aid) => {
            const adeps = dependants.get(aid);
            const filtered = adeps?.filter((did) => did !== id);
            if (filtered) {
                dependants.set(aid, filtered);
                removeUnused(maps, aid, filtered);
            }
        });
    }
}

function merge(maps: EvalMaps) {
    const { references, dependants, operationMap } = maps;

    for (const [id, deps] of dependants) {
        if (deps && deps.length === 1) {
            const fromOp = operationMap.get(id)!;
            const toId = deps[0];
            const toOp = operationMap.get(toId)!;
            const result = execute[fromOp.op].merge?.(fromOp, toOp);
            if (!result) continue;

            if (result.ret.id !== toId) {
                throw new Error("Result of merge must have the same reference as the target");
            }
            const args = (result.args as Arg<any>[]).filter(isRef);

            references.set(toId, args);
            operationMap.set(toId, result);

            references.delete(id);
            dependants.delete(id);
            operationMap.delete(id);
        }
    }
}

function buildStages(references: Map<number, Ref<any>[]>, operationMap: Map<number, Op>) {
    const stages: Stage[] = [];
    while (references.size > 0) {
        const stage: Stage = [];

        /// Sequential operations
        for (const [id, refs] of references) {
            if (refs.length !== 0) continue;

            if (execute[operationMap.get(id)!.op].sequential === false) continue;
            stage.push(id);
            resolve(references, id);
        }

        /// Parallel operations
        for (const [id, refs] of references) {
            if (refs.length !== 0) continue;
            stage.push(id);
        }

        stage.forEach((id) => resolve(references, id));
        if (stage.length === 0) {
            throw new Error("Circular reference");
        }
        stages.push(stage);
    }

    return stages;
}

async function compute(context: GraphContext, maps: EvalMaps, stages: Stage[]) {
    const { operationMap, operationInfo } = maps;

    const result = new Map<Id, any>();

    for (const stage of stages) {
        const sequential = stage.filter((id) => operationInfo.get(id)!.sequential);
        const parallel = stage.filter((id) => !operationInfo.get(id)!.sequential);

        function evaluate(id: Id) {
            const op = operationMap.get(id)!;
            const args = (op.args as Arg<any>[]).map((arg) => {
                if (isRef(arg)) {
                    return result.get(arg.id);
                } else {
                    return arg.value;
                }
            });
            return execute[op.op].execute(context, ...args);
        }

        for (let i = 0; i < sequential.length; i++) {
            const id = sequential[i];
            const res = await evaluate(id);
            result.set(id, res);
        }

        const operations: Record<string, Op[]> = {};
        parallel.forEach((id) => {
            const op = operationMap.get(id)!;
            operations[op.op] = [...(operations[op.op] ?? []), op];
        });

        async function batch(ops: Op[]) {
            let res: any[];
            if (execute[ops[0].op].batch && ops.length > 1) {
                const args = ops.map((op) =>
                    (op.args as Arg<any>[]).map((arg) => {
                        if (isRef(arg)) {
                            return result.get(arg.id);
                        } else {
                            return arg.value;
                        }
                    })
                );
                res = await execute[ops[0].op].batch?.(context, args)!;
            } else {
                res = await Promise.all(ops.map((op) => evaluate(op.ret.id)));
            }
            for (let i = 0; i < ops.length; i++) {
                result.set(ops[i].ret.id, res[i]);
            }
        }

        await Promise.all(Object.values(operations).map(batch));
    }

    return result;
}

function resolve(references: Map<Id, Ref<any>[]>, id: Id) {
    references.delete(id);
    references.forEach((refs) => {
        for (let i = refs.length - 1; i >= 0; --i) {
            if (refs[i].id === id) {
                refs.splice(i, 1);
            }
        }
    });
}

function printStage(operationMap: Map<Id, Op>, stage: Stage, i: number) {
    const c = ["cornflowerblue", "greenyellow"].map((c) => `color: ${c};`);

    const operations = stage.map((id) => operationMap.get(id)!);
    let seq = operations
        .filter((op) => execute[op.op].sequential === true)
        .map(formatOp)
        .join(" -> ");
    if (seq.length > 0) seq += " ";

    let par = operations
        .filter((op) => execute[op.op].sequential === false)
        .map(formatOp)
        .join(" ");
    if (par.length > 0) par = "| " + par + " |";

    console.log(`${i}: ` + "%c" + seq + "%c" + par, c[0], c[1]);
}

function formatOp(op: Op) {
    const args = op.args
        .map((arg: Arg<any>) => {
            if (isRef(arg)) {
                return arg.id;
            } else {
                return arg.value;
            }
        })
        .join(", ");
    return `${op.ret.id}:${op.op}(${args})`;
}
