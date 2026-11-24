#!/usr/bin/env bash
# Hebrew narration -> SRT with OpenAI Whisper.
# Usage: scripts/transcribe.sh <audio-or-video> [model]   (default model: turbo)
set -euo pipefail
cd "$(dirname "$0")/.."
in="$1"; model="${2:-turbo}"
.venv/bin/whisper "$in" --model "$model" --model_dir models --language he \
  --task transcribe --output_format srt --output_dir subtitles
