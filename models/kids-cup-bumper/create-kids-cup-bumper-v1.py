import math
from pathlib import Path

import bpy


OUTPUT_DIR = Path(__file__).parent
MODEL_NAME = "kids-cup-bumper-v8-tapered-71-to-235"

# Measured cup profile: 71 mm at the bottom, expanding to 235 mm circumference.
CUP_BOTTOM_DIAMETER = 71.0
CUP_TOP_CIRCUMFERENCE = 235.0
CUP_TOP_DIAMETER = CUP_TOP_CIRCUMFERENCE / math.pi
FIT_INTERFERENCE = 1.0
INNER_BOTTOM_DIAMETER = CUP_BOTTOM_DIAMETER - FIT_INTERFERENCE
INNER_TOP_DIAMETER = CUP_TOP_DIAMETER - FIT_INTERFERENCE
OUTER_BOTTOM_DIAMETER = 78.0
OUTER_TOP_DIAMETER = 81.0
BUMPER_HEIGHT = 22.0
BASE_THICKNESS = 2.2
SEGMENTS = 128


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def create_revolved_mesh(name, profile):
    vertices = []
    faces = []
    profile_count = len(profile)
    rings = []

    for radius, z in profile:
        if radius == 0:
            center_index = len(vertices)
            vertices.append((0, 0, z))
            rings.append([center_index] * SEGMENTS)
            continue

        ring = []
        for segment in range(SEGMENTS):
            angle = 2 * math.pi * segment / SEGMENTS
            ring.append(len(vertices))
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))
        rings.append(ring)

    for segment in range(SEGMENTS):
        next_segment = (segment + 1) % SEGMENTS
        for profile_index in range(profile_count):
            next_profile = (profile_index + 1) % profile_count
            a = rings[profile_index][segment]
            b = rings[profile_index][next_segment]
            c = rings[next_profile][next_segment]
            d = rings[next_profile][segment]
            if profile[profile_index][0] == 0 and profile[next_profile][0] == 0:
                continue
            if profile[profile_index][0] == 0:
                faces.append((a, c, d))
            elif profile[next_profile][0] == 0:
                faces.append((a, b, c))
            else:
                faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def create_bumper():
    inner_bottom_radius = INNER_BOTTOM_DIAMETER / 2
    inner_top_radius = INNER_TOP_DIAMETER / 2
    outer_bottom_radius = OUTER_BOTTOM_DIAMETER / 2
    outer_top_radius = OUTER_TOP_DIAMETER / 2

    # The profile travels around the solid cross-section clockwise.
    # The inside follows the measured cup taper while the bottom stays impact resistant.
    profile = [
        (outer_bottom_radius - 2.7, 0.0),
        (outer_bottom_radius - 2.35, 0.12),
        (outer_bottom_radius - 1.65, 0.42),
        (outer_bottom_radius - 1.0, 0.85),
        (outer_bottom_radius - 0.5, 1.45),
        (outer_bottom_radius - 0.15, 2.3),
        (outer_bottom_radius, 3.35),
        (outer_bottom_radius - 0.12, 4.5),
        (outer_bottom_radius + 0.05, 8.5),
        (outer_bottom_radius + 0.3, 14.0),
        (outer_bottom_radius + 0.65, 19.0),
        (outer_top_radius - 0.4, BUMPER_HEIGHT),
        (outer_top_radius - 0.85, BUMPER_HEIGHT + 0.35),
        (inner_top_radius + 0.8, BUMPER_HEIGHT + 0.35),
        (inner_top_radius + 0.2, BUMPER_HEIGHT - 0.15),
        (inner_bottom_radius + 0.35, 4.0),
        (inner_bottom_radius + 0.23, BASE_THICKNESS + 0.45),
        (inner_bottom_radius, BASE_THICKNESS),
        (0, BASE_THICKNESS),
        (0, 0),
    ]

    bumper = create_revolved_mesh(MODEL_NAME, profile)
    bumper["cup_bottom_diameter_mm"] = CUP_BOTTOM_DIAMETER
    bumper["cup_top_diameter_mm"] = CUP_TOP_DIAMETER
    bumper["inner_bottom_diameter_mm"] = INNER_BOTTOM_DIAMETER
    bumper["inner_top_diameter_mm"] = INNER_TOP_DIAMETER
    bumper["bumper_height_mm"] = BUMPER_HEIGHT
    bumper["material"] = "TPU 95A"

    bpy.ops.object.shade_smooth()
    return bumper


def create_cup_reference():
    bpy.ops.mesh.primitive_cylinder_add(vertices=SEGMENTS, radius=CUP_BOTTOM_DIAMETER / 2, depth=95, location=(0, 0, 49.7))
    cup = bpy.context.object
    cup.name = "Cup reference - not for print"
    cup.display_type = "WIRE"
    cup.hide_render = True
    cup.hide_viewport = False
    return cup


def add_ground():
    bpy.ops.mesh.primitive_plane_add(size=250, location=(0, 0, -0.01))
    ground = bpy.context.object
    ground.name = "Render ground"
    material = bpy.data.materials.new("Ground material")
    material.diffuse_color = (0.035, 0.045, 0.07, 1)
    ground.data.materials.append(material)
    return ground


def add_render_setup(bumper):
    material = bpy.data.materials.new("TPU coral")
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (0.96, 0.06, 0.13, 1)
    principled.inputs["Roughness"].default_value = 0.42
    bumper.data.materials.append(material)

    add_ground()

    bpy.ops.object.light_add(type="AREA", location=(55, -48, 72))
    key = bpy.context.object
    key.data.energy = 80000
    key.data.shape = "DISK"
    key.data.size = 46

    bpy.ops.object.light_add(type="AREA", location=(-45, -30, 40))
    fill = bpy.context.object
    fill.data.energy = 42000
    fill.data.size = 35

    bpy.ops.object.light_add(type="AREA", location=(10, 55, 55))
    rim = bpy.context.object
    rim.data.energy = 60000
    rim.data.size = 28

    bpy.ops.object.camera_add(location=(104, -104, 75))
    camera = bpy.context.object
    bpy.context.scene.camera = camera
    target = (0, 0, 5.5)
    direction = mathutils.Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 52

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUTPUT_DIR / f"{MODEL_NAME}-preview.png")
    scene.world.color = (0.06, 0.06, 0.08)


def export_print_model(bumper):
    bpy.ops.object.select_all(action="DESELECT")
    bumper.select_set(True)
    bpy.context.view_layer.objects.active = bumper
    bpy.ops.wm.stl_export(filepath=str(OUTPUT_DIR / f"{MODEL_NAME}.stl"), export_selected_objects=True)


def main():
    clear_scene()
    bumper = create_bumper()
    create_cup_reference()
    add_render_setup(bumper)
    export_print_model(bumper)
    bpy.context.scene.render.filepath = str(OUTPUT_DIR / f"{MODEL_NAME}-preview.png")
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_DIR / f"{MODEL_NAME}.blend"))


if __name__ == "__main__":
    from mathutils import Vector
    import mathutils

    main()
