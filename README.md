# ![Logo of diveXplore.](/assets/diveXplore.png) 
# <p align="center">DiveXplore Backend</p>
This is the backend for diveXplore, our open-source video retrieval software. This section of the project handles all data preprocessing. The processed data is then utilized by the middleware and frontend of diveXplore to deliver a seamless user experience.

## 🚀 Getting Started 
To get the backend up and running, please follow the steps below.

### Prerequisites
Ensure you have the following software installed and running on your system:
- FFMPEG
- MongoDB

## 🔨 Installation
**1. Clone the repository**

```bash
git clone https://github.com/marleo/divexplorebackend.git
cd divexplore-backend
```
**2. Install the required Python dependencies:**
   
```bash
pip install -r requirements.txt
```

## ⚙️ Usage
Once the Setup is complete, you can start analyzing your videos.

**1. Video Analysis**
   
This step initiates the video processing pipeline. The provided shell script will automatically execute all the necessary analysis scripts in the recommended order.
From the root directory of the project, execute the following commands:
```bash
cd backend/analysis
chmod +x process_video.sh
.process_videos.sh [path_to_video]
```
**2. OpenCLIP Feature Extraction**

After the initial analysis, this script generates OpenCLIP features for each keyframe that was extracted.
```bash
cd backend
python3 extract_openclip_image_features.py
```
**3. Database Integration**
   
The final step is to collate all the generated information and add it to your MongoDB instance.
```bash
cd backend
python3 combine_analysis_files.py output/video_fps.txt output/scenes/ output/ocr/ output/asr/ output/summaries/
```
You have now successfully analyzed all your videos and populated the database!

--- 
--- 
# <p align="center">Middleware</p>
This is the middleware for diveXplore, our open-source video retrieval software. This section handles the FAISS index server, as well as the NodeJS server.
## ⚙️ Usage
**1. Start the FAISS Index Server**
```bash
cd middleware/FAISS
chmod +x start_clipserver.sh
./start_clipserver.sh
```
**2. Start NodeJS server**
In order to configure the NodeJS server, you have to create a local-config.js in the middleware's root directory. 
An example local config (local-config-example.json) is in the directory. Just copy this file and remove the "-example" from the name.
```bash
cd middleware/node
npm i
npm start
```


🔗Frontend
Looking for the user-facing parts of diveXplore? You can find the frontend at the following repository: https://github.com/klschoef/divexplore
