@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> output : array<u32>;
@group(0) @binding(2) var<uniform> settings : Settings;
struct Settings {
    width: u32,
    height: u32,
}


/// 5x5 Gaussian blur 
// const kernel = array(
//     array(41, 26, 7),
//     array(26, 16, 4),
//     array(7,  4,  1),
// );
// const kernel_divisor = 273;
// const radius: u32 = 2;


/// 7x7 Gaussian blur 
// const kernel = array(
//     array(159, 97, 22, 2),
//     array(97,  59, 13, 1),
//     array(22,  13, 3,  0),
//     array(2,   1,  0,  0),
// );
// const kernel_divisor = 1003;     
// const radius: u32 = 3;

/// 9x9 Simple blur 
const kernel = array(
    array(1, 1, 1, 1, 1),
    array(1, 1, 1, 1, 1),
    array(1, 1, 1, 1, 1),
    array(1, 1, 1, 1, 1),
    array(1, 1, 1, 1, 1),
);
const kernel_divisor = 9 * 9;
const radius: u32 = 4;

// override radius = 2;
const workgroup_dim: u32 = 16;
const workgroup_size: u32 = workgroup_dim * workgroup_dim;
// override workgroup_data_size = (radius * 2 + workgroup_dim);
const workgroup_data_size: u32 = (radius * 2 + workgroup_dim);

var<workgroup> data: array<u32, workgroup_data_size * workgroup_data_size>;
fn toIndex(pos: vec2<u32>, size: u32) -> u32 {
    return pos.x + pos.y * size;
}

fn getData(pos: vec2<i32>) -> u32 {
    let l_pos = vec2<u32>(pos + vec2<i32>(i32(radius), i32(radius)));
    return l_pos.x + l_pos.y * workgroup_data_size;
}

@compute @workgroup_size(workgroup_dim, workgroup_dim)
fn main(
        @builtin(local_invocation_id) local_id : vec3<u32>,
        @builtin(local_invocation_index) local_index: u32,
        @builtin(workgroup_id) wg_id : vec3<u32>,
        @builtin(global_invocation_id) global_id : vec3<u32>, 
    ) {

    let global_index = global_id.x + global_id.y * settings.width;
    let data_index = local_id.xy + vec2<u32>(radius, radius);

    let start = vec2<u32>(wg_id.x * workgroup_dim, wg_id.y * workgroup_dim);

    // Load data into workgroup memory
    {
        let data_start = vec2<i32>(start) - vec2<i32>(i32(radius), i32(radius));
        let max_index = workgroup_data_size * workgroup_data_size;
        
        var i = local_id.x + local_id.y * workgroup_dim;
        loop {
            let offset = vec2<u32>(i % workgroup_data_size, i / workgroup_data_size);
            var next = data_start + vec2<i32>(offset);

            // Guard against out-of-bounds data
            if (next.x < 0) {
                next.x = 0;
            } else if (next.x >= i32(settings.width)) {
                next.x = i32(settings.width) - 1;
            }
            if (next.y < 0) {
                next.y = 0;
            } else if (next.y >= i32(settings.height)) {
                next.y = i32(settings.height) - 1;
            }

            data[offset.x + offset.y * workgroup_data_size] = input[next.x + next.y * i32(settings.width)];

            continuing {
                i += workgroup_size;
                break if i >= max_index;
            }
        }
    }
    workgroupBarrier();


    // Guard against out-of-bounds work group sizes
    if (global_index >= settings.width * settings.height) {
        return;
    }

    // Process

    var result = vec4<u32>(0, 0, 0, 255);
    for (var y = -i32(radius); y <= i32(radius); y += 1) {
        for (var x = -i32(radius); x <= i32(radius); x += 1) {
            var index = getData(vec2<i32>(local_id.xy) + vec2<i32>(x, y));
            var color = split(data[index]);

            var kernel_index = vec2<i32>(abs(x), abs(y));
            var kernel_multiplier = u32(kernel[x][y]);
            
            result.r += color.r * kernel_multiplier;
            result.g += color.g * kernel_multiplier;
            result.b += color.b * kernel_multiplier;
        }
    }
    result /= kernel_divisor;
    result.a = 255;
    output[global_index] = merge(result);
}

fn getInput(pos: vec2<i32>) -> u32 {
    var l_pos = vec2<u32>(pos + vec2<i32>(i32(radius), i32(radius)));
    if (l_pos.x < 0) {
        l_pos.x = 0;
    } else if (l_pos.x >= settings.width) {
        l_pos.x = settings.width - 1;
    }
    if (l_pos.y < 0) {
        l_pos.y = 0;
    } else if (l_pos.y >= settings.height) {
        l_pos.y = settings.height - 1;
    }
    return l_pos.x + l_pos.y * settings.width;
}


@compute @workgroup_size(workgroup_dim, workgroup_dim)
fn main_glob(
        @builtin(local_invocation_id) local_id : vec3<u32>,
        @builtin(local_invocation_index) local_index: u32,
        @builtin(workgroup_id) wg_id : vec3<u32>,
        @builtin(global_invocation_id) global_id : vec3<u32>, 
    ) {

    let global_index = global_id.x + global_id.y * settings.width;

    // Guard against out-of-bounds work group sizes
    if (global_index >= settings.width * settings.height) {
        return;
    }

    // Process
    var result = vec4<u32>(0, 0, 0, 255);
    for (var y = -i32(radius); y <= i32(radius); y += 1) {
        for (var x = -i32(radius); x <= i32(radius); x += 1) {
            var index = getInput(vec2<i32>(global_id.xy) + vec2<i32>(x, y));
            var color = split(input[index]);

            var kernel_index = vec2<i32>(abs(x), abs(y));
            var kernel_multiplier = u32(kernel[x][y]);
            
            result.r += color.r * kernel_multiplier;
            result.g += color.g * kernel_multiplier;
            result.b += color.b * kernel_multiplier;
        }
    }
    result /= kernel_divisor;
    result.a = 255;
    output[global_index] = merge(result);
}

fn split(color: u32) -> vec4<u32> {
    let r = color & 0xFF;
    let g = (color >> 8) & 0xFF;
    let b = (color >> 16) & 0xFF;
    let a = (color >> 24) & 0xFF;
    return vec4<u32>(r, g, b, a);
}

fn merge(color: vec4<u32>) -> u32 {
    return (color.r << 0) | (color.g << 8) | (color.b << 16) | (color.a << 24);
}
