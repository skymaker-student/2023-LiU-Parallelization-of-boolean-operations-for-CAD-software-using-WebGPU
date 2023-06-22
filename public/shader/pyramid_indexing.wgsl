#include "constants.wgsl"

fn index_up(start_offset: u32) -> u32 {
    var offset = start_offset;
    var id = 0u;

    var inner: u32;
    var outer: u32;

    inner = offset % 4;
    outer = offset / 4;

    for (var i = offset - inner; i < offset; i++) {
        id += parse_enum(angles_values[i]);
    }

    offset = outer;

    var start = 0u;
    let layers = settings.layers - 1u;
    for (var l = layers; l > 0; l--) {
        inner = offset % 4;
        outer = offset / 4;

        for (var i = offset - inner; i < offset; i++) {
            id += pyramid_layers[start + i];
        }

        offset = outer;

        start += (1u << (2u * l));
    }

    inner = offset % 4;
    outer = offset / 4;

    // for (var i = offset - inner; i < offset; i++) {
    //     id += pyramid_layers[i];
    // }

    return id;
}

fn index_down(id: u32) -> u32 {
    var current = 0u;
    var offset = 0u;
    var middle_layer_offset = ((1u << ((settings.layers) * 2u)) - 16u) / 3u + 4u;
    var middle_layer_size = 1u;

    let layers = settings.layers;
    for (var l = 0u; l < layers; l++) {
        if (l < layers - 1u) {
            middle_layer_size *= 4u;
            middle_layer_offset -= middle_layer_size;

            for (var i = 0u; i < 4u; i++) {
                if (current + pyramid_layers[middle_layer_offset + offset] > id) {
                    break;
                }
                current += pyramid_layers[middle_layer_offset + offset];
                offset += 1u;
            }
        } else {
            for (var i = 0u; i < 4u; i++) {
                let val = parse_enum(angles_values[offset]);
                if (current + val > id) {
                    break;
                }
                current += val;
                offset += 1u;
            }
        }
        
        if (l < layers - 1u) {
            offset *= 4u;
        }
    }

    // if expansion:
    //     return index: offset, slot: id - current
    return offset;
}

fn parse_enum(val: vec2<f32>) -> u32 {
    return u32(is_in_interval(val.y, OPEN, OPEN, -1.0, 1.0) && is_less(val.x, TWO_PI));
}
