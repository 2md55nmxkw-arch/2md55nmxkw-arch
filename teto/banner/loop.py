"""Make a seamless loop: the last K frames morph (optical flow + crossfade) into the first K."""
import glob
import os
import sys

import cv2
import numpy as np

SRC_DIR, OUT_DIR = sys.argv[1], sys.argv[2]
K = int(sys.argv[3]) if len(sys.argv) > 3 else 24
CROP = (70, 1135)  # rows: just above the ahoge .. waist

files = sorted(glob.glob(os.path.join(SRC_DIR, "*.png")))
frames = [cv2.imread(f)[CROP[0]:CROP[1]] for f in files]
n = len(frames)
L = n - K
os.makedirs(OUT_DIR, exist_ok=True)

dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
h, w = frames[0].shape[:2]
gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))


def warp(img, flow, s):
    return cv2.remap(img, gx - s * flow[..., 0], gy - s * flow[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def gray(img):
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


for t in range(L):
    if t < K:
        A, B = frames[L + t], frames[t]  # tail -> head
        a = (t + 0.5) / K
        a = a * a * (3 - 2 * a)  # smoothstep
        f_ab = dis.calc(gray(A), gray(B), None)
        f_ba = dis.calc(gray(B), gray(A), None)
        IA = warp(A, f_ab, a).astype(np.float32)
        IB = warp(B, f_ba, 1 - a).astype(np.float32)
        out = ((1 - a) * IA + a * IB).clip(0, 255).astype(np.uint8)
    else:
        out = frames[t]
    cv2.imwrite(os.path.join(OUT_DIR, f"l{t:03d}.png"), out)
print(f"loop: {L} frames ({L / 24:.2f}s), morph over {K} frames")
