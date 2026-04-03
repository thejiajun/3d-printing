// ==================== 参数设置 ====================

// --- 1. 核心尺寸 ---
center_w = 90;   // 中间承托板宽度 (mm)
center_l = 150;  // 中间承托板长度 (mm)
hole_dx = 120;   // 左右孔距 (mm)
hole_dy = 40;    // 上下孔距 (mm)

// --- 2. 打印与材料设置 ---
// 针对 500g 负载，3.2mm 是平衡强度与沉头深度的极限值
thickness = 3.2;

// --- 3. 结构增强设置 ---
// 螺丝座周围的实心保护半径 (应力分散区)
solid_radius = 12;
// 筋骨宽度 (Hex之间的墙厚)，1.6mm 约等于 3-4 圈壁厚，强度极佳
rib_width = 1.6;

// --- 4. 孔位设置 ---
screw_d = 6;     // M6 螺丝
c_sink_d = 12;   // 沉头直径
hex_size = 10;   // 蜂窝孔的半径 (六边形大小)

$fn = 30; // 圆滑度

// ==================== 逻辑构建 ====================

difference() {

    // A. 主体外壳 (实体)
    union() {
        // 1. 中间大板
        translate([-center_w/2, -center_l/2, 0])
            cube([center_w, center_l, thickness]);

        // 2. 左侧连接耳 (使用 hull 生成平滑应力过渡)
        hull() {
            // 左上孔座
            translate([-hole_dx/2, hole_dy/2, 0]) cylinder(r=10, h=thickness);
            // 左下孔座
            translate([-hole_dx/2, -hole_dy/2, 0]) cylinder(r=10, h=thickness);
            // 连接到主体的锚点 (宽大的梯形接口，防止断裂)
            translate([-center_w/2 + 2, -hole_dy/2 - 10, 0]) cube([5, hole_dy + 20, thickness]);
        }

        // 3. 右侧连接耳
        hull() {
            translate([hole_dx/2, hole_dy/2, 0]) cylinder(r=10, h=thickness);
            translate([hole_dx/2, -hole_dy/2, 0]) cylinder(r=10, h=thickness);
            translate([center_w/2 - 7, -hole_dy/2 - 10, 0]) cube([5, hole_dy + 20, thickness]);
        }
    }

    // B. 减重/散热结构 (智能挖孔)
    intersection() {
        // 定义挖孔的原始网格 (覆盖全场)
        union() {
            for (x = [-100 : (hex_size*1.732 + rib_width) : 100]) {
                for (y = [-100 : (hex_size*1.5 + rib_width/1.2) : 100]) {
                    // 奇偶行错位，形成蜂窝
                    translate([x + (abs(y)%2 * (hex_size*1.732 + rib_width)/2), y * 1.732 / 2, -1])
                        cylinder(r=hex_size/2, h=thickness+2, $fn=6); // $fn=6 生成六边形
                }
            }
        }

        // 定义"允许挖孔"的区域 (Mask)
        // 原理：整个板子大小 减去 需要保留实心的应力区
        difference() {
            // 1. 初始允许全域挖孔
            cube([200, 200, 50], center=true);

            // 2. 定义"禁飞区" (实心保护区)
            union() {
                // 保护四个螺丝孔周围
                for (cx = [-hole_dx/2, hole_dx/2]) {
                    for (cy = [-hole_dy/2, hole_dy/2]) {
                        translate([cx, cy, 0])
                            cylinder(r=solid_radius, h=100, center=true);

                        // 关键：生成指向中心的"应力通道" (Stress Path)
                        // 从螺丝孔连向中心板的实心梁
                        hull() {
                            translate([cx, cy, 0]) cylinder(r=8, h=100, center=true);
                            translate([0, cy/2, 0]) cylinder(r=5, h=100, center=true);
                        }
                    }
                }
                // 保护外边缘 (留一圈框)
                // 这里不做复杂运算，依靠切片软件的Wall设置即可，或者手动缩小挖孔范围
            }
        }
    }

    // C. 钻螺丝孔
    for (x = [-hole_dx/2, hole_dx/2]) {
        for (y = [-hole_dy/2, hole_dy/2]) {
            // 螺丝通孔
            translate([x, y, -1])
                cylinder(d=screw_d, h=thickness + 2);

            // 沉头孔 (M6标准)
            // 3.2mm厚度下，沉头刚好到底，形成完整的接触面
            translate([x, y, thickness - 3.5])
                cylinder(d1=screw_d, d2=c_sink_d, h=3.6);
        }
    }
}
