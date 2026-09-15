// Timemore C5 ESP grinder to screwdriver adapter V9.
// Top socket preserves the verified M5 grinder fit.
// Bottom socket accepts a standard H6.35 (1/4 inch) hex bit.

$fn = 80;

// Verified existing socket: 5 mm across flats with print clearance.
m5_af = 5.0 + 0.45;
m5_depth_top = 10;

// H6.35 bit socket: nominal 6.35 mm across flats with matching clearance.
h6_af = 6.35 + 0.45;
h6_depth_bottom = 8 * 1.10;

// Keep at least 4 mm of material around the larger H6 socket.
wall_min = 4;
body_d = h6_af / cos(30) + wall_min * 2;
body_h = m5_depth_top + h6_depth_bottom + 3;

module hex_socket(af, h) {
    linear_extrude(height = h)
        circle(d = af / cos(30), $fn = 6);
}

module adapter() {
    difference() {
        union() {
            cylinder(d = body_d, h = body_h);

            // Vertical ribs improve grip without changing the socket geometry.
            for (a = [0 : 30 : 330]) {
                rotate([0, 0, a])
                    translate([body_d / 2 - 0.3, -0.6, 0])
                        cube([0.6, 1.2, body_h]);
            }
        }

        // Bottom H6.35 socket, 10% deeper than the previous 8 mm socket.
        translate([0, 0, -0.1])
            hex_socket(h6_af, h6_depth_bottom + 0.1);
        translate([0, 0, -0.1])
            cylinder(d1 = h6_af / cos(30) + 1.5, d2 = h6_af / cos(30), h = 1.2);

        // Top M5 socket, unchanged from the proven fit.
        translate([0, 0, body_h - m5_depth_top])
            hex_socket(m5_af, m5_depth_top + 0.1);
        translate([0, 0, body_h + 0.1])
            mirror([0, 0, 1])
                cylinder(d1 = m5_af / cos(30) + 1.5, d2 = m5_af / cos(30), h = 1.2);
    }
}

adapter();
