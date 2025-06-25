import os
import sys
import cv2

def append_video_fps(video_path):
    # Ensure the video file exists
    if not os.path.isfile(video_path):
        print(f"Error: File not found - {video_path}")
        return

    # Extract filename only
    filename = os.path.basename(video_path)

    # Load video to get FPS
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Unable to open video file - {video_path}")
        return

    fps = int(cap.get(cv2.CAP_PROP_FPS))
    cap.release()

    # Ensure output directory exists
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.abspath(os.path.join(script_dir, '..', 'output'))
    os.makedirs(output_dir, exist_ok=True)

    output_file = os.path.join(output_dir, 'video_fps.txt')

    # Append to file
    with open(output_file, 'a') as f:
        f.write(f"{filename} {fps}\n")

    print(f"Appended: {filename} {fps}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python get_fpy.py <path_to_video_file>")
        sys.exit(1)

    video_path = sys.argv[1]
    append_video_fps(video_path)
