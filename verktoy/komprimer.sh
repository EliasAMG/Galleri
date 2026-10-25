#!/bin/sh
# Komprimerer alle .jpg/.jpeg/.png/.tif i en mappe til .webp (maks 2000 px)
# og legger dem i bilder/tegninger/. Krever ImageMagick.
# Bruk: sh verktoy/komprimer.sh mappe-med-bilder
set -e
KILDE="${1:?Oppgi mappen med bildene, f.eks. sh verktoy/komprimer.sh ~/Skanninger}"
MAL="$(dirname "$0")/../bilder/tegninger"
if command -v magick >/dev/null 2>&1; then IM="magick"; else IM="convert"; fi
for f in "$KILDE"/*.jpg "$KILDE"/*.jpeg "$KILDE"/*.png "$KILDE"/*.tif "$KILDE"/*.tiff \
         "$KILDE"/*.JPG "$KILDE"/*.JPEG "$KILDE"/*.PNG "$KILDE"/*.TIF; do
  [ -e "$f" ] || continue
  navn=$(basename "$f" | sed 's/\.[^.]*$//' | tr 'A-ZÆØÅ ' 'a-zæøå-' | sed 's/æ/ae/g; s/ø/o/g; s/å/a/g')
  $IM "$f" -auto-orient -resize '2000x2000>' -strip -quality 80 "$MAL/$navn.webp"
  echo "Lagret $MAL/$navn.webp"
done
