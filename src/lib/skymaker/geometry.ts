import { Bounds2D, PseudoRandomizer } from "./Math";

export function createRandomGeometry(
    bounds: Bounds2D,
    itemSize: Vec2,
    N: number,
    randomizerSeed: number
) {
    const size = bounds.getSize();
    const rnd = new PseudoRandomizer({ seed: randomizerSeed });

    const instances: Shape[] = [];
    for (let i = 0; i < N; i++) {
        const x = rnd.nextFloat() * size.x - itemSize.x + bounds.min.x;
        const y = rnd.nextFloat() * size.x - itemSize.y + bounds.min.y;

        const shape = generateRectangleShape(x, y, itemSize.x, itemSize.y);
        instances.push(shape);
    }
    return instances;
}

export function generateRectangleShape(x: number, y: number, width: number, height: number) {
    return {
        contour: [0, 1, 2, 3],
        nodes: [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height },
        ],
    } as Shape;
}

export function generateLinesFromShape(shape: Shape) {
    const N = shape.contour!.length;
    const lines: { start: Vec2; end: Vec2 }[] = [];
    for (let i = 0; i < N; i++) {
        const start = shape.nodes[shape.contour![i]];
        const end = shape.nodes[shape.contour![i + 1] ?? shape.contour![0]];
        lines.push({ start, end });
    }
    return lines as Line[];
}

export function square({ x, y }: Vec2, radius: number = 2.5) {
    return generateRectangleShape(x - radius, y - radius, radius * 2, radius * 2);
}

export function shape({ x, y }: Vec2, radius: number = 2.5, rand: PseudoRandomizer) {
    function next() {
        return rand.nextFloat() / 2 + 0.5;
    }

    return {
        nodes: [
            { x: x - radius * next(), y: y - radius * next() },
            { x: x + radius * next(), y: y - radius * next() },
            { x: x + radius * next(), y: y + radius * next() },
            { x: x - radius * next(), y: y + radius * next() },
        ],
        contour: [0, 1, 2, 3],
    };
}

export function grid({ x, y }: Vec2, gridSize: number = Infinity) {
    let width = Math.ceil(gridSize / 3);
    let height = Math.ceil(gridSize / 2);

    x = x % width;
    y = y % height;
    return {
        x: x * 3 + (y % 3) - width / 2,
        y: y * 2 + x / gridSize - height / 2,
    };
}

export type RandomSquareGridOptions = {
    count: number;
    seed: number;
    density?: number;
    type?: "square" | "shape";
};
export function randomSquareGrid({
    count,
    seed,
    density = 1,
    type = "shape",
}: RandomSquareGridOptions) {
    count = Math.floor(count / 4); // Transform lineCount to shapeCount.
    const radius = 2;
    density = Math.min(1, density);

    const rand = new PseudoRandomizer({ seed });

    const gridSize = Math.ceil(Math.sqrt((count * 3 * 2) / density));

    function hash({ x, y }: Vec2) {
        return x * gridSize + y;
    }

    const occupied = new Set<number>();
    function randomPosition(): Vec2 {
        let pos = grid({ x: rand.next(), y: rand.next() }, gridSize);
        for (let i = 0; i <= 10000 && occupied.has(hash(pos)); i++) {
            pos = grid({ x: rand.next(), y: rand.next() }, gridSize);
            if (i === 10000) throw new Error("randomPosition: failed to find free position");
        }
        occupied.add(hash(pos));
        return pos;
    }

    const geometry = new Array(count);

    if (type === "square") {
        for (let i = 0; i < count; i++) {
            geometry[i] = square(randomPosition(), radius);
        }
    } else {
        for (let i = 0; i < count; i++) {
            geometry[i] = shape(randomPosition(), radius, rand);
        }
    }

    return geometry as Geometry;
}

export function mergeGeometry(geometries: Geometry[]): Geometry {
    return geometries.flat();
}

export type RandomPolygonGridOptions = {
    count: number;
    maxVertices: number;
    maximize: boolean;
    seed: number;
    density?: number;
};
export function randomPolygonGrid({
    count,
    maxVertices,
    maximize,
    seed,
    density = 1,
}: RandomPolygonGridOptions) {
    const maxRadius = 2.5;
    const minRadius = 1.25;
    density = Math.min(1, density);

    const rand = new PseudoRandomizer({ seed });

    function radialPolygon(verts: number | undefined = undefined) {
        if (verts === undefined) {
            verts = maximize
                ? maxVertices
                : 3 + Math.floor((maxVertices - 2) * rand.nextFloatExclusive());
        }

        count -= verts;

        const angleSpan = (2 * Math.PI) / verts;
        const middle = angleSpan / 2;
        const minSpan = -0.9;
        const maxSpan = 0.9;
        let start = Math.PI / 2;

        let nodes = [];
        let contour = [];

        for (let i = 0; i < verts; ++i) {
            const middleOffset = (minSpan + (maxSpan - minSpan) * rand.nextFloat()) * middle;
            const x = Math.cos(start + middle + middleOffset);
            const y = Math.sin(start + middle + middleOffset);
            const r = minRadius + (maxRadius - minRadius) * rand.nextFloat();

            const node = { x: r * x, y: r * y };

            nodes.push(node);
            contour.push(i);

            start += angleSpan;
        }

        return { nodes, contour };
    }

    const geometry = [];

    while (count > 0) {
        if (!maximize && count <= maxVertices + 3) {
            if (count >= 6) {
                geometry.push(radialPolygon(3));
            }
            geometry.push(radialPolygon(count));
        } else {
            geometry.push(radialPolygon());
        }
    }

    const gridSize = Math.ceil(Math.sqrt((geometry.length * 3 * 2) / density));

    function hash({ x, y }: Vec2) {
        return x * gridSize + y;
    }

    const occupied = new Set<number>();
    function randomPosition(): Vec2 {
        let pos = grid({ x: rand.next(), y: rand.next() }, gridSize);
        for (let i = 0; i <= 10000 && occupied.has(hash(pos)); i++) {
            pos = grid({ x: rand.next(), y: rand.next() }, gridSize);
            if (i === 10000) throw new Error("randomPosition: failed to find free position");
        }
        occupied.add(hash(pos));
        return pos;
    }

    for (let shape of geometry) {
        const p = randomPosition();
        for (let node of shape.nodes) {
            node.x += p.x;
            node.y += p.y;
        }
    }

    return geometry as Geometry;
}
