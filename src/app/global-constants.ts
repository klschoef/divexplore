import { LocalConfig } from "./local-config";

//console.log(videoShots)

//export var vbsServerConnectionService: VBSServerConnectionService | undefined;

//export var queryHistory:Array<string> = [];

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

export interface QueryType { type: string; query: string; maxresults: number; resultsperpage: number; selectedpage: string; dataset: string; }

export class GlobalConstants {
    public static configVBSSERVER = 'https://vbs.videobrowsing.org';
    public static configUSER = 'divexplore';
    public static configPASS = 'dHKooTWGP3LY'; //'MRT7jDaRUq';
    
    public static clipServerURL: string = 'ws://' + LocalConfig.config_CLIP_SERVER_HOST + ':' + LocalConfig.config_CLIP_SERVER_PORT;
    public static nodeServerURL: string = 'ws://' + LocalConfig.config_NODE_SERVER_HOST + ':' + LocalConfig.config_NODE_SERVER_PORT;
    public static dataHost = LocalConfig.config_DATA_BASE_URL;

    public static keyframeBaseURLMarine_Summaries: string = this.dataHost + 'marinesummaries/';
    public static keyframeBaseURLMarine_SummariesXL: string = this.dataHost + 'marinesummariesXL/';
    public static keyframeBaseURLV3C_Summaries: string = this.dataHost + 'summaries/';
    public static keyframeBaseURLV3C_SummariesXL: string = this.dataHost + 'summariesXL/';
    public static keyframeBaseURLMarine_Shots: string = this.dataHost + 'thumbsm/';
    public static keyframeBaseURLV3C_Shots: string = this.dataHost + 'thumbs/';

    public static videoURLV3C = this.dataHost + 'v3cvideos/';
    public static videoURLMarine = this.dataHost + 'marinevideos/';

    public static maxResultsToReturn = 1200;
    public static resultsPerPage = 30;
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
      return `${timeString}.${ff}`
    } else {
      return timeString;
    }
  }

/**
 * EXAMPLE OF LOCAL CONFIG (local-config.ts)
 * 
 export class LocalConfig {
    public static config_CLIP_SERVER_HOST = 'extreme00.itec.aau.at'; //localhost
    public static config_CLIP_SERVER_PORT = '8001';

    public static config_DATA_BASE_URL = 'http://extreme00.itec.aau.at/diveXplore/'; //http://localhost/divexplore/
}
 */