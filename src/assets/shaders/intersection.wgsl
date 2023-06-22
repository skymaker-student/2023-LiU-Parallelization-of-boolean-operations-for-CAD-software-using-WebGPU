
@group(0) @binding(0) var<storage, read> segment: Line;
@group(0) @binding(1) var<storage, read> input: array<Line>;
struct Line {
    start: vec3<f32>,
    end: vec3<f32>,
}
@group(0) @binding(2) var<storage, read_write> output : array<f32>;
@group(0) @binding(3) var<uniform> settings : Settings;
struct Settings {
    tolerance: f32,
    count: u32,
}


struct ComputeInput {
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(local_invocation_index) local_index: u32,
    @builtin(workgroup_id) wg_id : vec3<u32>,
    @builtin(num_workgroups) wg_count : vec3<u32>,
    @builtin(global_invocation_id) global_id: vec3<u32>
}

@compute @workgroup_size(256)
fn main(in: ComputeInput) {
    if (in.global_id.x > settings.count) {
        return;
    }
    
    let ln_a = segment;
    let ln_b = input[in.global_id.x];

    // let res = intersects(ln_a, ln_b);
    let res = intersects(ln_a.start, ln_a.end, ln_b.start, ln_b.end);
    
    output[in.global_id.x] = f32(res);
}

const false_float = -10.0;
fn intersects(
   p1: vec3<f32>, p2: vec3<f32>, p3: vec3<f32>, p4: vec3<f32>) -> f32
{
    let eps = settings.tolerance;

    let p13 = p1 - p3;
    let p43 = p4 - p3;

    var value: f32;
    if (isOnLine(p1, p2, p3, &value) || 
        isOnLine(p1, p2, p4, &value) ||
        isOnLine(p3, p4, p1, &value) ||
        isOnLine(p3, p4, p2, &value)) {
        return value;
    }
    
    if (abs(p43.x) < eps && abs(p43.y) < eps && abs(p43.z) < eps) {
        return false_float;
    }
    
    let p21 = p2 - p1;
    if (abs(p21.x) < eps && abs(p21.y) < eps && abs(p21.z) < eps) {
        return false_float;
    }

    let d1343 = dot(p13, p43);
    let d4321 = dot(p43, p21);
    let d1321 = dot(p13, p21);
    let d4343 = dot(p43, p43);
    let d2121 = dot(p21, p21);

    let denom = d2121 * d4343 - d4321 * d4321;
    if (abs(denom) < eps) {
        return false_float;
    }
    let numer = d1343 * d4321 - d1321 * d4343;

    let mua = numer / denom;
    let mub = (d1343 + d4321 * (mua)) / d4343;

    let pa = p1 + p21 * mua;
    let pb = p3 + p43 * mub;

    let result = pa - pb;

    let valid_a = mua >= -eps && mua <= 1.0 + eps;
    let valid_b = mub >= -eps && mub <= 1.0 + eps;

    if (valid_a && valid_b && dot(result, result) < settings.tolerance * settings.tolerance) {
        return mua;
    }
    return false_float;
}

fn isOnLine(start: vec3<f32>, end: vec3<f32>, point: vec3<f32>, value: ptr<function, f32>) -> bool {
    let eps = settings.tolerance;
    let v1 = end - start;
    let v2 = point - start;

    let cross = cross(v1, v2);
    let dot = dot(v1, v2) / dot(v1, v1);

    *value = dot;
    return dot >= -eps && dot <= 1.0 + eps && all(abs(cross) < vec3<f32>(eps));
}
