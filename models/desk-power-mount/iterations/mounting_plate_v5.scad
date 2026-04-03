// --- 1. 核心尺寸设置 ---
// 孔距 (固定不可变，对应你的桌底)
hole_spacing_y = 40;
hole_spacing_x = 120;
plate_thickness = 5;  // 板厚

// --- 2. 结构细节设置 ---
screw_hole_dia = 6;        // M6螺丝孔
countersink_top_dia = 12;  // 沉头直径
mount_radius = 8;          // 安装座的半径 (保证强度，需大于沉头半径)

// 中间连接板的宽度
// 这个宽度决定了侧边"切掉"多少。设为和纵向孔距一致比较美观。
connect_plate_wid = hole_spacing_y;

reduce_pattern_dia = 6;    // 中间减重孔的直径
reduce_pattern_gap = 4;    // 减重孔之间的间隙

$fn = 30; // 圆滑度

difference() {
    // ================== A. 生成主体骨架 (Union组合) ==================
    union() {
        // 1. 左侧跑道形安装块 (连接左侧上下两孔)
        hull() {
            translate([-hole_spacing_x/2, -hole_spacing_y/2, 0])
                cylinder(r=mount_radius, h=plate_thickness);
            translate([-hole_spacing_x/2, hole_spacing_y/2, 0])
                cylinder(r=mount_radius, h=plate_thickness);
        }

        // 2. 右侧跑道形安装块 (连接右侧上下两孔)
        hull() {
            translate([hole_spacing_x/2, -hole_spacing_y/2, 0])
                cylinder(r=mount_radius, h=plate_thickness);
            translate([hole_spacing_x/2, hole_spacing_y/2, 0])
                cylinder(r=mount_radius, h=plate_thickness);
        }

        // 3. 中间矩形连接板 (连接左右两块)
        // 它的宽度比两边的块窄，从而实现了侧边的切除效果
        translate([0, 0, plate_thickness/2])
            cube([hole_spacing_x, connect_plate_wid, plate_thickness], center=true);
    }

    // ================== B. 挖孔操作 ==================

    // 1. 挖四个角落的螺丝孔 (带沉头)
    for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
        for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
            // 通孔
            translate([x, y, -1])
                cylinder(d=screw_hole_dia, h=plate_thickness + 2);

            // 沉头 (锥体)
            translate([x, y, plate_thickness - (screw_hole_dia/2)])
                cylinder(d1=screw_hole_dia, d2=countersink_top_dia, h=(screw_hole_dia/2)+0.1);
        }
    }

    // 2. 挖中间的减重孔
    intersection() {
        // 定义打孔区域：只在中间连接板的范围内
        // 长度上要避开左右安装块的圆角区域
        hole_area_length = hole_spacing_x - mount_radius*2;
        hole_area_width = connect_plate_wid - 4; // 留一点边距，不打断边缘

        cube([hole_area_length, hole_area_width, 50], center=true);

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
