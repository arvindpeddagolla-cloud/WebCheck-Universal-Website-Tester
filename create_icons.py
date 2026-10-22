import zlib
import struct
import math

def create_png(width, height, pixels):
    """
    pixels: list of (r, g, b, a) tuples of length width*height
    """
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # filter type 0 (None)
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw_data.extend([r, g, b, a])
    
    compressed = zlib.compress(raw_data, 9)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png.extend(struct.pack('>I', len(ihdr_data)))
    png.extend(b'IHDR')
    png.extend(ihdr_data)
    png.extend(struct.pack('>I', ihdr_crc))
    
    # IDAT chunk
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    png.extend(struct.pack('>I', len(compressed)))
    png.extend(b'IDAT')
    png.extend(compressed)
    png.extend(struct.pack('>I', idat_crc))
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    png.extend(struct.pack('>I', 0))
    png.extend(b'IEND')
    png.extend(struct.pack('>I', iend_crc))
    
    return bytes(png)

def generate_webcheck_icon(size):
    pixels = []
    center = size / 2.0
    radius = size * 0.46
    corner_radius = size * 0.22
    
    for y in range(size):
        for x in range(size):
            # Normalized coordinates [-1, 1]
            nx = (x + 0.5 - center) / (size / 2.0)
            ny = (y + 0.5 - center) / (size / 2.0)
            
            # Rounded rectangle background
            # Distance from rounded box
            qx = max(abs(nx * center) - (center - corner_radius), 0)
            qy = max(abs(ny * center) - (center - corner_radius), 0)
            box_dist = math.sqrt(qx * qx + qy * qy)
            
            if box_dist <= corner_radius:
                # Inside rounded container
                # Dark tech gradient from navy (15, 23, 42) to dark indigo (30, 27, 75)
                ratio_y = y / float(size)
                r = int(15 + 15 * ratio_y)
                g = int(23 + 12 * ratio_y)
                b = int(42 + 35 * ratio_y)
                a = 255
                
                # Outer glow border
                border_dist = corner_radius - box_dist
                if border_dist < 1.5:
                    # Border accent (emerald/cyan glow)
                    r = int(16 + 20 * (1 - border_dist / 1.5))
                    g = int(185 * 0.8 + 50 * (1 - border_dist / 1.5))
                    b = int(129 * 0.8 + 80 * (1 - border_dist / 1.5))
                
                # Checkmark logic
                # Checkmark points in normalized coords:
                # Start (-0.35, 0.05), Elbow (-0.05, 0.35), End (0.42, -0.28)
                px_norm = nx
                py_norm = ny
                
                # Checkmark thickness
                thickness = 0.12 if size >= 32 else 0.16
                
                def dist_to_segment(px, py, x1, y1, x2, y2):
                    dx = x2 - x1
                    dy = y2 - y1
                    len_sq = dx * dx + dy * dy
                    if len_sq == 0:
                        return math.hypot(px - x1, py - y1)
                    t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / len_sq))
                    proj_x = x1 + t * dx
                    proj_y = y1 + t * dy
                    return math.hypot(px - proj_x, py - proj_y)
                
                d1 = dist_to_segment(px_norm, py_norm, -0.36, 0.02, -0.08, 0.34)
                d2 = dist_to_segment(px_norm, py_norm, -0.08, 0.34, 0.40, -0.28)
                min_d = min(d1, d2)
                
                if min_d <= thickness:
                    # Emerald cyan checkmark (16, 185, 129) to (52, 211, 153)
                    factor = 1.0 - (min_d / thickness) * 0.3
                    r = int(16 * factor)
                    g = int(230 * factor)
                    b = int(160 * factor)
                elif min_d <= thickness + 0.08:
                    # Subtle glow around checkmark
                    glow = 1.0 - (min_d - thickness) / 0.08
                    r = int(r * (1 - glow) + 16 * glow)
                    g = int(g * (1 - glow) + 185 * glow)
                    b = int(b * (1 - glow) + 129 * glow)
            else:
                r, g, b, a = 0, 0, 0, 0
                
            pixels.append((r, g, b, a))
            
    return create_png(size, size, pixels)

for s in [16, 32, 48, 128]:
    png_bytes = generate_webcheck_icon(s)
    with open(f"icons/icon{s}.png", "wb") as f:
        f.write(png_bytes)
    print(f"Generated icons/icon{s}.png ({len(png_bytes)} bytes)")
