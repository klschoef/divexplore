import sys
import glob
import os
import re
import csv
import json
import pymongo
import pandas as pd

if len(sys.argv) < 6:
    print(f'usage: python3 {sys.argv[0]} <fps.txt> <scenes-folder> <texts-folder> <speech-folder> <summaries-folder>')
    exit(1)

myclient = pymongo.MongoClient('mongodb://localhost:27017')    
mydb = myclient['divexplore']

fpsfilename = sys.argv[1]
shotinfodir = sys.argv[2]
#videoinfodir = sys.argv[3]
textsdir = sys.argv[3]
speechdir = sys.argv[4]
summarydir = sys.argv[5]

###############################################################################
# function to read the video information from the json files
###############################################################################
def collectVideoInfo(infodir, videosdict):
    for filename in glob.iglob(infodir + '*.json', recursive=False):
        filebasename = os.path.basename(filename)
        videoid = filebasename.split('.')[0]
        #print(f"{videoid} - {filename}")
        
        with open(filename, encoding='latin-1') as f:
            strvideoinfo = f.readline()
            vinfo = json.loads(strvideoinfo)
            videosdict[videoid]['duration'] = vinfo['duration']
            videosdict[videoid]['description'] = vinfo['description']
            videosdict[videoid]['title'] = vinfo['title']
            if 'uploadDate' in vinfo:
                videosdict[videoid]['uploaddate'] = vinfo['uploadDate']
            elif 'upload_date' in vinfo:
                videosdict[videoid]['uploaddate'] = vinfo['upload_date']
            if 'channel' in vinfo:
                videosdict[videoid]['channel'] = vinfo['channel']
            elif 'uploader' in vinfo:
                videosdict[videoid]['channel'] = vinfo['uploader']
            if 'tags' in vinfo:
                videosdict[videoid]['tags'] = vinfo['tags']
            if 'categories' in vinfo:
                videosdict[videoid]['categories'] = vinfo['categories']


            #print(f'{vinfo["duration"]} {vinfo["description"]} {vinfo["title"]} {vinfo["uploadDate"]} {vinfo["channel"]}')
            
            #for tag in vinfo["tags"]:
            #    print(f'{tag}')
            #for cat in vinfo["categories"]:
            #    print(f'{cat}')

    #print(filebasename)



###############################################################################
# process detected speech
###############################################################################
def collectSpeechForVideo(speechdir, videos):
    for videoid in videos:
        filename = f"{speechdir}/{videoid}_speech_results.csv"
        if not os.path.isfile(filename):
            continue

        kfspeeches = []
        with open(filename, mode='r', encoding='utf-8') as file:
            csv_reader = csv.reader(file)
            next(csv_reader) #skip header
            for row in csv_reader:
                ffrom = int(row[0])
                fto = int(row[1])
                speech = row[2].replace(',',' ')
                speech = re.sub(r'[^\w\s]', '', speech)  # Keeps only alphanumeric characters and spaces
                speech = re.sub(r'\s+', ' ', speech)   # Replace multiple spaces/newlines with a single space
                speech = speech.lower().strip()
                if len(speech) < 2:
                    continue

                for shot in videos[videoid]['shots']:
                    if ffrom >= shot['from'] and ffrom <= shot['to'] or fto >= shot['from'] and fto <= shot['to']:
                        obj = {
                            "speech": speech,
                            "keyframe": shot['keyframe']
                        }
                        kfspeeches.append(obj)
                        break
                
        videos[videoid]['asr'] = kfspeeches

###############################################################################
# function to read ocr text data
###############################################################################
def collectTexts(textsdir, videos):
    for videoid in videos:
        filename = f"{textsdir}/ocr_{videoid}.csv"
        if not os.path.isfile(filename):
            continue
        
        kftexts = []

        with open(filename, mode='r', encoding='utf-8') as file:
            csv_reader = csv.reader(file)  # Default delimiter is ','
            next(csv_reader) #skip header
            for row in csv_reader:
                kf = row[0]  # First column
                alltexts = row[1]  # Second column
                texts = alltexts.split(',')

                for text in texts:
                    # Replace all special characters with an empty string
                    text = re.sub(r'[^\w\s]', '', text)  # Keeps only alphanumeric characters and spaces
                    text = re.sub(r'\s+', ' ', text)   # Replace multiple spaces/newlines with a single space
                    text = text.lower().strip()
                    if len(text) < 2:
                        continue

                    comps = kf.split('_')
                    sec = float(comps[len(comps)-1].split('.')[0]) / fps[f"{videoid}.mp4"]
                    obj = {
                        "text": text,
                        "second": sec,
                        "keyframe": kf
                    }
                    kftexts.append(obj)

        videos[videoid]['texts'] = kftexts

###############################################################################
# function to read the shot boundaries, created by TransNetv2
###############################################################################
def collectShotBoundaries(shotinfodir,fps):
    videosdict = {}

    for filename in glob.iglob(shotinfodir + '**/*scenes.txt', recursive=True):
        #print(filename)
        filebasename = os.path.basename(filename)
        #print(filebasename)
        videoid = filebasename.split('.')[0]
        #print(videoid)

        strshots = []
        with open(filename) as f:
            strshots = f.readlines()

        shotsdict = []
        for shot in strshots:
            tmp = shot.split(' ')
            ffrom = int(tmp[0])
            fto = int(tmp[1])
            fkey = ffrom + int((fto - ffrom)/2)
            keyframe = f"{videoid}_{fkey}.jpg"
            shotobject = {
                "from": ffrom,
                "to": fto,
                "keyframe": keyframe
            }

            if len(videoid) == 5 and videoid.startswith("LHE"):
                predictions = extractPredictions(videoid, fkey)
                shotobject['predictions'] = predictions

            shotsdict.append(shotobject)

        videoobject = {
            "videoid": videoid,
            "fps": fps[f'{videoid}.mp4'],
            "shots": shotsdict
        }
        videosdict[videoid] = videoobject

    #with open('vbsvideoinfo.json','w') as f:
    #    f.writelines(json.dumps(videossdict))
    return videosdict

###############################################################################
# function to collect summaries
###############################################################################
def collectSummaries(summarydir, videos):
    for key in videos:
        videopath = os.path.join(summarydir,key)
        #print(f'looking in {videopath}')
        if os.path.exists(videopath):
            summarylist = []
            for filename in glob.iglob(videopath + '/*.jpg', recursive=False):
                #print(filename)
                summarylist.append(filename.replace(f"{summarydir}/",'summariesXL/'))
            #print(f'looked for summaries in {videopath} : found {len(summarylist)}')
            summarylist.sort()
            videos[key]['summaries'] = summarylist

###############################################################################
# parse LHE data - unused in OpenSource version
###############################################################################

def extractPredictions(video, frame):
    predictions = []

    # Parse the inference JSON
    inference_file = os.path.join(lheinferencedir, f"{video}_inference_results.json")
    if os.path.exists(inference_file):
        with open(inference_file, 'r') as f:
            inference_data = json.load(f)
            frame_image = f"{video}_{frame}.png"
            for entry in inference_data:
                if entry['image'] == frame_image:
                    predictions.extend(entry['predictions'])
                    break

    # Parse the action recognition CSV
    action_file = os.path.join(lheactiondir, f"predictions_{video}.csv")
    if os.path.exists(action_file):
        with open(action_file, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Extract frame range
                segment_frames = row['segment_idx'].split('Frames: ')[-1].strip(')')
                start_frame, end_frame = map(int, segment_frames.split('-'))
                # Check if the current frame is in range
                if start_frame <= frame <= end_frame:
                    action_prediction = {
                        "class": row['final_prediction'],
                        "score": float(row['confidence_score_d']),
                        "type": "action"
                    }
                    predictions.append(action_prediction)
                    break

    return predictions
    


###############################################################################
# read fps from file
###############################################################################
print('reading fps')
df = pd.read_csv(fpsfilename, sep=' ', header=None, index_col=0).squeeze("columns")
fps = df.to_dict()


###############################################################################
# create videos dictionary from shots info 
###############################################################################
print('reading shot boundaries')
videosdict = collectShotBoundaries(shotinfodir,fps)

# print('collecting vimeo video information')
# collectVideoInfo(videoinfodir, videosdict)

print('collecting texts')
collectTexts(textsdir, videosdict)

print('collecting asr data')
collectSpeechForVideo(speechdir, videosdict)

print('collecting summaries')
collectSummaries(summarydir, videosdict)

print(f'connecting to MongoDB at {myclient}')


###############################################################################
# add videos to database
###############################################################################
mytxt = mydb['texts']
mytxt.drop()

mycol = mydb['videos']
mycol.drop()
mycol.insert_many(videosdict.values())

print('Done. Now call python3 ../mongo/3createTexts.py')
