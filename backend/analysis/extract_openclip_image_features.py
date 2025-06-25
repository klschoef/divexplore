import torch
import open_clip
from PIL import Image
import numpy as np
import os
import sys
import glob
import csv

imsuffix = 'png'

if len(sys.argv) > 1:
    imsuffix = sys.argv[1]

rootdir = "../output/keyframes"
resultname = "divexplore"

# Output directory
OUTPUT_DIR = "../output/openclip"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Model configuration
modelname = 'ViT-H-14'
modelweights = 'laion2b_s32b_b79k'

device = "cuda" if torch.cuda.is_available() else "cpu"
model, _, preprocess = open_clip.create_model_and_transforms(modelname, pretrained=modelweights, device=device)

print(f'Model loaded on {device}!')

# Output CSV path
csv_output_path = os.path.join(OUTPUT_DIR, f'openclip-{resultname}-{modelname}_{modelweights}.csv')
csvfile = open(csv_output_path, 'w', newline='')
writer = csv.writer(csvfile, delimiter=',')

# Search for images recursively
targetfiledir = os.path.join(rootdir, f'**/*.{imsuffix}')
print(f"Searching: {targetfiledir}")

for filename in glob.iglob(targetfiledir, recursive=True):
    relpath = os.path.relpath(filename, rootdir)
    print(f"Processing: {relpath}")

    try:
        image = preprocess(Image.open(filename)).unsqueeze(0).to(device)
    except Exception as e:
        print(f"Failed to load image {filename}: {e}")
        continue

    with torch.no_grad():
        image_features = model.encode_image(image)
        image_features = image_features.cpu()
        mylist = image_features[0].tolist()
        mylist.insert(0, relpath)
        writer.writerow(mylist)

csvfile.close()
print(f"\nAll features saved to: {csv_output_path}")
