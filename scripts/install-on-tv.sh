#!/bin/sh
# Sends dist/MyHome.wgt to the TV and installs it. The TV must be in Developer Mode with
# this computer's address as "Host PC IP". Usage: scripts/install-on-tv.sh <tv-ip>
set -eu
cd "$(dirname "$0")/.."
TV="${1:?usage: install-on-tv.sh <tv-ip>}"
SDB="${SDB:-$HOME/tizentv-tools/sdb/sdb}"
DEVICE="$TV:26101"
REMOTE=/home/owner/share/tmp/sdk_tools/tmp/
"$SDB" connect "$TV" >/dev/null
"$SDB" -s "$DEVICE" push dist/MyHome.wgt "$REMOTE" </dev/null >/dev/null
"$SDB" -s "$DEVICE" shell 0 vd_appinstall MyHomeTv01.MyHome "${REMOTE}MyHome.wgt" </dev/null
