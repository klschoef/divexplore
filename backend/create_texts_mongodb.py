from pymongo import MongoClient

# Connect to MongoDB
client = MongoClient("mongodb://localhost:27017/")
db = client["divexplore"]  # Replace with the name of your database

# Define the videos and texts collections
videos_collection = db["videos"]
texts_collection = db["texts"]

# Initialize an empty dictionary to hold the unique texts and their frames
unique_texts = {}
skipped = 0
skipped_videos = []

# Iterate through each video document in the videos collection
for video in videos_collection.find():
    if 'texts' not in video:
        continue
    videoid = video["videoid"]
    #print(f'inspecting {videoid}')

    for entry in video["texts"]:
        if 'keyframe' not in entry:
            skipped += 1
            second = entry['second']
            print(f'{videoid} {second}')
            #skipped_videos.append(f'{videoid}_sec{second}')
            continue

        text = entry["text"]
        frame = entry["keyframe"]

        # Format the frame as required
        formatted_frame = f"{videoid}/{frame}"

        # If the text is already encountered, append the frame to it
        if text in unique_texts:
            unique_texts[text].append(formatted_frame)
        else:
            unique_texts[text] = [formatted_frame]

# Insert the unique text and their frames into the texts collection
for text, frames in unique_texts.items():
    new_document = {"text": text, "frames": frames}
    texts_collection.insert_one(new_document)

print("Operation completed!")
print(f'Skipped {skipped}:')
