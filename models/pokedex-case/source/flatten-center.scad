// Flatten only the central button field; keep the perimeter rim.
CUT_Z = -4.30;              // clip plane (floor level)
X0=-38; X1=30; Y0=-68.5; Y1=68.5;   // central field, inset to spare the rim
difference() {
    import("/tmp/front_only.3mf", convexity=10);
    translate([X0, Y0, CUT_Z]) cube([X1-X0, Y1-Y0, 40]);
}
