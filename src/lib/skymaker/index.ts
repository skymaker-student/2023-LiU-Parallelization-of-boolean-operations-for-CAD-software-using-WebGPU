import { initWorld } from "./Visualization";

import { createRandomGeometry, generateRectangleShape, generateLinesFromShape } from "./geometry";

import { splitGeometry } from "./split";
import { unionGeometry } from "./union";
import { triangulate } from "./triangulation";

import * as Math from "./Math";

export const CAD = {
    initWorld,
    createRandomGeometry,
    generateRectangleShape,
    generateLinesFromShape,
    split: (geometry: Geometry) => splitGeometry(geometry).geometry,
    union: unionGeometry,
    triangulate,
    ...Math,
};

export const MATH = Math;
