#!/bin/bash

# Check input
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <full_path_to_video>"
    exit 1
fi

# Input full video path
VIDEO_PATH="$1"
VIDEO_FILENAME=$(basename "$VIDEO_PATH")
BASENAME="${VIDEO_FILENAME%.*}"

# Output paths
SCENES_DIR="../output/scenes"
KEYFRAMES_DIR="../output/keyframes/$BASENAME"
SCENE_FILE="$SCENES_DIR/${VIDEO_FILENAME}.scenes.txt"

# 0. Get Video FPS
echo "=== [0/5] Video FPS ==="
python3 get_fps.py "$VIDEO_PATH"

# 1. Shot detection
echo "=== [1/5] Shot Detection ==="
python3 shotdetection.py "$VIDEO_PATH"

# 2. ASR extraction
echo "=== [2/5] ASR Extraction ==="
python3 extract_asr.py "$VIDEO_PATH"

# 3. OCR extraction
echo "=== [3/5] OCR Extraction ==="
python3 extract_ocr.py "$KEYFRAMES_DIR"

# 4. Thumbnail creation
echo "=== [4/5] Creating Thumbnails ==="
python3 create_thumbnails.py "$KEYFRAMES_DIR"

# 5. Summary generation
echo "=== [5/5] Generating Summary ==="
python3 create_summary.py "$SCENE_FILE"

echo "=== ✅ Finished processing: $VIDEO_FILENAME ==="

