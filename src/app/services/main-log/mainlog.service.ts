import { EventEmitter, Injectable } from '@angular/core';
import {
  QueryEvent,
  QueryResultLog,
  RankedAnswer,
  StatusService,
  LogService
} from '../../../../openapi/dres';
import { StateService } from 'src/app/shared/state/state.service';

interface ExtendedQueryResultLog extends QueryResultLog {
  serverTime: number;
  serverTimeDiff: number;
}

@Injectable({
  providedIn: 'root'
})
export class MainlogService {

  queryEvents: Array<QueryEvent> = [];
  queryResults: Array<RankedAnswer> = [];

  serverTimestamp = 0;
  serverTimeDiff = 0;

  errorMessageEmitter = new EventEmitter<string>();

  constructor(
    private statusService: StatusService,
    private logService: LogService,
    private stateService: StateService
  ) { }

  submitQueryResultLog(sortType: string, page: string = '') {
    const sessionId = this.stateService.getSessionId();
    const serverRunIDs = this.stateService.getServerRunIDs();
    const selectedServerRun = this.stateService.getSelectedServerRun();

    let qrl = {
      timestamp: Date.now(),
      sortType: sortType,
      resultSetAvailability: 'page ' + page,
      results: this.queryResults,
      events: this.queryEvents
    } as QueryResultLog;
    if (page === '') {
      qrl.resultSetAvailability = 'video';
    }

    this.saveLogLocally(qrl);

    this.logService.postApiV2LogResultByEvaluationId(serverRunIDs[selectedServerRun!], sessionId!, qrl)
      .subscribe(
        (response) => {
          let info = 'QueryResultLog: ' + JSON.stringify(response);
          //console.log(info);
          //this.successMessageEmitter.emit(response.description);
          this.queryResults = []; //clear all results
          this.queryEvents = []; //clear all events
        },
        (error) => {
          console.error('QueryResultLog error: ', JSON.stringify(error));
          this.errorMessageEmitter.emit(error.error.description);
        }
      );
  }

  saveLogLocally(qrOrig: QueryResultLog) {
    let qr = JSON.parse(JSON.stringify(qrOrig));
    //qr.results = [];
    qr.results = qr.results.slice(0, 10);

    this.getServerTime();

    let qrl: ExtendedQueryResultLog = qr as unknown as ExtendedQueryResultLog;
    qrl.serverTime = this.serverTimestamp;
    qrl.serverTimeDiff = this.serverTimeDiff;

    let LSname = 'VBS2024QueryResultLog';
    let log = localStorage.getItem(LSname);
    if (log) {
      let loga = JSON.parse(log);
      loga.push(qrl);
      localStorage.setItem(LSname, JSON.stringify(loga));
    } else {
      let loga = [qrl];
      localStorage.setItem(LSname, JSON.stringify(loga));
    }
  }

  getServerTime() {
    let myTime = Date.now();
    this.statusService.getApiV2StatusTime().subscribe((status) => {
      this.serverTimeDiff = status.timeStamp - myTime;
      this.serverTimestamp = status.timeStamp;
      //console.log("got server time: " + status.timeStamp + " diff=" + this.serverTimeDiff);
    });
  }
}
