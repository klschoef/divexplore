import whisper
import sys
import os
import csv
import re
import torch
import cv2

def extract_base_filename(file_path):
    return os.path.splitext(os.path.basename(file_path))[0]

def clean_text(text):
    text = re.sub(r'[^\w\säüö]', '', text, flags=re.UNICODE)
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    text = text.replace(" ", ",")
    return text

def save_to_csv(output_dir, scene_data, base_filename):
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{base_filename}_speech_results.csv")

    with open(output_path, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(['Scene Start', 'Scene End', 'Text'])

        for start, end, words in scene_data:
            cleaned_text = clean_text(' '.join(words))
            writer.writerow([start, end, cleaned_text if cleaned_text else ''])

def parse_scenes_file(scenes_file):
    scenes = []
    with open(scenes_file, 'r') as file:
        for line in file:
            start, end = map(int, line.strip().split())
            scenes.append((start, end))
    return scenes

def get_video_framerate(video_path):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"Error: Unable to open video file {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    return fps

def speech_recognition(video_path, scenes, output_dir):
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    model = whisper.load_model('medium', device=DEVICE)
    audio = whisper.load_audio(video_path)
    result = model.transcribe(word_timestamps=True, audio=audio)

    framerate = get_video_framerate(video_path)
    scene_data = []

    for start, end in scenes:
        words_in_scene = []
        start_sec = start / framerate
        end_sec = end / framerate

        for segment in result['segments']:
            for word in segment['words']:
                word_start_sec = word['start']
                if start_sec <= word_start_sec <= end_sec:
                    words_in_scene.append(word['word'])

        scene_data.append((start, end, words_in_scene))

    base_filename = extract_base_filename(video_path)
    save_to_csv(output_dir, scene_data, base_filename)

def process_video_with_scenes(video_file, scenes_folder, output_dir):
    base_filename = extract_base_filename(video_file)
    video_fileextension = os.path.splitext(video_file)[1][1:]
    scenes_file = os.path.join(scenes_folder, f"{base_filename}.{video_fileextension}.scenes.txt")

    print(f"scenes_file={scenes_file}")
    print(f"video_file={video_file}")

    if not os.path.exists(scenes_file):
        print(f"Warning: No scenes file found for {video_file}")
        return

    print(f"Processing video: {video_file} with scenes in {scenes_file}")
    scenes = parse_scenes_file(scenes_file)
    speech_recognition(video_file, scenes, output_dir)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 extract_asr.py <video_file>")
    else:
        video_file = sys.argv[1]
        scenes_folder = "../output/scenes"
        output_dir = "../output/asr"

        process_video_with_scenes(video_file, scenes_folder, output_dir)
