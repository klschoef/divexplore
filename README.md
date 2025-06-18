# ![Logo of diveXplore.](/src/assets/diveXplore.png) 
DiveXplore is an open-source software designed for interactive video retrieval. It has successfully competed in various international competitions, such as the "Video Browser Showdown (VBS)" and "Interactive Video Retrieval 4 Beginners (IVR4B)".
After developing diveXplore since 2012, we decided to make diveXplore open-source for others to contribute to the software or use components of it in their own video retrieval systems.

## OpenAPI Integration/DRES setup ⚙️
These files are needed to allow for a connection to the DRES servers, used during competitions like the VBS and IVR4B. Execute these one after the other to set up the necessary prerequisites.
run `npm install @openapitools/openapi-generator-cli -g`
run `npm install -g ng-openapi-gen`

Finally, generate the TypeScript files with these commands:
`npm run-script gen-dres-client`
`npm run-script gen-dres-dev-client`

## Start Server 🏃‍♀️‍➡️
Run `ng serve` to start the frontend server. Using the default configurations, diveXplore will launch on `http://localhost:4200/`. If you change any of the source code, the application will automatically reload.

## Build 🔨
Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

---

If you're looking for diveXplore's backend, head here: 
https://github.com/klschoef/divexplorebackend

