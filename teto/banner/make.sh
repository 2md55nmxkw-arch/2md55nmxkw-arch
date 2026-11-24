#!/usr/bin/env bash
# Rebuild the banner from the green-screen source video: one animated WebP and one still PNG
# per mood and GitHub theme (render.py lists them), e.g.
#   assets/teto/banner.webp              + banner-static.png               everyday, dark
#   assets/teto/banner-hungry-light.webp + banner-hungry-light-static.png  hungry, light
# needs: ffmpeg, python3 with numpy pillow opencv-python-headless fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/../.."
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/frames" "$work/looped" "$work/out"
ffmpeg -v error -i teto/banner/source/teto-idle.mp4 "$work/frames/f%03d.png"
python3 teto/banner/loop.py "$work/frames" "$work/looped" 24
python3 teto/banner/render.py "$work/looped" "$work/out"
for dir in "$work/out"/*/; do
  name="$(basename "$dir")"
  q=82
  case "$name" in
    *-light) q=88 ;; # pale gradients show the encoder's frame-to-frame ghosting sooner, so these get more bits
  esac
  ffmpeg -v error -y -framerate 24 -i "$dir/b%03d.png" -c:v libwebp_anim -lossless 0 -q:v "$q" \
    -compression_level 6 -loop 0 -preset picture "assets/teto/$name.webp"
  cp "$dir/b030.png" "assets/teto/$name-static.png"
done
ls -la assets/teto/banner*
