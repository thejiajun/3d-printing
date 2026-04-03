// --- 1. 板子外观尺寸 (你可以随意把这些改大) ---

// 你希望板子总共多宽？(建议比充电器宽一点，比如 80mm)
total_width_y = 80;

// 你希望板子总共多长？(为了盖住120mm的孔，建议至少 140mm)
total_length_x = 140;

// 板子厚度 (保持 5mm)
plate_thickness = 5;

// --- 2. 核心孔位设置 (这些不要动，对应你的桌子) ---

// 桌底螺丝孔的纵向间距 (固定 4cm)
hole_spacing_y = 40;

// 桌底螺丝孔的横向间距 (固定 12cm)
hole_spacing_x = 120;

// --- 3. 细节设置 ---
corner_radius = 4;        // 圆角
screw_hole_dia = 6;       // 螺丝孔直径 6mm
countersink_top_dia = 12; // 沉头直径 (螺丝头埋进去)
reduce_pattern_dia = 8;   // 减重孔大小
reduce_pattern_gap = 4;   // 减重孔间隙

$fn = 30; // 圆滑度（降低以加快渲染）

difference() {
    // 1. 生成主体板子 (根据你设定的 total 尺寸)
    hull() {
        translate([-(total_length_x/2)+corner_radius, -(total_width_y/2)+corner_radius, 0])
            cylinder(r=corner_radius, h=plate_thickness);
        translate([(total_length_x/2)-corner_radius, -(total_width_y/2)+corner_radius, 0])
            cylinder(r=corner_radius, h=plate_thickness);
        translate([-(total_length_x/2)+corner_radius, (total_width_y/2)-corner_radius, 0])
            cylinder(r=corner_radius, h=plate_thickness);
        translate([(total_length_x/2)-corner_radius, (total_width_y/2)-corner_radius, 0])
            cylinder(r=corner_radius, h=plate_thickness);
    }

    // 2. 挖孔 (位置根据 hole_spacing 锁定，不受板子大小影响)
    for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
        for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
            // 螺丝通孔
            translate([x, y, -1])
                cylinder(d=screw_hole_dia, h=plate_thickness + 2);

            // 沉头孔 (默认在顶面，保证表面平整能放充电器)
            translate([x, y, plate_thickness - (screw_hole_dia/2)])
                cylinder(d1=screw_hole_dia, d2=countersink_top_dia, h=(screw_hole_dia/2)+0.1);
        }
    }

    // 3. 挖中间的减重孔 (自动填满整个板子)
    intersection() {
        // 定义打孔区域：避开四个螺丝孔周围
        difference() {
            cube([total_length_x - 10, total_width_y - 10, 50], center=true);

            // 在螺丝孔周围留出实心区域，增加强度
            for (x = [-hole_spacing_x/2, hole_spacing_x/2]) {
                for (y = [-hole_spacing_y/2, hole_spacing_y/2]) {
                    translate([x, y, 0])
                        cylinder(r=countersink_top_dia/2 + 4, h=100, center=true);
                }
            }
        }

        // 生成蜂窝网格
        union() {
            for (x_pos = [-total_length_x/2 : reduce_pattern_dia+reduce_pattern_gap : total_length_x/2]) {
                for (y_pos = [-total_width_y/2 : reduce_pattern_dia+reduce_pattern_gap : total_width_y/2]) {
                    translate([x_pos + (y_pos%2 * (reduce_pattern_dia/2)), y_pos, -1])
                        cylinder(d=reduce_pattern_dia, h=plate_thickness + 2);
                }
            }
        }
    }
}
