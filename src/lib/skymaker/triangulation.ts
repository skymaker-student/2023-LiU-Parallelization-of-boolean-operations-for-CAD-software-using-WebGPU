import * as THREE from "three";
import earcut from "earcut";

export function triangulate(shape: Shape) {
    const vertices: number[] = [];

    // console.time("Triangulate.Map To Earcut");
    if (!shape.contour) {
        shape.nodes.forEach((node) => {
            vertices.push(node.x);
            vertices.push(node.y);
        });
    } else {
        const ccwContour = shape.contour!.slice();
        // ccwContour.reverse();
        ccwContour.forEach((index) => {
            const p = shape.nodes[index];
            vertices.push(p.x);
            vertices.push(p.y);
        });
    }

    const holes = (shape.holes ?? []).map((hole) => {
        const length = vertices.length / 2;
        hole.forEach((vertex) => {
            vertices.push(vertex.x);
            vertices.push(vertex.y);
        });
        return length;
    });

    // console.timeEnd("Triangulate.Map To Earcut");

    // console.time("Triangulate.Earcut");
    const faces = earcut(vertices, holes);
    // console.timeEnd("Triangulate.Earcut");

    // console.time("Triangulate.Map To BufferGeometry");
    const N = faces.length;
    const faceVertices: number[] = [];
    for (let i = 0; i < N; i++) {
        const verticeIndex = faces[i] * 2;
        faceVertices.push(vertices[verticeIndex]);
        faceVertices.push(vertices[verticeIndex + 1]);
        faceVertices.push(0);
    }

    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(faceVertices), 3)
    );
    // console.timeEnd("Triangulate.Map To BufferGeometry");
    return bufferGeometry;
}
