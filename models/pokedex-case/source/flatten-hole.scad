// Center-flattened front cover + Ø11.1 button hole at lower-middle.
CUT_Z = -4.30;
X0=-38; X1=30; Y0=-68.5; Y1=68.5;
HOLE_D = 11.1;          // grommet groove-root dia (panel ~2.2mm matches 2.3 groove)
HX = 15; HY = 0;        // lower-middle: centered on long axis, toward hinge edge
difference() {
    import("/tmp/front_only.3mf", convexity=10);
    translate([X0, Y0, CUT_Z]) cube([X1-X0, Y1-Y0, 40]);   // flatten center field
    translate([HX, HY, -10]) cylinder(h=20, d=HOLE_D, $fn=80); // through hole
}
