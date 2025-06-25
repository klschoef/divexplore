# <p align="center">![Logo of diveXplore.](frontend/src/assets/diveXplore.png)</p>
<p align="center"> DiveXplore is an open-source software designed for interactive video retrieval. It has successfully competed in various international competitions, such as the "Video Browser Showdown (VBS)" and "Interactive Video Retrieval 4 Beginners (IVR4B)".
After developing diveXplore since 2012, we decided to make diveXplore open-source for others to contribute to the software or use components of it in their own video retrieval systems.</p>

---
---

# <p align="center">Backend</p>
<p align="center">This section of the project handles all data preprocessing. The processed data is then utilized by the middleware and frontend of diveXplore to deliver a seamless user experience.</p>

## 🚀 Getting Started 
To get the backend up and running, please follow the steps below.

### Prerequisites
Ensure you have the following software installed and running on your system:
- FFMPEG
- MongoDB (by default, the settings look for MongoDB running on "mongodb://localhost:27017". If that's not correct, change it in the combine_analysis_files.py and the local-config files)

## 🔨 Installation
**1. Clone the repository**

```bash
git clone https://github.com/klschoef/divexplore.git
```
**2. Install the required Python dependencies:**

_Optional - Create a new Python environment and activate it_:
```bash
python3 -m venv env
source env/bin/activate
```
Then install the required dependencies:

```bash
pip install -r requirements.txt
```

## ⚙️ Usage
Once the Setup is complete, you can start analyzing your videos.

**1. Video Analysis**
   
This step initiates the video processing pipeline. The provided shell script will automatically execute all the necessary analysis scripts in the recommended order.
The analysis has to be performed for every video file you want to include in your system. From the root directory of the project, execute the following commands:
```bash
cd backend/analysis
chmod +x process_video.sh
./process_videos.sh [path_to_video]
```
**2. OpenCLIP Feature Extraction**

After the initial analysis, this script generates OpenCLIP features for each keyframe that was extracted. Execute this script, when you finished processing all of your videos.
```bash
cd backend/analysis
python3 extract_openclip_image_features.py
```
**3. Database Integration**
   
The final step is to collect all the generated information and add it to your MongoDB instance.
```bash
cd backend
python3 combine_analysis_files.py output/video_fps.txt output/scenes/ output/ocr/ output/asr/ output/summaries/
python3 create_texts_mongodb.py
```
You have now successfully analyzed all your videos and populated the database!

### Hosting Images and Videos
The easiest way to host the keyframes/summaries/videos etc. is to move the videos to a folder /videos inside of backend/output/. After that, host a simple server with python from within the /output directory:
```bash
python3 -m http.server
```
If you`re using your own hosting service, change the config files in the back-/frontend accordingly.

---

# <p align="center">Middleware</p>
<p align="center">This section handles the FAISS index server, as well as the NodeJS server.</p>

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
---

# <p align="center">Frontend</p>
<p align="center">This section handles the frontend setup, as well as the connection with the DRES servers.</p>

## 🚀 Getting Started
In order to launch the frontend, the DRES-relevant TypeScript files have to be installed. Additionally, like in the middleware, a config file has to be created.

### Prerequisites
These files are needed to allow for a connection to the DRES servers, used during competitions like the VBS and IVR4B. Execute these one after the other to set up the necessary prerequisites.
```bash
cd frontend
npm install @openapitools/openapi-generator-cli -g
npm install -g ng-openapi-gen
```

Then, generate the TypeScript files with these commands:
```bash
cd frontend
npm run-script gen-dres-client
npm run-script gen-dres-dev-client
```
To connect the frontend to the backend, create a local-config.ts file under src/app/shared/config/. In this directory is a local-config-example.ts. You can just duplicate this file and rename it accordingly. If you followed the previous steps as described, the example config should work as is. 

## 🏃‍♀️‍➡️ Start Server 
Make sure you have installed NPM v18+ and the Angular CLI.

```bash
cd frontend
npm install
npm start
```
Run `ng serve` or `npm start` to start the frontend server. Using the default configurations, diveXplore will launch on `http://localhost:4200/`. If you change any of the source code, the application will automatically reload.

---
---

# <p align="center">🤝 Contributions</p>

<p align="center">All contributions are welcome! To contribute:</p>

<table align="center">
  <tr><td align="left">1. Fork the repository</td></tr>
  <tr><td align="left">2. Create a new branch for your feature or bugfix</td></tr>
  <tr><td align="left">3. Submit a pull request</td></tr>
</table>


