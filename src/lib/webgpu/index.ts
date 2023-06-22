import { splitGeometry } from "./split/split";
import { unionGeometry } from "./union/union";
import { TOLERANCE } from "./common/constants";
import { intersections } from "./intersection/intersection";

export const GPU = {
    split: async (geometry: Geometry) => (await splitGeometry(geometry)).geometry,
    union: (geometry: Geometry) => unionGeometry(geometry),
    // intersections: (geometry: Geometry) => intersections(geometry),

    splitGeometry,
    unionGeometry,
    intersections,
    TOLERANCE,
};
