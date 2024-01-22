import { Injectable, EventEmitter, OnInit } from '@angular/core';

import {UserService} from '../../openapi/dres/api/user.service';
import {EvaluationClientService} from '../../openapi/dres/api/evaluationClient.service';
import {SubmissionService} from '../../openapi/dres/api/submission.service';
//import {LogService} from '../../openapi/dres/api/log.service';

//import * as videoDataFPS from '../assets/v3c_video_fps.json';

import {
  ApiClientAnswer,
  ApiClientAnswerSet,
  ApiClientSubmission,
  ApiEvaluationInfo, ApiClientEvaluationInfo, 
  ApiEvaluationStatus,
  ApiUser,
  LoginRequest, LogService, 
  QueryEvent,
  QueryResult,
  QueryResultLog,
  SuccessfulSubmissionsStatus,
  SuccessStatus,
  ApiClientTaskTemplateInfo,
  ApiTaskTemplateInfo,
  EvaluationService,
  ApiEvaluationState,
  QueryEventLog
} from '../../openapi/dres/';
import { GlobalConstants, WSServerStatus } from './global-constants';
import { NONE_TYPE } from '@angular/compiler';
import { UrlSegment } from '@angular/router';
import { catchError, Observable, of, tap } from 'rxjs';
import { AppComponent } from './app.component';
import { QueryComponent } from './query/query.component';

export enum GUIActionType {
  TEXTQUERY = 'TEXTQUERY',
  SIMILARITY = 'SIMILARITY',
  FILESIMILARITY = 'FILESIMILARITY',
  HISTORYQUERY = 'HISTORYQUERY', 
  INSPECTFULLIMAGE = 'INSPECTFULLIMAGE',
  HIDEFULLIMAGE = 'HIDEFULLIMAGE',
  NEXTPAGE = 'NEXTPAGE',
  PREVPAGE = 'PREVPAGE',
  SHOWHELP = 'SHOWHELP',
  RESETQUERY = 'RESETQUERY',
  SUBMIT = 'SUBMIT',
  SUBMITANSWER = 'SUBMITANSWER', 
  CLEARQUERY = 'CLEARQUERY'
}

export interface GUIAction { 
  timestamp: number;
  actionType: GUIActionType;
  page?: string;
  info?: string; 
  item?: number; 
  results?: Array<string>;
}

export interface VbsServiceCommunication {
  statusTaskRemainingTime: string;
  statusTaskInfoText: string;
}

@Injectable({
  providedIn: 'root'
})
export class VBSServerConnectionService {

  errorMessageEmitter = new EventEmitter<string>();
  successMessageEmitter = new EventEmitter<string>();

  sessionId: string | undefined; 
  vbsServerState: WSServerStatus = WSServerStatus.UNSET;

  serverRuns: Array<string> = [];
  serverRunIDs: Array<string> = [];
  serverRunStates = new Map();
  serverRunsRemainingSecs = new Map();
  currentTaskIsAVS = false;
  selectedServerRun: number | undefined;

  queryEvents: Array<QueryEvent> = [];
  resultLog: Array<QueryResultLog> = [];
  interactionLog: Array<GUIAction> = [];

  lastRunInfoRequestReturned404 = false;

  activeUsername: string = '';
  submissionResponse: string = '';

  constructor(
    private userService: UserService,
    private evaluationClientService: EvaluationClientService,
    private evaluationService: EvaluationService, 
    private submissionService: SubmissionService,
    private logService: LogService
  ) {
    this.println(`VBSServerConnectionService created`);
    if (localStorage.getItem("LSCusername")) {
      this.activeUsername = localStorage.getItem("LSCusername")!;
    } else {
      this.activeUsername = GlobalConstants.configUSER;
    }
    this.connect();
  }

  submitQueryLog() {
    if (this.resultLog.length > 0 && this.queryEvents.length > 0) {
        if (this.resultLog.length > 0) {
          this.logService.postApiV2LogQuery(this.sessionId!, {
            timestamp: Date.now(),
            events: this.queryEvents
          } as QueryEventLog)
          .subscribe(
            (response) => {
              console.log('QueryLog successfully received:', response);
            },
            (error) => {
              console.error('QueryLog receive error:', error);
            }
          );
        } else {
          this.println('could not send result log in handleSubmissionResponse, because it is empty!');
        }
      }
  }

  saveLogLocally() {
    if (this.resultLog) {
      let log = localStorage.getItem('VBSQueryLog');
      if (log) {
        let loga = JSON.parse(log);
        loga.push(this.resultLog)
        localStorage.setItem('VBSQueryLog',JSON.stringify(loga));
      } else {
        let loga  = [this.resultLog];
        localStorage.setItem('VBSQueryLog',JSON.stringify(loga));
      }
    }
  }

  connect() {

      // === Handshake / Login ===
      this.userService.postApiV2Login({
        username: GlobalConstants.configUSER,
        password: GlobalConstants.configPASS
      } as LoginRequest)
      .subscribe((login: ApiUser) => {
          this.println('Login successful\n' +
          `user: ${login.username}\n` +
          `role: ${login.role}` +
          `session: ${login.sessionId}`);

          // Successful login
          this.vbsServerState = WSServerStatus.CONNECTED;

          /*
          It is better pratice, to let the browser properly handle
          cookies. In order to to that, uncomment the "withCredentials"
          in the app.module.ts line to not have to worry about the session.
          */
          this.sessionId = login.sessionId;
          this.println(this.sessionId!);
      
          // Wait for a second (do other things)
          setTimeout(() => {
              // === Evaluation Run Info ===
              this.evaluationClientService.getApiV2ClientEvaluationList(this.sessionId!).subscribe((evaluations: ApiClientEvaluationInfo[]) => {
              this.println(`Found ${evaluations.length} ongoing evaluations`);
              this.serverRuns = [];
              this.serverRunIDs = [];
              evaluations.forEach((evaluation: ApiClientEvaluationInfo) => {
                this.println(`${evaluation.id} ${evaluation.name} ${evaluation.type} ${evaluation.status}`);
                  this.serverRuns.push(evaluation.name);
                  //if (evaluation.templateDescription) {
                  //  this.serverRuns.push(evaluation.templateDescription);
                  //} else {
                  //  this.serverRuns.push(evaluation.name);
                  //}
                  this.serverRunStates.set(evaluation.id, evaluation.status);
                  this.serverRunIDs.push(evaluation.id);
                  this.serverRunsRemainingSecs.set('evaluationId', '00:00');
              });
              });
          });

      });
  }

  getClientTaskInfo(runId: string, comm: VbsServiceCommunication) {
    try {
      if (this.lastRunInfoRequestReturned404) {
        return;
      }

      if (this.serverRunStates.get(runId) == 'ACTIVE') {
        //console.log('requesting info for ' + runId + ' and session ' + this.sessionId!);

        this.evaluationClientService.getApiV2ClientEvaluationCurrentTaskByEvaluationId(runId, this.sessionId!)
        .pipe(
          catchError((error: any) => {
            console.log('Error ' + error.status + ' when requesting evaluations!', error);
            if (error.status == 404) {
              this.lastRunInfoRequestReturned404 = true;
            }
            return of(null);  // Return an observable that emits no items to the observer
          })
        ).subscribe((info: ApiTaskTemplateInfo /*ClientTaskInfo*/ | null) => {
          if (info != null) {
            if (info.taskGroup.includes('AVS')) {
              this.currentTaskIsAVS = true;
            } else {
              this.currentTaskIsAVS = false;
            }
            //console.log(`task: ${info.taskGroup} ${info.taskType} ${info.duration}`);
            comm.statusTaskInfoText = info.name; //+ ', ' + info.id + ", " + info.taskGroup;
          }
        })
        

        /*this.evaluationService.getApiV2EvaluationStateList()
        .pipe(
          catchError((error: any) => {
            console.log('error occurred when requesting evaluation state list!', error);
            return of(null);  // Return an observable that emits no items to the observer
          })
        ).subscribe((states: Array<ApiEvaluationState> | null) => {
          states?.forEach((eState) => {
            //console.log(eState);
            if (eState.evaluationStatus == 'ACTIVE' && eState.taskStatus == 'RUNNING') {
              this.serverRunsRemainingSecs.set(eState.evaluationId, this.createTimestamp(eState.timeLeft) + ' ');
              //console.log(this.serverRunsRemainingSecs.get(eState.evaluationId) + ' - ' + eState.evaluationId);
            }
          
          })
        })*/
      } else {
        comm.statusTaskInfoText = 'no task active';
      }
    } catch (error) {
      console.log('issue with task info request');
    }
  }


  createTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
  
    const timestamp = `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(remainingSeconds)}`;
    return timestamp;
  }
  
  padZero(value: number): string {
    return value.toString().padStart(2, '0');
  }

  /*getRunInfoList() {
    this.evaluationClientService.getApiV1ClientRunInfoList(this.sessionId!).subscribe((info: ClientRunInfoList) => {
      for (const r of info.runs) {
        console.log(r)
      }
    })
  }*/

  handleSubmissionResponseAndSendResultLog(status: SuccessfulSubmissionsStatus, info: string) {
    this.println('The submission was successful.');

    this.submissionResponse = 'Submission successfull!'
    this.successMessageEmitter.emit(this.submissionResponse);

    // === Example 3: Log ===
    if (this.resultLog.length > 0) {
      this.logService.postApiV2LogResult(this.sessionId!, {
        timestamp: Date.now(),
        sortType: 'list',
        results: this.resultLog[this.resultLog.length-1].results,
        events: [],
        resultSetAvailability: ''
      } as QueryResultLog)
      .subscribe(
        (response) => {
          let info = 'QueryResultLog successfully received:' + response;
          console.log(info);
          this.successMessageEmitter.emit(info);
        },
        (error) => {
          console.error('QueryResultLog receive error:', error);
          this.errorMessageEmitter.emit(error.error.description);
        }
      );
    } else {
      this.println('could not send result log in handleSubmissionResponse, because it is empty!');
    }
  }

  private handleSubmissionError(err:any) {
    let errorMsg = '';
    if (err.status === 401) {
      errorMsg = 'There was an authentication error during the submission. Check the session id.';
      console.error(errorMsg);
      this.errorMessageEmitter.emit(errorMsg);
    } else if (err.status === 404) {
      errorMsg = 'There is currently no active task which would accept submissions.';
      console.error(errorMsg);
    } else {
      console.log(`Something unexpected went wrong during the submission: : ${JSON.stringify(err)}`);
      this.errorMessageEmitter.emit(err.error.description);
    }
    return of(null);
  }

  submitFrame(videoid: string, frame: number, fps: number) {

    let mySubmission = {
      text: undefined, //text - in case the task is not targeting a particular content object but plaintext
      mediaItemName: videoid, //'00001', // item -  item which is to be submitted
      mediaItemCollectionName: undefined, // collection - does not usually need to be set
      start: frame / fps * 1000, // 10_000, //start time in milliseconds
      end: undefined //end time in milliseconds, in case an explicit time interval is to be specified
    } as ApiClientAnswer

    //set start and end, if current task is AVS
    if (this.currentTaskIsAVS) {
      mySubmission.start = (frame - fps) / fps * 1000;
      mySubmission.end = (frame + fps) / fps * 1000;
    }

    // === Submission ===
    this.println('submit video=' + videoid + ' frame=' + frame + ' (fps=' + fps + '): ' + JSON.stringify(mySubmission));

    this.submissionService.postApiV2SubmitByEvaluationId(this.serverRunIDs[this.selectedServerRun!], {answerSets: [
      {answers: [
        mySubmission
      ]} as ApiClientAnswerSet
    ]} as ApiClientSubmission,
    
    this.sessionId!).subscribe((submissionResponse: SuccessfulSubmissionsStatus) => {
      // Check if submission as successful
      this.handleSubmissionResponseAndSendResultLog(submissionResponse, 'f:' + frame);
    }
    , error => {
      this.handleSubmissionError(error);
    });

    /*
    //'00:00:10:00', // timecode - in this case, we use the timestamp in the form HH:MM:SS:FF
    this.submissionService.getApiV1Submit(
      undefined, // collection - does not usually need to be set
      videoid, // item -  item which is to be submitted
      undefined, //text - in case the task is not targeting a particular content object but plaintext
      frame, // frame - for items with temporal components, such as video
      undefined, // shot - only one of the time fields needs to be set.
      undefined, // timecode - in this case, we use the timestamp in the form HH:MM:SS:FF
      this.sessionId! // the sessionId, as always
    ).pipe(
      tap((status: SuccessfulSubmissionsStatus) => {
        this.handleSubmissionResponse(status, ''+videoid + '-' + frame);
      }), 
      catchError(err => {
        return this.handleSubmissionError(err);
      })
    ).subscribe()
    */
  }


  submitText(text: string) {
    // === Submission ===
    //'00:00:10:00', // timecode - in this case, we use the timestamp in the form HH:MM:SS:FF

    this.submissionService.postApiV2SubmitByEvaluationId(this.serverRunIDs[this.selectedServerRun!], {answerSets: [
      {answers: [
        {
          text: text, //text - in case the task is not targeting a particular content object but plaintext
          mediaItemName: undefined, //'00001', // item -  item which is to be submitted
          mediaItemCollectionName: undefined, // collection - does not usually need to be set
          start: undefined, // 10_000, //start time in milliseconds
          end: undefined //end time in milliseconds, in case an explicit time interval is to be specified
        } as ApiClientAnswer
      ]} as ApiClientAnswerSet
    ]} as ApiClientSubmission,
    
    this.sessionId!).subscribe((submissionResponse: SuccessfulSubmissionsStatus) => {
      // Check if submission as successful
      this.handleSubmissionResponseAndSendResultLog(submissionResponse, 't:'+text);
    }
    , error => {
      this.handleSubmissionError(error);
    });

    /*
    this.submissionService.getApiV1Submit(
      undefined, // collection - does not usually need to be set
      undefined, // item -  item which is to be submitted
      text, //text - in case the task is not targeting a particular content object but plaintext
      undefined, // frame - for items with temporal components, such as video
      undefined, // shot - only one of the time fields needs to be set.
      undefined, // timecode - in this case, we use the timestamp in the form HH:MM:SS:FF
      this.sessionId! // the sessionId, as always
    ).pipe(
      tap((status: SuccessfulSubmissionsStatus) => {
        this.handleSubmissionResponse(status, 'text:'+text);
      }), 
      catchError(err => {
        return this.handleSubmissionError(err);
      })
    ).subscribe()
    */
  }

  logout(appComp: AppComponent) {
      // === Graceful logout ===
      this.userService.getApiV2Logout(this.sessionId!).subscribe((logout: SuccessStatus) => {
        if (logout.status) {
          this.vbsServerState = WSServerStatus.DISCONNECTED;
          this.println('Successfully logged out');
        } else {
          this.println('Error during logout: ' + logout.description);
        }
      });
  }

  private println(msg: string): void {
      console.log(msg);
  }
}
