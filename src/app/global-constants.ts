import { LocalConfig } from "./local-config";

export enum WebSocketEvent {
    UNSET = 'unset', 
    CLOSE = 'disconnected',
    OPEN = 'connected',
    SEND = 'sending',
    MESSAGE = 'message',
    ERROR = 'error'
}

export enum WSServerStatus {
    UNSET = 'unset',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected'
}

export interface QueryType { 
  type: string; 
  query: string; 
  maxresults: number; 
  resultsperpage: number; 
  selectedpage: string; 
  dataset: string; 
}

export class GlobalConstants {
    public static configVBSSERVER = 'https://vbs.videobrowsing.org';
    
    public static replacePNG2 = '.jpg'; //display
    public static replaceJPG_back2 = '.jpg'; //'.jpg'; //file-similarity

    //public static resultsPerPage = 35;
    //public static maxResultsToReturn = this.resultsPerPage*41; //780; //1200; //10000;
    public static imgRatio = 320.0/180.0;
    //public static imgWidth = 236; 
    //public static imgHeight = this.imgWidth/this.imgRatio;
}

export function twoDigits(str:string):string {
    if (str.length < 2) {
      return `0${str}`;
    } else {
      return str;
    }
}

export function formatAsTime(frame:string, fps:number, withFrames:boolean=true) {
    let ff = Math.floor(parseInt(frame) % fps);
    let secs = parseInt(frame) / fps;
    let ss = Math.floor(secs % 60);
    let mm = Math.floor(secs / 60);
    let hh = Math.floor(secs / 3600); 
    let timeString = `${twoDigits(hh.toString())}:${twoDigits(mm.toString())}:${twoDigits(ss.toString())}`;
    if (withFrames) {
      return `${timeString}.${twoDigits(ff.toString())}`
    } else {
      return timeString;
    }
  }

export function getTimestampInSeconds () {
  return Math.floor(Date.now() / 1000)
}
/**
 * EXAMPLE OF LOCAL CONFIG (local-config.ts)
 * 
export class LocalConfig {
    public static config_CLIP_SERVER_HOST = 'extreme00.itec.aau.at'; //localhost
    public static config_CLIP_SERVER_PORT = '8001';

    public static config_NODE_SERVER_HOST = 'extreme00.itec.aau.at'
    public static config_NODE_SERVER_PORT = '8080';
    
    public static config_DATA_BASE_URL = 'http://extreme00.itec.aau.at/diveXplore/'; //http://localhost/divexplore/
    public static config_DATA_BASE_URL_VIDEOS = 'http://videobrowsing.org/v3c/';

    public static config_USER = 'diveXplore1';
    public static config_PASS = 'Wy?j}7&3';
}
 */