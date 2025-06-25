import cv2 as cv
import sys
import os

OUTPATH_SMALL = "../output/thumbs/"
OUTPATH_XL = "../output/thumbsXL/"

if len(sys.argv) < 2:
    print("usage: createthumb.py <keyframes_root_folder>")
    exit(0)

keyframes_root = sys.argv[1]

for root, dirs, files in os.walk(keyframes_root):
    for file in files:
        if file.lower().endswith(".png"):
            fkeyframe = os.path.join(root, file)
            keyframe = cv.imread(fkeyframe)

            if keyframe is None:
                print(f"Failed to read: {fkeyframe}")
                continue

            comps = fkeyframe.split(os.sep)
            videoid = comps[3] if len(comps) > 3 else "unknown"

            small_thumb_path = os.path.join(OUTPATH_SMALL, videoid, file).replace(".png", ".jpg")
            xl_thumb_path = os.path.join(OUTPATH_XL, videoid, file).replace(".png", ".jpg")

            # Create directories if needed
            os.makedirs(os.path.dirname(small_thumb_path), exist_ok=True)
            os.makedirs(os.path.dirname(xl_thumb_path), exist_ok=True)

            # Create 160x90 thumbnail
            if not os.path.exists(small_thumb_path):
                print(f"Creating small thumbnail: {small_thumb_path}")
                thumb_small = cv.resize(src=keyframe, dsize=(160, 90))
                cv.imwrite(small_thumb_path, thumb_small)

            # Create 320x180 thumbnail
            if not os.path.exists(xl_thumb_path):
                print(f"Creating XL thumbnail: {xl_thumb_path}")
                thumb_xl = cv.resize(src=keyframe, dsize=(320, 180))
                cv.imwrite(xl_thumb_path, thumb_xl)
