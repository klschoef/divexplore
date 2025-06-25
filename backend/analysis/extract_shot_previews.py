import cv2
import os
import numpy as np

def get_equidistant_frames(video_path, start, end, num_frames=16):
    cap = cv2.VideoCapture(video_path)
    frames = []
    step = (end - start) / num_frames
    for i in range(num_frames):
        frame_num = int(start + i * step)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
    cap.release()
    return frames

def save_wide_image(frames, output_path):
    height = int(236 * frames[0].shape[0] / frames[0].shape[1])
    resized_frames = [cv2.resize(frame, (236, height)) for frame in frames]
    wide_image = np.concatenate(resized_frames, axis=1)
    cv2.imwrite(output_path, wide_image, [cv2.IMWRITE_JPEG_QUALITY, 50])  # Adjust quality as needed

def process_videos(video_dir, shot_dir, output_dir):
    for video_file in os.listdir(video_dir):
        if video_file.endswith(".mp4"):
            video_path = os.path.join(video_dir, video_file)
            shot_file = os.path.join(shot_dir, os.path.splitext(video_file)[0] + ".mp4.scenes.txt")

            # Create a subdirectory for the output images
            output_subdir = os.path.join(output_dir, os.path.splitext(video_file)[0])
            if not os.path.exists(output_subdir):
                os.makedirs(output_subdir)

            if os.path.exists(shot_file):
                print(f'processing {video_path} and {shot_file}')
                with open(shot_file, 'r') as f:
                    for line in f:
                        start, end = map(int, line.strip().split())
                        frames = get_equidistant_frames(video_path, start, end)
                        output_path = os.path.join(output_subdir, f"{os.path.splitext(video_file)[0]}_{start}.jpg")
                        save_wide_image(frames, output_path)

video_directory = "path_to_videos_directory"
shot_directory = "path_to_shots_directory"
output_directory = "path_to_output_directory"

process_videos(video_directory, shot_directory, output_directory)

