#!/bin/zsh
# Installs a macOS launchd job that runs the local collector (sources that block
# Vercel's datacenter IPs) against the PRODUCTION database:
#   Mondays 05:15 IST (before the 06:00 IST Vercel digest) and daily 09:00 IST.
# launchd runs a missed job when the Mac wakes. Logs: ~/Library/Logs/csr-radar-collector.log
# Remove with: scripts/uninstall-mac-collector.sh
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.csrradar.collector"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NPX="$(command -v npx)"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string><string>-lc</string>
    <string>cd '$REPO' &amp;&amp; '$NPX' tsx scripts/collect-local.ts --prod</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>5</integer><key>Minute</key><integer>15</integer></dict>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/csr-radar-collector.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/csr-radar-collector.log</string>
</dict>
</plist>
PLIST
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL → $PLIST"
