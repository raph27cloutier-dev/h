#!/bin/sh
# Packages and signs My Home as a Samsung TV app (dist/MyHome.wgt). Send it to the TV
# with TizenBrew Installer ("Select file to install"). The signing certificate is kept
# in .signing/ (not committed): updates must be signed with the same one.
set -eu
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./package.json').version")
ENTRY=$(node -p "require('./package.json').appPath")
rm -rf dist && mkdir -p dist/wgt
cp -R app/. dist/wgt/
mv "dist/wgt/$(basename "$ENTRY")" dist/wgt/index.html
cp tv-app/icon.png dist/wgt/icon.png
sed "s/__VERSION__/$VERSION/" tv-app/config.xml > dist/wgt/config.xml
node scripts/sign-wgt.js .signing dist/wgt | tail -1
(cd dist/wgt && zip -q -r ../MyHome.wgt . -x '.*')
echo "dist/MyHome.wgt ($VERSION)"
