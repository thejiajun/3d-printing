// Timemore C5 ESP Grinder <-> Screwdriver Adapter V7
// Both ends female hex socket - no breakable shaft
// Bottom: M5 hex socket (receives grinder's M5 hex drive shaft)
// Top: M5 hex socket (receives a hex bit from screwdriver)

$fn = 80;

// === Hex dimensions ===
// Grinder shaft: M5 hex (5mm across flats)
m5_af = 5.0 + 0.45;   // across flats + print clearance
m5_depth_bottom = 8;   // grinder shaft engagement depth

// Top socket: M5 hex (5mm across flats)
m5_depth_top = 10;     // bit insertion depth

// Wall thickness between hex socket and outer wall
wall_min = 4;          // minimum wall around hex socket

// Body
body_d = m5_af / cos(30) + wall_min * 2;  // auto-sized from hex + wall
body_h = m5_depth_bottom + m5_depth_top + 3; // +3mm solid middle section

// Lid to cover grinder opening (prevent beans from spilling)
lid_d = 50;            // 5cm diameter
lid_h = 1.2;           // thinner lid

module hex(af, h) {
    linear_extrude(height = h)
        circle(d = af / cos(30), $fn = 6);
}

module adapter() {
    difference() {
        union() {
            // Main cylindrical body
            cylinder(d = body_d, h = body_h);

            // Knurling ridges for grip
            for (a = [0:30:330]) {
                rotate([0, 0, a])
                    translate([body_d/2 - 0.3, -0.6, 0])
                        cube([0.6, 1.2, body_h]);
            }

            // Lid disc at bottom (no support needed for printing)
            cylinder(d = lid_d, h = lid_h);
        }

        // Bottom M5 hex socket (for grinder shaft)
        translate([0, 0, -0.1])
            hex(m5_af, m5_depth_bottom + 0.1);

        // Bottom entry chamfer
        translate([0, 0, -0.1])
            cylinder(d1 = m5_af / cos(30) + 1.5, d2 = m5_af / cos(30), h = 1.2);

        // Top M5 hex socket (for screwdriver bit)
        translate([0, 0, body_h - m5_depth_top])
            hex(m5_af, m5_depth_top + 0.1);

        // Top entry chamfer
        translate([0, 0, body_h + 0.1])
            mirror([0, 0, 1])
                cylinder(d1 = m5_af / cos(30) + 1.5, d2 = m5_af / cos(30), h = 1.2);
    }
}

adapter();
