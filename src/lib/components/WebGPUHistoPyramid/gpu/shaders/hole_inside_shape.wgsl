#include "common.wgsl"
#include "line_relations.wgsl"
#include "constants.wgsl"

@group(0) @binding(0) var<uniform> settings : Settings;
struct Settings {
    max_x: f32,
}

@group(1) @binding(0) var<storage, read> in_info: array<i32>;
@group(1) @binding(1) var<storage, read> in_points: array<vec2<f32>>;

// One point from each hole
@group(1) @binding(2) var<storage, read> in_point_per_hole: array<vec2<f32>>;

@group(2) @binding(0) var<storage, read_write> out_winding_shape: array<i32>;

struct Relation {
    rel: i32,
    mua: f32,
    mub: f32,
}

struct ProcessedRelation {
    error: bool,
    on_perimiter: bool,
    line_winding: i32,
}

@compute @workgroup_size(256)
fn main(in: ComputeInput) {
    let id = in.global_id.x;
    let line_count = arrayLength(&in_points);
    let hole_count = arrayLength(&in_point_per_hole);

    let x = id % line_count;
    let y = id / line_count;
    
    if (y >= hole_count || x >= line_count) {
        return;
    }

    let info = in_info[x];
    let is_end = info < 0;
    let shape = in_info[x - u32(is_end)];

    let point = in_point_per_hole[y];
    let ray_end = vec2(settings.max_x, point.y);


    let c_index = x;
    let d_index = x + 1 - u32(is_end) * u32(abs(info));

    var c = in_points[c_index];
    var d = in_points[d_index];

    // Make sure that the points are not on the ray
    if (is_equal(point.y, c.y)) {
        c.y = c.y + 4 * TOLERANCE;
    }
    if (is_equal(point.y, d.y)) {
        d.y = d.y + 4 * TOLERANCE;
    }

    let res = find_relation(
        vec3<f32>(ray_end, 0.0), // far right
        vec3<f32>(point, 0.0), // point
        vec3<f32>(c, 0.0), 
        vec3<f32>(d, 0.0)
    );
    
    let processed = process_relation(res, point, c, d);
    if (processed.error) { return; }

    out_winding_shape[y * line_count + x] = processed.line_winding * (shape + 1);
}

fn process_relation(r: Relation, point: vec2<f32>, c: vec2<f32>, d: vec2<f32>) -> ProcessedRelation {
    var error = false;
    let on_perimiter = is_equal(r.mua, 1.0);
    var line_winding = 0;


    switch r.rel {
        case INTERSECTION, CORNER {
            if (r.mua == 0.0) {
                error = true;
            }  else if (is_greater(point.y, c.y)) {
                line_winding = 1;
            } else if (is_less(point.y, c.y)) {
                line_winding = -1;
            } else {
                if (is_less(point.y, d.y)) {
                    line_winding = 1;
                } else if (is_greater(point.y, d.y)) {
                    line_winding = -1;
                } else {
                    line_winding = 0;
                }
            }
        }
        case COVER, COVER_END, PRE, RIPPED, IMPLODE, NONE { 
        }
        default {
            error = true;
        }

    }

    return ProcessedRelation(error, on_perimiter, line_winding);
}

fn find_relation(
   p1: vec3<f32>, p2: vec3<f32>, p3: vec3<f32>, p4: vec3<f32>) -> Relation
{
    let FALSE_RELATION: Relation = Relation(NONE, FALSE_FLOAT, FALSE_FLOAT);

    var a_loc: f32;
    var b_loc: f32;
    var c_loc: f32;
    var d_loc: f32;

    let a_is_b = is_equal_v3(p1, p2);
    let a_is_c = is_equal_v3(p1, p3);
    let a_is_d = is_equal_v3(p1, p4);
    let b_is_c = is_equal_v3(p2, p3);
    let b_is_d = is_equal_v3(p2, p4);
    let c_is_d = is_equal_v3(p3, p4);

    let a_in_cd = is_on_line(p3, p4, p1, &a_loc);
    let b_in_cd = is_on_line(p3, p4, p2, &b_loc);
    let c_in_ab = is_on_line(p1, p2, p3, &c_loc);
    let d_in_ab = is_on_line(p1, p2, p4, &d_loc);

    // Check that lines are not points
    if (a_is_b || c_is_d) { return FALSE_RELATION; }

    // Begin and end point intersections
    if (c_in_ab) { return Relation(INTERSECTION, 0.5, 0.5); }
    if (d_in_ab) { return Relation(INTERSECTION, 0.5, 0.5); }
    // if (a_is_d && !b_in_cd && !c_in_ab) { return Relation(INTERSECTION, 0.0, 1.0); }
    // if (b_is_c && !a_in_cd && !d_in_ab) { return Relation(INTERSECTION, 1.0, 0.0); }
    
    /*
    // Check Cancel && Corner
    if (a_is_c && b_is_d) { return Relation(CANCEL, PLACEHOLDER, PLACEHOLDER); }
    if (b_is_d && !a_in_cd && !c_in_ab) { return Relation(CORNER, 1.0, 1.0); }
    if (a_is_c && !b_in_cd && !d_in_ab) { return Relation(CORNER, 0.0, 0.0); }

    // Check Rip && Ripped && Explode && Implode
    if (a_in_cd && b_in_cd && a_loc > b_loc) { return Relation(RIP, PLACEHOLDER, PLACEHOLDER); }
    if (c_in_ab && d_in_ab && c_loc > d_loc) { return Relation(RIPPED, PLACEHOLDER, PLACEHOLDER); }
    if (a_in_cd && c_in_ab && !b_in_cd && !d_in_ab) { return Relation(EXPLODE, PLACEHOLDER, PLACEHOLDER); }
    if (b_in_cd && d_in_ab && !a_in_cd && !c_in_ab) { return Relation(IMPLODE, PLACEHOLDER, PLACEHOLDER); }

    // Check Covers
    if (a_is_c && b_in_cd && !d_in_ab) { return Relation(COVERED_START, PLACEHOLDER, PLACEHOLDER); }
    if (a_is_c && !b_in_cd && d_in_ab) { return Relation(COVER_START, PLACEHOLDER, PLACEHOLDER); }
    if (b_is_d && a_in_cd && !c_in_ab) { return Relation(COVERED_END, PLACEHOLDER, PLACEHOLDER); }
    if (b_is_d && !a_in_cd && c_in_ab) { return Relation(COVER_END, PLACEHOLDER, PLACEHOLDER); }
    if (!a_in_cd && b_in_cd && c_in_ab && !d_in_ab) { return Relation(PRE, c_loc, PLACEHOLDER); }
    if (a_in_cd && !b_in_cd && !c_in_ab && d_in_ab) { return Relation(PRO, d_loc, PLACEHOLDER); }
    if (a_in_cd && b_in_cd && !c_in_ab && !d_in_ab) { return Relation(COVERED, PLACEHOLDER, PLACEHOLDER); }
    if (!a_in_cd && !b_in_cd && c_in_ab && d_in_ab) { return Relation(COVER, PLACEHOLDER, PLACEHOLDER); }
    
    // Others
    if (a_in_cd || c_in_ab || a_is_d || b_is_c) { return FALSE_RELATION; }
    */
    // if (b_in_cd) { return Relation(INTERSECTION, 1.0, b_loc); }
    // if (d_in_ab) { return Relation(INTERSECTION, d_loc, 1.0); }

    // Intersection
    let p13 = p1 - p3;
    let p43 = p4 - p3;
    let p21 = p2 - p1;

    let d1343 = dot(p13, p43);
    let d4321 = dot(p43, p21);
    let d1321 = dot(p13, p21);
    let d4343 = dot(p43, p43);
    let d2121 = dot(p21, p21);

    let denom = d2121 * d4343 - d4321 * d4321;
    if (is_zero(denom)) {
        return FALSE_RELATION;
    }
    let numer = d1343 * d4321 - d1321 * d4343;

    var mua = numer / denom;
    var mub = (d1343 + d4321 * (mua)) / d4343;

    let pa = p1 + p21 * mua;
    let pb = p3 + p43 * mub;

    let result = pa - pb;

    let valid_a = is_in_range(mua, 0.0, 1.0);
    let valid_b = is_in_range(mub, 0.0, 1.0);
    let valid_r = is_zero(dot(result, result));

    if (valid_a && valid_b && valid_r) {
        return Relation(INTERSECTION, mua, mub);
    }
    return FALSE_RELATION;
}
