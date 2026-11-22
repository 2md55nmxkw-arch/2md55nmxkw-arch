#!/usr/bin/env bash
# Rebuild assets/teto/banner.webp (+ banner-static.png) from the green-screen source video.
# needs: ffmpeg, python3 with numpy pillow opencv-python-headless fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/../.."
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/frames" "$work/looped" "$work/out"
ffmpeg -v error -i teto/banner/source/teto-idle.mp4 "$work/frames/f%03d.png"
python3 teto/banner/loop.py "$work/frames" "$work/looped" 24
python3 teto/banner/render.py "$work/looped" "$work/out"
ffmpeg -v error -y -framerate 24 -i "$work/out/b%03d.png" -c:v libwebp_anim -lossless 0 -q:v 82 \
  -compression_level 6 -loop 0 -preset picture assets/teto/banner.webp
cp "$work/out/b030.png" assets/teto/banner-static.png
ls -la assets/teto/banner.webp assets/teto/banner-static.png
