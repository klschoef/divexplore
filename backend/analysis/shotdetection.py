import cv2
import os
import torch
from open_clip import create_model_and_transforms
import numpy as np
import sys
from PIL import Image  

# Load OpenCLIP 
print("Loading OpenCLIP model...")
model, preprocess, tokenizer = create_model_and_transforms(
    'ViT-H-14', pretrained='laion2b_s32b_b79k'
)
model.eval().cuda()
print("Model loaded successfully.")

# Frame extraction
def extract_frames(video_path, interval=1):
    cap = cv2.VideoCapture(video_path)
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    frames = []
    count = 0
    prevFrame = None
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if count % (fps * interval) == 0:
            frame_number = count #// fps
            frames.append((frame_number, frame))  # Store frame number with the frame
        count += 1
        prevFrame = frame
        if count % 100 == 0:
            print(f"Processed {count} frames...")
    frames.append((count-1, prevFrame)) #last frame
    cap.release()
    print(f"Total frames extracted: {len(frames)} lastFramenum={count-1}")
    return frames, fps


def exclude_blurred_frames(frames):
    print("Starting frame filtering...")
    
    # Define Gaussian kernel parameters
    kernelsize_g1 = 3
    kernelsize_g2 = 7
    sigma_g1 = 0.95
    sigma_g2 = 1.55

    kernel_g1 = cv2.getGaussianKernel(kernelsize_g1, sigma_g1)
    kernel_g1 = np.outer(kernel_g1, kernel_g1)
    kernel_g2 = cv2.getGaussianKernel(kernelsize_g2, sigma_g2)
    kernel_g2 = np.outer(kernel_g2, kernel_g2)

    filtered_frames = []

    for frame_number, frame in frames:
        g1_frame = cv2.filter2D(frame, -1, kernel_g1)
        g2_frame = cv2.filter2D(frame, -1, kernel_g2)
        dog_frame = cv2.absdiff(g1_frame, g2_frame)
        dog_mean = np.mean(dog_frame)

        if dog_mean > 0.45:
            filtered_frames.append((frame_number, frame))  # Retain frame number

    print(f"New amount of frames: {len(filtered_frames)}")
    return filtered_frames

# Feature extraction
def extract_features_in_batches(filtered_frames, batch_size=32):
    print("Starting feature extraction...")
    features = []
    frames_only = [frame for _, frame in filtered_frames]  # Extract just the frames

    for i in range(0, len(frames_only), batch_size):
        batch_frames = frames_only[i:i + batch_size]
        print(f"Processing batch {i // batch_size + 1}/{(len(frames_only) + batch_size - 1) // batch_size}...")

        batch_tensors = torch.stack([
            preprocess(Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))).cuda() 
            for f in batch_frames
        ])
        
        with torch.no_grad():
            batch_features = model.encode_image(batch_tensors)
        features.extend(batch_features.cpu().numpy())
        print(f"Batch {i // batch_size + 1} processed.")
    print("Feature extraction completed.")
    return features



# Manhattan distance and shot change detection
def compute_shot_changes(features, factor):
    print("Starting shot change computation...")
    distances = []
    keyframes = [0] 
    
    # first compute the distances
    for i in range(1, len(features)):
        distance = np.sum(np.abs(features[i] - features[i-1]))
        distances.append(distance)
        
    # then find the keyframes
    for i in range(1, len(features)):
        # if distance is greater than the mean distance it is a keyframe
        if distances[i-1] > np.mean(distances) * factor or i == len(features)-1:
            keyframes.append(i)
            
    return keyframes, distances

# Save distances to file
def save_distances_to_file(distances, file_path):
    with open(file_path, 'w') as f:
        f.write("Frame-to-Frame Distances:\n")
        f.write("\n".join([f"Frame {i} to Frame {i+1}: {dist}" for i, dist in enumerate(distances)]))
        f.write(f"\n\nMin Distance: {min(distances)}")
        f.write(f"\nMax Distance: {max(distances)}")
        f.write(f"\nMean Distance: {np.mean(distances)}")


def extract_keyframes(video_path, keyframe_indices, frames):
    cap = cv2.VideoCapture(video_path)
    keyframes = []
    count = 0
    kidx = 1
    idx = keyframe_indices[kidx]
    prev = frames[keyframe_indices[0]][0]
    while cap.isOpened():
        fnum = prev + int((frames[idx][0] - prev) / 2)
        ret, frame = cap.read()
        if not ret:
            break
        if count  == fnum:
            print(f"shot:{prev}-{frames[idx][0]} ... {fnum}")
            keyframes.append((prev, frames[idx][0], fnum, frame))  # Store frame number with the frame
            prev = frames[idx][0] + 1
            kidx += 1
            if len(keyframe_indices) > kidx:
                idx = keyframe_indices[kidx]
            else:
                break
        count += 1
    cap.release()
    print(f"returning {len(keyframes)}")
    return keyframes

def main(video_path):
    frames, fps = extract_frames(video_path)
    #frames = exclude_blurred_frames(frames)

    features = extract_features_in_batches(frames)
    keyframe_indices, distances = compute_shot_changes(features, 1.05)
    print(f"Keyframe indices len: {len(keyframe_indices)}")
    print(f"{keyframe_indices}")


    keyframes = extract_keyframes(video_path, keyframe_indices, frames)
    print(f"keyframes len: {len(keyframes)}")

    #distances_file_path = f"distances_{os.path.basename(video_path).split('.')[0]}.txt"
    #save_distances_to_file(distances, distances_file_path)
    #print(f"Distances saved to {distances_file_path}")

    videoname = os.path.basename(video_path).split('.')[0]

    output_folder = os.path.join("..", "output", "keyframes", videoname)
    scenes_folder = os.path.join("..", "output", "scenes")
    scenesname = os.path.join(scenes_folder, f"{videoname}.mp4.scenes.txt")

    # Ensure folders exist
    os.makedirs(output_folder, exist_ok=True)
    os.makedirs(scenes_folder, exist_ok=True)

    # Write keyframes and scene times
    with open(scenesname, "w") as sfile:
        for sfrom, sto, skf, keyframe in keyframes:
            keyframe_path = os.path.join(output_folder, f"{videoname}_{skf}.png")
            cv2.imwrite(keyframe_path, keyframe)
            print(f"{keyframe_path}")
            sfile.write(f"{sfrom} {sto}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python script_name.py <video_path>")
        sys.exit(1)
    
    video_path = sys.argv[1]
    main(video_path)
