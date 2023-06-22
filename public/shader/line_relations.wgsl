constant NONE          : i32;   

constant INTERSECTION  : i32;   // Intersection that is non of the below

constant COVER         : i32;   // Fully inside other line, same direction
constant COVERED       : i32;   // Fully covering other line, same direction
constant COVER_START   : i32;   // Fully inside other line, same direction, same start point
constant COVERED_START : i32;   // Fully covering other line, same direction, same start point
constant COVER_END     : i32;   // Fully inside other line, same direction, same end point
constant COVERED_END   : i32;   // Fully covering other line, same direction, same end point
constant PRE           : i32;   // Share interval with other line, moving into other line
constant PRO           : i32;   // Share interval with other line, moving out of other line

constant RIP           : i32;   // Fully inside other line, different direction
constant RIPPED        : i32;   // Fully covering other line, different direction
constant IMPLODE       : i32;   // Share interval with other line, moving into each other
constant EXPLODE       : i32;   // Share interval with other line, moving out of each other

constant CORNER        : i32;   // Same end points, useful for merging shapes touching corners
constant CANCEL        : i32;   // Same start and end points

constant SELF          : i32;   // Looking at itself
















