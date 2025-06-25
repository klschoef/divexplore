import cv2 as cv
import sys
import os
import numpy as np
import csv


TWIDTH = 320 #160
THEIGHT = 180 #90
SUMMARYPATH = "../output/summaries"
KEYFRAMEPATH = "../output/keyframes"

if len(sys.argv) < 2:
    print(f'usage: python3 {sys.argv[0]} <scene-file> [thumb-width thumb-height [outputpath]]')
    exit(1)
                            
if len(sys.argv) >= 4:
    TWIDTH = int(sys.argv[2])
    THEIGHT = int(sys.argv[3])

if len(sys.argv) == 5:
    SUMMARYPATH = sys.argv[4]

print(f'thumb-width={TWIDTH} thumb-height={THEIGHT} outputpath={SUMMARYPATH} keyframes={KEYFRAMEPATH}')


class Summary:
    shots = []
    def __init__(self, cols, rows, TWIDTH, THEIGHT):
        self.cols = cols
        self.rows = rows
        self.num = cols * rows
        self.TWIDTH = TWIDTH
        self.THEIGHT = THEIGHT

class Shot:
    start = -1
    end = -1
    len = -1
    keyframepath = ""
    keyframe = None
    thumb = None

    def __init__(self, start, end):
        self.start = int(start)
        self.end = int(end)
        self.len = self.end - self.start

    def __str__(self):
        return f"{self.start}-{self.end} ({self.len}) - {self.keyframe}"


if not os.path.exists(SUMMARYPATH):
    os.mkdir(SUMMARYPATH)

shots = []
summaries = []
summaries.append( Summary(1,1,TWIDTH,THEIGHT) )
summaries.append( Summary(2,2,TWIDTH,THEIGHT) )
summaries.append( Summary(4,3,TWIDTH,THEIGHT) )
summaries.append( Summary(6,4,TWIDTH,THEIGHT) )
summaries.append( Summary(10,6,TWIDTH,THEIGHT) )
summaries.append( Summary(11,7,TWIDTH,THEIGHT) )
summaries.append( Summary(13,8,TWIDTH,THEIGHT) )
summaries.append( Summary(14,9,TWIDTH,THEIGHT) )
summaries.append( Summary(16,10,TWIDTH,THEIGHT) )
summaries.append( Summary(18,11,TWIDTH,THEIGHT) )

csvfile = open(os.path.join(SUMMARYPATH,'summaries.csv'),'a')
writer = csv.writer(csvfile, delimiter=',')

with open(f'{sys.argv[1]}') as f:
    lines = f.readlines()

    videoid = os.path.basename(f.name).replace(".mp4.scenes.txt","")
    if not os.path.exists(os.path.join(SUMMARYPATH,videoid)):
        os.mkdir(os.path.join(SUMMARYPATH,videoid))

    for line in lines:
        frames = line.split()
        s = Shot(frames[0], frames[1])
        framenum = int((int(frames[0]) + int(frames[1])) / 2)
        s.keyframepath = os.path.join( os.path.join(KEYFRAMEPATH,videoid), f"{videoid}_{framenum}.png")
        s.keyframe = cv.imread(s.keyframepath)
        shots.append(s)

    shots.sort(key=lambda x: x.len, reverse=True)

    scount = 1
    for summary in summaries:
        print(f"{len(shots)} - {summary.cols}x{summary.rows}")

        rows = summary.rows
        cols = summary.cols
        while cols > rows and len(shots) / cols < rows and cols > 1 and len(shots) / (cols-1) <= (cols-1)*rows:
            cols -= 1
       
        while rows > 1 and len(shots) <= cols * (rows-1):
            rows -= 1
        
        while len(shots) <= (cols-1) * rows:
            cols -= 1


        img = np.zeros((rows * summary.THEIGHT, cols * summary.TWIDTH, 3), dtype="uint8")
        
        toshots = [] #temporally ordered shots
        for i in range(0,min(len(shots), summary.num)):
            shot = shots[i]
            toshots.append(shot)

        #sort by framenumber
        toshots.sort(key=lambda x: x.start, reverse=False)

        i = 0
        for r in range(0,rows):
            for c in range(0,cols):
                if len(toshots) > i:
                    shot = toshots[i]
                    thumb = cv.resize(src=shot.keyframe, dsize=(summary.TWIDTH,summary.THEIGHT))
                    img[r*summary.THEIGHT:(r+1)*summary.THEIGHT,c*summary.TWIDTH:(c+1)*summary.TWIDTH] = thumb
                i += 1

        sumname = f"{videoid}_summary_{scount}_{len(shots)}_{cols}_{rows}.jpg"
        outfile = os.path.join(os.path.join(SUMMARYPATH,videoid),sumname)
        print(outfile)
        cv.imwrite(outfile, img)

        info = [videoid,scount,len(shots),cols,rows,sumname]
        writer.writerow(info)

        if len(shots) <= summary.num:
            break

        scount += 1

csvfile.close()

