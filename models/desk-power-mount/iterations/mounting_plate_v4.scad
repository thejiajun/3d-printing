// --- 1. 核心参数 ---
plate_thickness = 3;   // 【修改】厚度减为 3mm (极限薄度)

// 孔距 (固定)
hole_spacing_y = 40;
hole_spacing_x = 120;

// --- 2. 结构尺寸 ---
mount_radius = 7;      // 螺丝座半径 (稍微缩小一点点)
beam_width = 10;       // 连接梁宽度 (稍微收窄)

// --- 3. 孔与细节 ---
screw_hole_dia = 6;        // M6 螺丝
countersink_top_dia = 12;  // 沉头直径 (M6标准头约为11-12mm)
reduce_pattern_dia = 5;    // 减重孔缩小以适应薄板
reduce_pattern_gap = 3;

$fn = 30;

difference() {
    // ================== A. 生成实体骨架 ==================
    union() {
        // 1. 四个角的实体基座
        for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
            for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
                translate([x, y, 0])
                    cylinder(r=mount_radius, h=plate_thickness);
            }
        }

        // 2. 连接这四个点的"肉" (形成承托面)
        hull() {
             for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
                for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
                    translate([x, y, 0])
                        cylinder(r=mount_radius, h=plate_thickness);
                }
            }
        }
    }

    // ================== B. 挖孔操作 ==================

    // 1. 挖螺丝孔 (注意：3mm厚度下，沉头孔几乎贯穿)
    for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
        for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
            // 通孔
            translate([x, y, -1])
                cylinder(d=screw_hole_dia, h=plate_thickness + 2);
            // 沉头 (锥体)
            // M6沉头深约3mm，这里刚好切到底
            translate([x, y, plate_thickness - (3.5)])
                cylinder(d1=screw_hole_dia, d2=13, h=3.6);
        }
    }

    // 2. 挖中心减重孔
    intersection() {
        // 限制打孔区域，避开螺丝座
        cube([hole_spacing_x - mount_radius*2, hole_spacing_y - mount_radius, 50], center=true);

        // 蜂窝网格
        union() {
            for (x_pos = [-hole_spacing_x/2 : reduce_pattern_dia+reduce_pattern_gap : hole_spacing_x/2]) {
                for (y_pos = [-hole_spacing_y/2 : reduce_pattern_dia+reduce_pattern_gap : hole_spacing_y/2]) {
                    translate([x_pos + (y_pos%2 * (reduce_pattern_dia/2)), y_pos, -1])
                        cylinder(d=reduce_pattern_dia, h=plate_thickness + 2);
                }
            }
        }
    }
}
