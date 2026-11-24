#!/usr/bin/env bash
# Download reference media you have permission to use, with yt-dlp.
# Usage: scripts/fetch-reference.sh <url>
set -euo pipefail
cd "$(dirname "$0")/.."
.venv/bin/yt-dlp -f "bv*+ba/b" --merge-output-format mp4 \
  -o "references/%(title).80s [%(id)s].%(ext)s" "$1"
