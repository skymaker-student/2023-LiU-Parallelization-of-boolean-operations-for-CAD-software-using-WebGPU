import type { evaluate } from "./evaluate";
import { executes, functions, type Functions } from "./functions";
import { start, type Arg, type Options, type Ref } from "./graph";

export type Case = {
    name: string;
    fn: (functions: Functions) => Ref<Geometry> | Promise<Ref<Geometry>>;
};

async function deepAwait(obj: any): Promise<any> {
    if (obj instanceof Promise) {
        return deepAwait(await obj);
    } else if (obj instanceof Array) {
        return await Promise.all(obj.map(deepAwait));
    } else if (obj instanceof Object) {
        const res: any = {};
        for (const key in obj) {
            res[key] = await deepAwait(obj[key]);
        }
        return res;
    } else {
        return obj;
    }
}

export async function runCases(cases: Case[], options: Options) {
    const results: Awaited<ReturnType<typeof evaluate>>[] = [];
    for (const { name, fn } of cases) {
        const context = start(options);

        const fns = functions(context);
        let result = await fn(fns);
        const res = await context.finish({
            op: "return",
            args: [result],
        });
        results.push(res);
    }

    return results;
}

export const cases = [
    {
        name: "union",
        fn: union,
    },
    {
        name: "union2",
        fn: union2,
    },
    {
        name: "createAtIntersection",
        fn: createAtIntersection,
    },
    {
        name: "unused",
        fn: unused,
    },
] satisfies Case[];

const v0 = { x: 0, y: 0 };
const v1 = { x: 1, y: 1 };
const v2 = { x: 2, y: 2 };
const v3 = { x: 3, y: 3 };
const v4 = { x: 4, y: 4 };
const v5 = { x: 5, y: 5 };

function union({ create, split, union }: Functions) {
    let g1 = create([v0, v2]);
    let g2 = create([v1, v3]);

    let g3 = union(g1);
    let g4 = union(g2);

    return union(g3, g4);
}

function union2({ create, split, union }: Functions) {
    let g1 = create([v0]);
    let g2 = create([v1]);
    let g3 = create([v2]);
    let g4 = create([v3]);

    return union(union(g1, g2), union(g3, g4));
}

function createAtIntersection({ create, union, split, intersection, join }: Functions) {
    let g2 = create([v1]);
    let g1 = create([v0]);
    let g11 = create([v2]);

    let g3 = union(g1, g11);

    let i1 = intersection(g3, g2);
    let j1 = join(g3, g2);

    let g4 = create(i1);

    return union(g4, g3);
}

function unused({ create, union, split, intersection }: Functions) {
    let g2 = create([v1]);
    let g1 = create([v0]);
    let g11 = create([v2]);

    let g3 = union(g1, g11);

    let i1 = intersection(g3, g2);

    let g4 = create(i1);

    let g5 = union(g4, g3);

    return create([v1]);
}
