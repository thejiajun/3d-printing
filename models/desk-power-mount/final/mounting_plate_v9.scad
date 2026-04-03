// ==================== 参数设置 ====================

// --- 1. 核心尺寸 ---
center_w = 90;   // 中间板宽度
center_l = 150;  // 中间板长度
hole_dx = 120;   // 左右孔距
hole_dy = 40;    // 上下孔距
plate_r  = 6;    // 中间大板的四个角圆角半径

// --- 2. 打印与材料设置 ---
thickness = 3.2; // 3.2mm 是平衡 M6 沉头和强度的最优解

// --- 3. 结构与网格设置 ---
hex_r = 5;         // 六边形内切圆半径 (孔的大小)
rib_width = 1.8;   // 筋骨宽度
border_margin = 4; // 边缘保留的实心边框宽度

// --- 4. 孔位设置 ---
screw_d = 6;       // M6 螺丝通孔
c_sink_d = 12;     // 沉头直径

$fn = 30;

// 计算步长
step_x = hex_r * sqrt(3) + rib_width;
step_y = hex_r * 1.5 + rib_width * sqrt(3)/2;
count_x = center_w / step_x;
count_y = center_l / step_y;

difference() {

    // ================== A. 主体外壳 ==================
    union() {
        // 1. 中间大板 (圆角矩形)
        hull() {
            translate([-center_w/2 + plate_r, -center_l/2 + plate_r, 0])
                cylinder(r=plate_r, h=thickness);
            translate([center_w/2 - plate_r, -center_l/2 + plate_r, 0])
                cylinder(r=plate_r, h=thickness);
            translate([-center_w/2 + plate_r, center_l/2 - plate_r, 0])
                cylinder(r=plate_r, h=thickness);
            translate([center_w/2 - plate_r, center_l/2 - plate_r, 0])
                cylinder(r=plate_r, h=thickness);
        }

        // 2. 左侧连接耳
        hull() {
            translate([-hole_dx/2, hole_dy/2, 0]) cylinder(r=10, h=thickness);
            translate([-hole_dx/2, -hole_dy/2, 0]) cylinder(r=10, h=thickness);
            translate([-center_w/2 + 5, -hole_dy/2 - 10, 0]) cube([2, hole_dy + 20, thickness]);
        }

        // 3. 右侧连接耳
        hull() {
            translate([hole_dx/2, hole_dy/2, 0]) cylinder(r=10, h=thickness);
            translate([hole_dx/2, -hole_dy/2, 0]) cylinder(r=10, h=thickness);
            translate([center_w/2 - 7, -hole_dy/2 - 10, 0]) cube([2, hole_dy + 20, thickness]);
        }
    }

    // ================== B. 居中挖孔 ==================
    intersection() {
        // 蜂窝网格
        union() {
            for (i = [-ceil(count_x/2) : ceil(count_x/2)]) {
                for (j = [-ceil(count_y/2) : ceil(count_y/2)]) {
                    pos_x = i * step_x + (abs(j)%2 == 1 ? step_x/2 : 0);
                    pos_y = j * step_y;
                    translate([pos_x, pos_y, -1])
                        rotate([0,0,30])
                        cylinder(r=hex_r, h=thickness+2, $fn=6);
                }
            }
        }

        // 限制挖孔区域 (圆角矩形内缩)
        hull() {
            translate([-(center_w/2 - border_margin - hex_r) + plate_r, -(center_l/2 - border_margin - hex_r) + plate_r, -2])
                cylinder(r=plate_r, h=thickness+4);
            translate([(center_w/2 - border_margin - hex_r) - plate_r, -(center_l/2 - border_margin - hex_r) + plate_r, -2])
                cylinder(r=plate_r, h=thickness+4);
            translate([-(center_w/2 - border_margin - hex_r) + plate_r, (center_l/2 - border_margin - hex_r) - plate_r, -2])
                cylinder(r=plate_r, h=thickness+4);
            translate([(center_w/2 - border_margin - hex_r) - plate_r, (center_l/2 - border_margin - hex_r) - plate_r, -2])
                cylinder(r=plate_r, h=thickness+4);
        }
    }

    // ================== C. 螺丝孔 ==================
    for (x = [-hole_dx/2, hole_dx/2]) {
        for (y = [-hole_dy/2, hole_dy/2]) {
            translate([x, y, -1]) cylinder(d=screw_d, h=thickness + 2);
            translate([x, y, thickness - 3.5]) cylinder(d1=screw_d, d2=c_sink_d, h=3.6);
        }
    }
}
