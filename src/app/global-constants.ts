export enum WebSocketEvent {
    CLOSE = "closed",
    OPEN = "open",
    SEND = "sending",
    MESSAGE = "message",
    ERROR = "error"
  }

export class GlobalConstants {
    public static clipServerURL: string = 'ws://localhost:8001';
    //public static clipServerURL: string = 'ws://extreme00.itec.aau.at:8001';
    public static dataHost = 'http://localhost/divexplore/';
    //public static dataHost = 'http://extreme00.itec.aau.at/diveXplore/';
    public static keyframeBaseURLMarine_Summaries: string = this.dataHost + 'marinesummaries/';
    public static keyframeBaseURLMarine_SummariesXL: string = this.dataHost + 'marinesummariesXL/';
    public static keyframeBaseURLV3C_Summaries: string = this.dataHost + 'summaries/';
    public static keyframeBaseURLV3C_SummariesXL: string = this.dataHost + 'summariesXL/';
    public static keyframeBaseURLMarine_Shots: string = this.dataHost + 'thumbsm/';
    public static keyframeBaseURLV3C_Shots: string = this.dataHost + 'thumbs/';

    public static maxResultsToReturn = 1200;
    public static resultsPerPage = 30;
}