import { LocalConfig } from "./local-config";

export enum WebSocketEvent {
    CLOSE = "closed",
    OPEN = "open",
    SEND = "sending",
    MESSAGE = "message",
    ERROR = "error"
  }

export class GlobalConstants {
    public static clipServerURL: string = 'ws://' + LocalConfig.config_CLIP_SERVER_HOST + ':' + LocalConfig.config_CLIP_SERVER_PORT;
    public static dataHost = LocalConfig.config_DATA_BASE_URL;

    public static keyframeBaseURLMarine_Summaries: string = this.dataHost + 'marinesummaries/';
    public static keyframeBaseURLMarine_SummariesXL: string = this.dataHost + 'marinesummariesXL/';
    public static keyframeBaseURLV3C_Summaries: string = this.dataHost + 'summaries/';
    public static keyframeBaseURLV3C_SummariesXL: string = this.dataHost + 'summariesXL/';
    public static keyframeBaseURLMarine_Shots: string = this.dataHost + 'thumbsm/';
    public static keyframeBaseURLV3C_Shots: string = this.dataHost + 'thumbs/';

    public static maxResultsToReturn = 1200;
    public static resultsPerPage = 30;
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