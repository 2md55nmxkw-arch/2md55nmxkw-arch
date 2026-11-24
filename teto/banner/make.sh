#!/usr/bin/env bash
# Rebuild the banner from the green-screen source video, once per GitHub theme:
#   assets/teto/banner.webp       + banner-static.png        (dark)
#   assets/teto/banner-light.webp + banner-light-static.png  (light)
# needs: ffmpeg, python3 with numpy pillow opencv-python-headless fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/../.."
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/frames" "$work/looped" "$work/out"
ffmpeg -v error -i teto/banner/source/teto-idle.mp4 "$work/frames/f%03d.png"
python3 teto/banner/loop.py "$work/frames" "$work/looped" 24
python3 teto/banner/render.py "$work/looped" "$work/out"
for theme in dark light; do
  name=banner
  q=82
  if [ "$theme" = light ]; then
    name=banner-light
    q=88 # pale gradients show the encoder's frame-to-frame ghosting sooner, so this one gets more bits
  fi
  ffmpeg -v error -y -framerate 24 -i "$work/out/$theme/b%03d.png" -c:v libwebp_anim -lossless 0 -q:v "$q" \
    -compression_level 6 -loop 0 -preset picture "assets/teto/$name.webp"
  cp "$work/out/$theme/b030.png" "assets/teto/$name-static.png"
done
ls -la assets/teto/banner*
