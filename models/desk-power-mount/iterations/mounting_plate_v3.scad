// --- 1. 核心孔位设置 (对应你的桌子，不动) ---
hole_spacing_y = 40;   // 纵向间距 4cm
hole_spacing_x = 120;  // 横向间距 12cm

// --- 2. 结构与尺寸设置 ---
plate_thickness = 5;   // 厚度 5mm
mount_radius = 8;      // 螺丝孔周围实体基座的半径 (保证强度)
beam_width = 12;       // 连接梁的宽度

// --- 3. 孔与细节设置 ---
screw_hole_dia = 6;        // 螺丝孔 6mm
countersink_top_dia = 12;  // 沉头直径
reduce_pattern_dia = 6;    // 中间减重孔大小 (稍微改小一点适应窄梁)
reduce_pattern_gap = 3;    // 减重孔间隙

$fn = 30; // 圆滑度（加快渲染）

difference() {
    // ================== A. 生成实体骨架 ==================
    union() {
        // 1. 四个角的实体基座 (圆柱)
        for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
            for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
                translate([x, y, 0])
                    cylinder(r=mount_radius, h=plate_thickness);
            }
        }

        // 2. 横向连接梁 (连接左右孔)
        for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
            hull() {
                translate([-hole_spacing_x/2, y, 0]) cylinder(r=mount_radius, h=plate_thickness);
                translate([hole_spacing_x/2, y, 0]) cylinder(r=mount_radius, h=plate_thickness);
            }
        }

        // 3. 纵向连接梁 (连接上下孔) & 中心承托面
        // 直接用一个 hull 包裹四个基座，形成中心的实心区域
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

    // 1. 挖四个角的螺丝孔 (带沉头)
    for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
        for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
            // 通孔
            translate([x, y, -1])
                cylinder(d=screw_hole_dia, h=plate_thickness + 2);
            // 沉头
            translate([x, y, plate_thickness - (screw_hole_dia/2)])
                cylinder(d1=screw_hole_dia, d2=countersink_top_dia, h=(screw_hole_dia/2)+0.1);
        }
    }

    // 2. 挖中心区域的减重孔
    intersection() {
        // 定义打孔区域：只在四个孔围成的内部矩形区域打孔
        // 避开螺丝孔基座
        cube([hole_spacing_x - mount_radius*2, hole_spacing_y - mount_radius*1.5, 50], center=true);

        // 生成蜂窝网格
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
