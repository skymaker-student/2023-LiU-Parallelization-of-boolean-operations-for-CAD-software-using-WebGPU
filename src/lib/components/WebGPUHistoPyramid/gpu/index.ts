import {
    generateHistoPyramidBuffers,
    generateShapeBuffers,
    generateNewShapesBuffers,
    generateHolePointsBuffer,
} from "./generateBuffers";
import { buildPyramid } from "./histoPyramid";
import { filterIntersections } from "./intersections";
import { buildNewShapesFromPyramid } from "./buildNewShapes";
import { filterSegments } from "./filterSegments";
import { segmentLines } from "./segmentLines";

export const WORKGROUP_SIZE = 256;
export const MAX_WORKERS = 65535 * WORKGROUP_SIZE;

export {
    generateHistoPyramidBuffers,
    generateNewShapesBuffers,
    generateShapeBuffers,
    generateHolePointsBuffer,
    segmentLines,
    buildPyramid,
    filterSegments,
    buildNewShapesFromPyramid,
    filterIntersections,
};
