import sys
from PIL import Image
import open_clip
import faiss
import torch
import asyncio
import websockets
import json
import pandas as pd
import os
import re
from websockets.exceptions import ConnectionClosedOK

clipdata = []

def search(text_features, k):
    D, I = index.search(text_features, k)
    return D, I

def similaritysearch(idx, k):
    D, I = index.search(clipdata[0][idx:idx+1], k)
    return D, I

def getLabels():
    return labels

def filterAndLabelResults(I, D, resultsPerPage, selectedPage):
    labels = getLabels()
    kfresults = []
    kfresultsidx = []
    kfscores = []
    num_results = len(I[0])

    if num_results == 0:
        raise Exception("No results from FAISS search.")

    ifrom = (selectedPage - 1) * resultsPerPage
    ito = selectedPage * resultsPerPage

    if ifrom >= num_results:
        return [], [], []
    
    for i in range(ifrom, min(ito, num_results)):
        idx = I[0][i]
        score = D[0][i]
        if idx == -1:
            continue
        kfresults.append(str(labels[idx]))
        kfresultsidx.append(int(idx))
        kfscores.append(str(score))

    return kfresults, kfresultsidx, kfscores



async def handler(websocket):
    try:
        while True:
            message = await websocket.recv()
            print(message)
            msg = json.loads(message)
            event = msg['content']
            clientId = msg['clientId']

            if 'ping' not in event:
                with torch.no_grad():
                    D = []
                    I = []
                    k = int(event['maxresults']) 
                    k = min(k, index.ntotal)
                    resultsPerPage = int(event['resultsperpage'])
                    selectedPage = int(event['selectedpage'])

                    if event['type'] == 'textquery':
                        input = open_clip.tokenize(event['query']).to(device)
                        print(input.shape)
                        text_features = model.encode_text(input).cpu()
                        print(text_features.shape)
                        D, I = search(text_features, k)
                    elif event['type'] == 'similarityquery':
                        D, I = similaritysearch(int(event['query']), k)
                    elif event['type'] == 'file-similarityquery':
                        print(f'trying to load {event["query"]} from {keyframe_base_root} {event["pathprefix"]}')
                        image = preprocess(Image.open(os.path.join(keyframe_base_root,event['pathprefix'],event['query']))).unsqueeze(0).to(device)
                        image_features = model.encode_image(image)
                        image_features = image_features.cpu()
                        print('shape:',image_features.shape)
                        mylist = image_features[0].tolist()
                        print('features extracted')
                        D, I = search(image_features, k)
                        print('file-similarity search finished')
                
                    kfresults, kfresultsidx, kfscores = filterAndLabelResults(I, D, resultsPerPage, selectedPage)
                    results = {'num':len(kfresults), 'clientId':clientId, 'totalresults':k, 'results':kfresults, 'resultsidx':kfresultsidx, 'dataset':'v3c', 'scores':kfscores }
                    print(results)
                    tmp = json.dumps(results)
                    await websocket.send(tmp)
    except ConnectionClosedOK:
        print("Connection closed gracefully.")
    except Exception as e:
        print("Exception: ", str(e))


async def main():
    port = 8001
    if len(sys.argv) > 3:
        port = sys.argv[3]
    async with websockets.serve(handler, "", port):
        print(f'listening on {port}')
        await asyncio.Future()  # run forever

#It Allows You to Execute Code When the File Runs as a Script, but Not When It’s Imported as a Module
#if __name__ == "__main__":
#    asyncio.run(main())

device = "cuda:0" if torch.cuda.is_available() else "cpu"
print(device)

modelname = "ViT-H-14"
pretrained = "laion2b_s32b_b79k"
match = re.search(r"openclip-[^-]+-(.+?)_(.+)\.csv", sys.argv[2])
if match:
    modelname = match.group(1)     # "ViT-H-14"
    pretrained = match.group(2)    # "laion2b_s32b_b79k"
    print("Model name:", modelname)
    print("Pretrained:", pretrained)

model, _, preprocess = open_clip.create_model_and_transforms(modelname, pretrained=pretrained, device=device)
#model, _, preprocess = open_clip.create_model_and_transforms("ViT-H-14", pretrained="laion2b_s32b_b79k", device=device)
#model, _, preprocess = open_clip.create_model_and_transforms("ViT-H-14-378-quickgelu", pretrained="dfn5b", device=device)
#model, preprocess = clip.load("ViT-B/32", device=device)
print('model loaded')

if not len(sys.argv) > 2:
    print(f"usage: python3 {sys.argv[0]} <keyframe-base-root> <csv-file> [<port>]")
    exit(1)


def loadClipFeatures(infoname, csvfilename):
    print(f'loading {infoname}: {csvfilename}')
    #data = pd.read_csv(csvfilename, sep=",", index_col=0, skiprows=0, header=None)
    csvdata = pd.read_csv(csvfilename, sep=",", skiprows=0, header=None)
    data = csvdata.iloc[0:,1:]
    datalabels = csvdata.iloc[0:,0]

    clipdata.append(data)
    print(data.info)
    #print(datalabels)

    d = 1024
    #index = faiss.IndexFlatL2(d) # build the index (L2 distance)
    index = faiss.IndexFlatIP(d)  # build the index with inner product (cosine similarity)
    index.add(data)
    print(index.ntotal)
    print(index.is_trained)

    return index, datalabels


keyframe_base_root = sys.argv[1]
port = 8001
if len(sys.argv) > 3:
    port = sys.argv[3]
index, labels = loadClipFeatures('diveXplore', sys.argv[2])

asyncio.run(main())


