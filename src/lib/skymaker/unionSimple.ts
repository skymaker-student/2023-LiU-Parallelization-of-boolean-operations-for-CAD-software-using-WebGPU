import { splitGeometry } from "../webgpu/split";

export async function unionGeometry(listOfGeometry: Shape[]) {
    const { geometry, intersectionMap, intersectionMapSorted, inputBuffer } = await splitGeometry(
        listOfGeometry
    );

    const node = getMinNode(geometry);
    console.log(intersectionMapSorted);

    return geometry;
}

function getMinNode(geometry: Shape[]) {
    const minNode = (acc: Vec2, node: Vec2) => ({
        x: Math.min(acc.x, node.x),
        y: Math.min(acc.y, node.y),
    });
    const infNode = { x: Infinity, y: Infinity };
    type DistVec = Vec2 & { dist: number; shape: number; index: number };
    const infDistVec: DistVec = { x: Infinity, y: Infinity, dist: Infinity, shape: -1, index: -1 };

    const corner = geometry.reduce((acc, shape) => {
        const min = shape.nodes.reduce(minNode, infNode);
        return minNode(acc, min);
    }, infNode);

    const distance = (node: Vec2) => node.x - corner.x + node.y - corner.y;
    const closestNode = geometry.reduce((acc, shape, shapeIndex) => {
        const min = shape.nodes.reduce((accInner: DistVec, node, nodeIndex) => {
            const dist = distance(node);
            if (dist < accInner.dist) {
                return {
                    ...node,
                    dist,
                    shape: shapeIndex,
                    index: nodeIndex,
                };
            }
            return accInner;
        }, infDistVec) as DistVec;

        return acc.dist < min.dist ? acc : min;
    }, infDistVec);

    return closestNode;
}
