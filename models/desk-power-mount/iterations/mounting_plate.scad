// --- 1. 参数设置 (在这里修改尺寸) ---

// 【关键修改】两个孔之间的"纵向"宽度 (原本是40，现在改大以容纳充电器)
// 请把 80 改成你需要的实际毫米数
hole_spacing_y = 80;

// 两个孔之间的"横向"长度 (保持 120mm 不变)
hole_spacing_x = 120;

// 板子的厚度 (5mm)
plate_thickness = 5;

// 孔到边缘保留的安全距离
margin = 10;

// 四个角的圆滑程度
corner_radius = 4;

// --- 2. 螺丝孔设置 ---
screw_hole_dia = 6;       // 螺丝孔直径 (6mm)
countersink_top_dia = 12; // 沉头孔顶部的直径 (让螺丝头埋进去)

// --- 3. 中间减重孔设置 ---
reduce_pattern_dia = 8;   // 圆孔大小
reduce_pattern_gap = 4;   // 圆孔间隙

// --- 以下是计算逻辑 (无需修改) ---
total_width = hole_spacing_x + (margin * 2);
total_depth = hole_spacing_y + (margin * 2);
$fn = 60; // 圆滑度

difference() {
    // 1. 生成主体板子
    hull() {
        translate([-(total_width/2)+corner_radius, -(total_depth/2)+corner_radius, 0])
            cylinder(r=corner_radius, h=plate_thickness);
        translate([(total_width/2)-corner_radius, -(total_depth/2)+corner_radius, 0])
            cylinder(r=corner_radius, h=plate_thickness);
        translate([-(total_width/2)+corner_radius, (total_depth/2)-corner_radius, 0])
            cylinder(r=corner_radius, h=plate_thickness);
        translate([(total_width/2)-corner_radius, (total_depth/2)-corner_radius, 0])
            cylinder(r=corner_radius, h=plate_thickness);
    }

    // 2. 挖四个角落的螺丝孔
    for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
        for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
            // 通孔
            translate([x, y, -1])
                cylinder(d=screw_hole_dia, h=plate_thickness + 2);

            // 沉头 (锥形孔)，默认在顶面
            translate([x, y, plate_thickness - (screw_hole_dia/2)])
                cylinder(d1=screw_hole_dia, d2=countersink_top_dia, h=(screw_hole_dia/2)+0.1);
        }
    }

    // 3. 挖中间的减重孔 (自动适应新的宽度)
    intersection() {
        // 定义打孔区域：避开四周的螺丝孔
        cube([hole_spacing_x - 15, hole_spacing_y - 15, 50], center=true);

        union() {
            // 生成蜂窝状排列的圆柱体用于切割
            for (x_pos = [-total_width/2 : reduce_pattern_dia+reduce_pattern_gap : total_width/2]) {
                for (y_pos = [-total_depth/2 : reduce_pattern_dia+reduce_pattern_gap : total_depth/2]) {
                    // 交错排列 logic
                    translate([x_pos + (y_pos%2 * (reduce_pattern_dia/2)), y_pos, -1])
                        cylinder(d=reduce_pattern_dia, h=plate_thickness + 2);
                }
            }
        }
    }
}
