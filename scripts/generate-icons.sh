#!/bin/sh
# Régénère l'icône (cadi bleu sur fond blanc) et les PNG dérivés dans public/icons/
# et public/favicon.ico. Dessiné directement avec ImageMagick (pas de source SVG :
# le renderer SVG local (pas de rsvg-convert) ne gère pas les arcs de path, d'où
# le dessin en primitives polyline/circle).
set -e
cd "$(dirname "$0")/../public/icons"

convert -size 1024x1024 xc:white \
    -fill none -stroke "#2563eb" -strokewidth 67.6 \
    -draw "stroke-linecap round stroke-linejoin round polyline 174.1,191.0 309.3,191.0 410.6,664.1 816.1,664.1 917.5,360.0 343.1,360.0" \
    -fill "#2563eb" -stroke none \
    -draw "circle 444.4,866.8 478.2,866.8" \
    -draw "circle 816.1,866.8 849.9,866.8" \
    icon-master.png

for size in 16 32 180 192 512; do
    convert icon-master.png -resize "${size}x${size}" -background white -alpha remove -alpha off "icon-${size}.png"
done

convert icon-16.png icon-32.png -alpha off ../favicon.ico

rm icon-master.png
