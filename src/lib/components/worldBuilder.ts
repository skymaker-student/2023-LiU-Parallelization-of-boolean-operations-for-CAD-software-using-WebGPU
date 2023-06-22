import { debugGeometry, type DebugFunctions } from "$debug/geometry";
import {
    addDebugPoint,
    debug,
    debugIsolate,
    debugNodes,
    debugShapes,
    updateNodes,
} from "$debug/visual";
import { CAD as CPU } from "$skymaker";
import { randomSquareGrid } from "$skymaker/geometry";
import type { World } from "$skymaker/Visualization";
import { get, writable } from "svelte/store";
import * as THREE from "three";
import { GPU } from "./WebGPUHistoPyramid";
import { GPU as OldGPU } from "$/webgpu";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { NORMALIZE_COORDINATES, RESCALE } from "$webgpu/common/constants";

export type CreateMode = "random" | "debug";

export function createModeTypes() {
    return ["random", "debug"] as CreateMode[];
}

type RandomCreateOptions = {
    mode: "random";
    count: number;
    density: number;
    seed: number;
};

type DebugCreateOptions = {
    mode: "debug";
    function: DebugFunctions;
};

type CreateOptions = RandomCreateOptions | DebugCreateOptions;
export type CalculateFunction = (
    geometry: Geometry,
    options: ReqRenderOptions
) => Geometry | Promise<Geometry>;
export type CreateFunction = (options: ReqRenderOptions) => Geometry | Promise<Geometry>;

export type RenderOptions = {
    create?: CreateOptions;
    triangulate?: boolean;
    useUnion?: boolean;
    functions?: {
        create?: CreateFunction | null;
        calculate?: CalculateFunction | null;
    };
    operations: {
        union: (geometry: Geometry) => Promise<Geometry> | Geometry;
        split?: (geometry: Geometry) => Promise<Geometry> | Geometry;
    };
};

type Implementation = {
    split: (geometry: Geometry) => Promise<Geometry> | Geometry;
    union: (geometry: Geometry) => Promise<Geometry> | Geometry;
};

type ReqRenderOptions = Required<RenderOptions> & { impl: Implementation };

const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
const dynamicColors = ["#ff00ff", "#00ffff", "#ffff00", "#00ff00", "#ff0000"]; // , "#0000ff"
const dynamicColorMaterials = dynamicColors.map(
    (color) => new THREE.LineBasicMaterial({ depthWrite: false, color })
);

const processing = writable(false);
const defaultOptions = {
    create: {
        mode: "random",
        count: 100,
        density: 0.5,
        seed: 0,
    },
    useUnion: false,
    triangulate: true,
    operations: {
        union: CPU.union,
        split: CPU.split,
    },
    functions: {
        create: null,
        calculate: null,
    },
} satisfies RenderOptions;

let world: World;

export async function buildWorld(
    canvas: HTMLCanvasElement,
    options: RenderOptions,
    render: boolean
) {
    const opts = Object.assign({}, defaultOptions, options);
    const notImplemented = (name: string) => () => {
        throw new Error(`${name} not implemented`);
    };
    const impl = {
        split: opts.operations.split ?? notImplemented("Split"),
        union: opts.operations.union ?? notImplemented("Union"),
    } satisfies Implementation;

    if (get(processing)) {
        console.warn("Already processing");
        return world;
    }

    processing.set(true);

    try {
        if (render) {
            await generateAndRender(canvas, { ...opts, impl });
        } else {
            await generateGeometry(canvas, { ...opts, impl });
        }
    } finally {
        processing.set(false);
    }

    return world;
}

async function generateAndRender(canvas: HTMLCanvasElement, options: ReqRenderOptions) {
    if (!options.triangulate) throw new Error("Cannot render without triangulation");
    let { result } = await generateGeometry(canvas, options);

    await timed("Render", draw, world, result!);
}

async function generateGeometry(canvas: HTMLCanvasElement, options: ReqRenderOptions) {
    init(canvas);
    const calc = options.functions?.calculate ?? calculate;
    const createFn = options.functions?.create ?? create;

    debug.clear();

    const geometryInstances = await timed("Create", createFn, options);

    if (NORMALIZE_COORDINATES) {
        let scaleX = -Infinity;
        let scaleY = -Infinity;

        for (let shape of geometryInstances) {
            for (let node of shape.nodes) {
                scaleX = Math.max(scaleX, Math.abs(node.x));
                scaleY = Math.max(scaleY, Math.abs(node.y));
            }
        }

        for (let shape of geometryInstances) {
            for (let node of shape.nodes) {
                node.x /= scaleX / RESCALE;
                node.y /= scaleY / RESCALE;
            }
        }
    }

    const splitResult = await timed("Calculate", calc, geometryInstances, options);

    if (debug.num("index") >= 0) {
        let shape = splitResult[debug.num("shape")];
        let index = debug.num("index") % shape.nodes.length;
        let vertex = shape.nodes[index];

        addDebugPoint(vertex);
    }

    if (options.triangulate) {
        const mesh = await timed("Triangulate", triangulate, splitResult, options);
        return { result: mesh };
    } else {
        return { result: null };
    }
}

async function timed<T extends (...a: any[]) => any>(name: string, fn: T, ...args: Parameters<T>) {
    console.time(name);
    const result = await fn(...args);
    console.timeEnd(name);
    return result as ReturnType<T>;
}

function dynamicColor(i: number) {
    return dynamicColorMaterials[i % dynamicColors.length];
}

function init(canvas: HTMLCanvasElement) {
    if (!world || world.canvas !== canvas) {
        world?.reset();
        world = CPU.initWorld(canvas);
        world.onClick((names) => {
            debugIsolate.update((set) => {
                if (names.length === 0) {
                    return -1;
                }
                return set === +names[0] ? -1 : +names[0];
            });
            world.reset();
            redraw(world);
        });
    }
    world.reset();
}

async function create({ create: options }: ReqRenderOptions) {
    let geometryInstances: Shape[] = [];

    switch (options.mode) {
        case "random":
            geometryInstances = randomSquareGrid({
                count: options.count,
                seed: options.seed,
                density: options.density,
            });
            break;
        case "debug":
            geometryInstances = debugGeometry(options.function);
            break;
    }

    return geometryInstances;
}

async function calculate(result: Shape[], options: ReqRenderOptions) {
    const { useUnion, impl } = options;

    if (useUnion) {
        return impl.union(result);
    } else {
        return impl.split(result);
    }
}

function triangulate(geometry: Shape[] | Vec2[], options: ReqRenderOptions) {
    if (geometry.length === 0) return [];

    let i = 0;
    if ((geometry[0] as Shape).nodes) {
        const result = (geometry as Shape[]).map((shape) => {
            const geometry = CPU.triangulate(shape);

            // console.time("Triangulate.Create THREE Mesh");
            const mesh = new THREE.Mesh(geometry, material);
            const wireframeGeometry = new THREE.WireframeGeometry(geometry);
            const wireframe = new THREE.LineSegments(wireframeGeometry, dynamicColor(i++));
            // console.timeEnd("Triangulate.Create THREE Mesh");

            return {
                mesh,
                wireframe,
            };
        });
        return result;
    } else {
        const result = (geometry as Vec2[]).map((node) => {
            const geometry = new THREE.SphereGeometry(0.125, 8, 8);
            geometry.translate(node.x, node.y, 0);
            const mesh = new THREE.Mesh(geometry, material);

            const wireframeGeometry = new THREE.WireframeGeometry(geometry);
            const wireframe = new THREE.LineSegments(wireframeGeometry, dynamicColor(0));

            return {
                mesh,
                wireframe,
            };
        });
        return result;
    }
}

let lastResult: { mesh: THREE.Mesh; wireframe: any }[] | null = null;
function redraw(world: World) {
    if (lastResult) draw(world, lastResult);
}

function draw(world: World, result: { mesh: THREE.Mesh; wireframe: any }[]) {
    lastResult = result;
    result.forEach((res, index) => {
        if (get(debugIsolate) > -1 && get(debugIsolate) !== index) return;
        res.mesh.name = "" + index;
        world.scene.add(res.mesh);
        world.scene.add(res.wireframe);

        const geometry = (res.mesh as THREE.Mesh).geometry;
        geometry.computeBoundingBox();

        if (get(debugShapes)) {
            const x = ((geometry.boundingBox?.max.x ?? 0) + (geometry.boundingBox?.min.x ?? 0)) / 2;
            const y = ((geometry.boundingBox?.max.y ?? 0) + (geometry.boundingBox?.min.y ?? 0)) / 2;

            const labelDiv = document.createElement("div");
            labelDiv.className = "label";
            labelDiv.textContent = `${index}`;
            const label = new CSS2DObject(labelDiv);
            label.position.set(x, y, 0);
            res.mesh.add(label);
        }
    });

    if (get(debugNodes)) {
        const nodes = get(debugNodes);
        updateNodes(world, nodes);
    }

    world.requestRender();
}
