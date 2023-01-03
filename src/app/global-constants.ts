export enum WebSocketEvent {
    CLOSE = "closed",
    OPEN = "open",
    SEND = "sending",
    MESSAGE = "message",
    ERROR = "error"
  }

export class GlobalConstants {
    public static clipServerURL: string = 'ws://extreme00.itec.aau.at:8001';
    public static keyframeBaseURLMarine_Summaries: string = 'http://extreme00.itec.aau.at/diveXplore/marinesummaries/';
    public static keyframeBaseURLMarine_SummariesXL: string = 'http://extreme00.itec.aau.at/diveXplore/marinesummariesXL/';
    public static keyframeBaseURLV3C_Summaries: string = 'http://extreme00.itec.aau.at/diveXplore/summaries/';
    public static keyframeBaseURLV3C_SummariesXL: string = 'http://extreme00.itec.aau.at/diveXplore/summariesXL/';
    public static keyframeBaseURLMarine_Shots: string = 'http://extreme00.itec.aau.at/diveXplore/thumbsm/';
    public static keyframeBaseURLV3C_Shots: string = 'http://extreme00.itec.aau.at/diveXplore/thumbs/';

    public static maxResultsToReturn = 1200;
    public static resultsPerPage = 30;
}