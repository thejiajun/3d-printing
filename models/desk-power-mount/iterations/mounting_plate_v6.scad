// --- 1. 尺寸参数 (你可以随时调整) ---

// [新增] 中间大承托板的尺寸
center_plate_width = 90;   // 红色区域的宽度 (9cm)
center_plate_length = 150; // 红色区域的长度 (15cm)

// [固定] 核心孔位 (对应桌底)
hole_spacing_x = 120; // 左右孔距
hole_spacing_y = 40;  // 上下孔距

// 结构厚度 (建议稍微厚一点保证强度)
plate_thickness = 5;

// --- 2. 细节设置 ---
screw_hole_dia = 6;        // M6螺丝孔
countersink_top_dia = 12;  // 沉头直径
mount_radius = 8;          // 安装座半径
reduce_pattern_dia = 8;    // 减重孔直径
reduce_pattern_gap = 4;    // 减重孔间隙

$fn = 30; // 圆滑度

difference() {
    // ================== A. 生成主体 (十字形) ==================
    union() {
        // 1. 中间的大平台 (90mm x 150mm)
        // 对应你图片中的红色长方形区域
        translate([0, 0, plate_thickness/2])
            cube([center_plate_width, center_plate_length, plate_thickness], center=true);

        // 2. 左侧安装耳 (连接左边上下孔)
        hull() {
            translate([-hole_spacing_x/2, -hole_spacing_y/2, 0])
                cylinder(r=mount_radius, h=plate_thickness);
            translate([-hole_spacing_x/2, hole_spacing_y/2, 0])
                cylinder(r=mount_radius, h=plate_thickness);
            // 稍微向内延伸一点，确保和中间平台连接牢固
            translate([-center_plate_width/2 + 5, 0, plate_thickness/2])
                 cube([10, 20, plate_thickness], center=true);
        }

        // 3. 右侧安装耳 (连接右边上下孔)
        hull() {
            translate([hole_spacing_x/2, -hole_spacing_y/2, 0])
                cylinder(r=mount_radius, h=plate_thickness);
            translate([hole_spacing_x/2, hole_spacing_y/2, 0])
                cylinder(r=mount_radius, h=plate_thickness);
            // 稍微向内延伸一点
            translate([center_plate_width/2 - 5, 0, plate_thickness/2])
                 cube([10, 20, plate_thickness], center=true);
        }
    }

    // ================== B. 挖孔操作 ==================

    // 1. 挖螺丝孔 (带沉头)
    for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
        for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
            translate([x, y, -1])
                cylinder(d=screw_hole_dia, h=plate_thickness + 2);
            translate([x, y, plate_thickness - (screw_hole_dia/2)])
                cylinder(d1=screw_hole_dia, d2=countersink_top_dia, h=(screw_hole_dia/2)+0.1);
        }
    }

    // 2. 挖全域减重孔 (覆盖整个十字架)
    intersection() {
        // 定义打孔范围：覆盖整个模型
        union() {
             cube([center_plate_width-4, center_plate_length-4, 100], center=true);
             cube([hole_spacing_x, hole_spacing_y, 100], center=true);
        }

        // 避开螺丝孔周围 (保留实体)
        difference() {
            cube([200, 200, 50], center=true); // 基础范围
            for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
                for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
                    translate([x, y, 0])
                        cylinder(r=mount_radius + 2, h=100, center=true);
                }
            }
        }

        // 生成蜂窝网格
        union() {
            for (x_pos = [-center_plate_width : reduce_pattern_dia+reduce_pattern_gap : center_plate_width]) {
                for (y_pos = [-center_plate_length/2 : reduce_pattern_dia+reduce_pattern_gap : center_plate_length/2]) {
                    translate([x_pos + (y_pos%2 * (reduce_pattern_dia/2)), y_pos, -1])
                        cylinder(d=reduce_pattern_dia, h=plate_thickness + 2);
                }
            }
        }
    }
}
