fn is_on_line(start: vec3<f32>, end: vec3<f32>, point: vec3<f32>, value: ptr<function, f32>) -> bool {
    let v1 = end - start;
    let v2 = point - start;

    let cross = cross(v1, v2);
    let dot = dot(v1, v2) / dot(v1, v1);

    *value = dot;
    
    return is_in_range(dot, 0.0, 1.0) && is_zero_v3(cross);
}

fn cross_2D(a: vec2<f32>, b: vec2<f32>) -> f32 {
    return a.x * b.y - b.x * a.y;
}