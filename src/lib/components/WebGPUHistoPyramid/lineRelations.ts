const NONE = 0;

const INTERSECTION = 1; // Intersection that is non of the below

const COVERED = 2; // Fully inside other line, same direction
const COVER = 3; // Fully covering other line, same direction
const COVER_START = 4; // Fully inside other line, same direction, same start point
const COVERED_START = 5; // Fully covering other line, same direction, same start point
const COVER_END = 6; // Fully inside other line, same direction, same end point
const COVERED_END = 7; // Fully covering other line, same direction, same end point
const PRE = 8; // Share interval with other line, moving into other line
const PRO = 9; // Share interval with other line, moving out of other line

const RIP = 10; // Fully inside other line, different direction
const RIPPED = 11; // Fully covering other line, different direction
const IMPLODE = 12; // Share interval with other line, moving into each other
const EXPLODE = 13; // Share interval with other line, moving out of each other

const CORNER = 14; // Same end points, useful for merging shapes touching corners
const CANCEL = 15; // Same start and end points

const SELF = 16; // Looking at itself

export const lineRelationEnums = {
    NONE,
    INTERSECTION,
    COVERED,
    COVER,
    COVER_START,
    COVERED_START,
    COVER_END,
    COVERED_END,
    PRE,
    PRO,
    RIP,
    RIPPED,
    IMPLODE,
    EXPLODE,
    CORNER,
    CANCEL,
    SELF,
};
