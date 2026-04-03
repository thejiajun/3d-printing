// ==================== 参数设置 ====================

// --- 1. 核心尺寸 ---
center_w = 90;   // 中间承托板宽度
center_l = 150;  // 中间承托板长度
hole_dx = 120;   // 左右孔距
hole_dy = 40;    // 上下孔距

// --- 2. 打印与材料设置 ---
thickness = 3.2; // 针对M6沉头的最优厚度

// --- 3. 结构增强设置 ---
solid_radius = 13; // 螺丝座周围实心保护半径 (稍微加大以包住孔)
border_margin = 3; // 【新】边缘保留的实心边框宽度 (解决锯齿的关键)
rib_width = 1.6;   // 蜂窝筋骨宽度

// --- 4. 孔位设置 ---
screw_d = 6;     // M6 螺丝
c_sink_d = 12;   // 沉头直径
hex_r = 5;       // 蜂窝孔的内切圆半径 (调整这个改变孔大小)

$fn = 30;

// ==================== 逻辑构建 ====================

difference() {

    // A. 主体外壳 (完整的实心十字板)
    union() {
        // 中间大板
        translate([-center_w/2, -center_l/2, 0])
            cube([center_w, center_l, thickness]);

        // 左侧连接耳 (带平滑过渡)
        hull() {
            translate([-hole_dx/2, hole_dy/2, 0]) cylinder(r=10, h=thickness);
            translate([-hole_dx/2, -hole_dy/2, 0]) cylinder(r=10, h=thickness);
            translate([-center_w/2, -hole_dy/2 - 10, 0]) cube([2, hole_dy + 20, thickness]);
        }

        // 右侧连接耳
        hull() {
            translate([hole_dx/2, hole_dy/2, 0]) cylinder(r=10, h=thickness);
            translate([hole_dx/2, -hole_dy/2, 0]) cylinder(r=10, h=thickness);
            translate([center_w/2 - 2, -hole_dy/2 - 10, 0]) cube([2, hole_dy + 20, thickness]);
        }
    }

    // B. 智能挖孔 (核心修改：只挖完整的六边形)
    // 计算六边形阵列的步长
    step_x = hex_r * sqrt(3) + rib_width;
    step_y = hex_r * 1.5 + rib_width * sqrt(3)/2;

    union() {
        // 遍历整个区域
        for (x = [-center_w/2 : step_x : center_w/2]) {
            for (y = [-center_l/2 : step_y : center_l/2]) {
                // 计算当前六边形的实际中心坐标 (考虑奇偶行错位)
                pos_x = x + (floor(y/step_y)%2 * step_x/2);
                pos_y = y;

                // 【核心逻辑】判断：这个点是否在"安全挖孔区"内？
                // 条件1: 在中间大板的安全区内
                isInCenter = (abs(pos_x) < (center_w/2 - border_margin - hex_r)) &&
                             (abs(pos_y) < (center_l/2 - border_margin - hex_r));

                // 条件2: 在左右耳朵的安全区内
                isInEars = (abs(pos_x) < (hole_dx/2 + 10 - border_margin - hex_r)) &&
                           (abs(pos_y) < (hole_dy/2 - border_margin - hex_r)) &&
                           (abs(pos_x) > (center_w/2)); // 不与中间重叠

                // 条件3: 不在四个螺丝孔的实心保护区内
                isOutsideSolid = true;
                for (sx = [-hole_dx/2, hole_dx/2]) {
                    for (sy = [-hole_dy/2, hole_dy/2]) {
                        if (norm([pos_x-sx, pos_y-sy]) < (solid_radius + hex_r)) {
                            isOutsideSolid = false;
                        }
                    }
                }

                // 只有当满足 (在板内) 且 (不在保护区) 时，才生成这个孔
                if ((isInCenter || isInEars) && isOutsideSolid) {
                    translate([pos_x, pos_y, -1])
                        rotate([0,0,30]) // 旋转30度让尖角朝上，更易打印
                        cylinder(r=hex_r, h=thickness+2, $fn=6);
                }
            }
        }
    }

    // C. 钻螺丝孔 (保持不变)
    for (x = [-hole_dx/2, hole_dx/2]) {
        for (y = [-hole_dy/2, hole_dy/2]) {
            translate([x, y, -1]) cylinder(d=screw_d, h=thickness + 2);
            translate([x, y, thickness - 3.5]) cylinder(d1=screw_d, d2=c_sink_d, h=3.6);
        }
    }
}
