#!/bin/sh
# Packages My Home as a Samsung TV app (dist/MyHome.wgt). It still has to be signed and
# sent to the TV, for example with TizenBrew Installer ("install another app").
set -eu
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./package.json').version")
ENTRY=$(node -p "require('./package.json').appPath")
rm -rf dist && mkdir -p dist/wgt
cp -R app/. dist/wgt/
mv "dist/wgt/$(basename "$ENTRY")" dist/wgt/index.html
cp tv-app/icon.png dist/wgt/icon.png
sed "s/__VERSION__/$VERSION/" tv-app/config.xml > dist/wgt/config.xml
(cd dist/wgt && zip -q -r ../MyHome.wgt . -x '.*')
echo "dist/MyHome.wgt ($VERSION)"
