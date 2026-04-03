#!/usr/bin/env python3
"""
Repair Meshy AI STL: voxel remesh at fine pitch + Laplacian smoothing
to remove staircase artifacts while preserving shape.
"""
import trimesh
import pymeshlab
import numpy as np
from pathlib import Path

input_path = "/Users/jiajun/Downloads/Meshy_AI_Scholarly_Turtle_0311170445_generate.stl"
output_dir = Path("/Users/jiajun/Projects/3d-printing-processing/output")
out_stl = output_dir / "Scholarly_Turtle_fixed.stl"
tmp_voxel = output_dir / "tmp_voxel.stl"

# Step 1: Voxel remesh with trimesh for watertight guarantee
print("Loading mesh...", flush=True)
mesh = trimesh.load(input_path, force="mesh")

# Keep only significant components
components = mesh.split(only_watertight=False)
significant = [c for c in components if len(c.faces) > 100]
merged = trimesh.util.concatenate(significant)
trimesh.repair.fix_normals(merged)

# Voxelize at 0.2mm pitch (good detail, manageable size)
print("Voxelizing at 0.2mm pitch...", flush=True)
voxel = merged.voxelized(pitch=0.2)
result = voxel.marching_cubes
result.apply_transform(voxel.transform)
trimesh.repair.fix_normals(result)

print(f"Voxel mesh: {len(result.vertices)} verts, {len(result.faces)} faces", flush=True)
print(f"Watertight: {result.is_watertight}", flush=True)

# Save temporary voxel mesh
result.export(str(tmp_voxel))

# Step 2: Laplacian smooth with PyMeshLab to remove staircase
print("Applying Laplacian smoothing...", flush=True)
ms = pymeshlab.MeshSet()
ms.load_new_mesh(str(tmp_voxel))

# HC Laplacian smooth - better at preserving volume than standard Laplacian
# Apply HC Laplacian multiple times for stronger smoothing
for i in range(10):
    ms.apply_filter('apply_coord_hc_laplacian_smoothing')

# Simplify to reasonable face count (~400k faces, similar to original)
m = ms.current_mesh()
target_faces = min(400000, m.face_number())
if m.face_number() > 500000:
    print(f"Simplifying from {m.face_number()} to ~{target_faces} faces...", flush=True)
    ms.apply_filter('meshing_decimation_quadric_edge_collapse',
                    targetfacenum=target_faces,
                    preservenormal=True,
                    preservetopology=True)

m = ms.current_mesh()
print(f"Final: {m.vertex_number()} verts, {m.face_number()} faces", flush=True)
bb = m.bounding_box()
print(f"BBox: {bb.dim_x():.1f} x {bb.dim_y():.1f} x {bb.dim_z():.1f} mm", flush=True)

ms.save_current_mesh(str(out_stl))
tmp_voxel.unlink(missing_ok=True)

size_mb = out_stl.stat().st_size / 1024 / 1024
print(f"Exported: {out_stl} ({size_mb:.1f} MB)", flush=True)
