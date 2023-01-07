import { Injectable, OnInit } from '@angular/core';

import {UserService} from '../../openapi/dres/api/user.service';
import {ClientRunInfoService} from '../../openapi/dres/api/clientRunInfo.service';
import {SubmissionService} from '../../openapi/dres/api/submission.service';
import {LogService} from '../../openapi/dres/api/log.service';

import {
  ClientRunInfo,
  ClientRunInfoList,
  LoginRequest,
  QueryResult,
  QueryResultLog,
  SuccessfulSubmissionsStatus,
  SuccessStatus,
  UserDetails
} from '../../openapi/dres/';
import { GlobalConstants, WSServerStatus } from './global-constants';
import { NONE_TYPE } from '@angular/compiler';
import { UrlSegment } from '@angular/router';
import { catchError, Observable, of, tap } from 'rxjs';
import { AppComponent } from './app.component';

@Injectable({
  providedIn: 'root'
})
export class VBSServerConnectionService {

  sessionId: string | undefined; 

  vbsServerState: WSServerStatus = WSServerStatus.UNSET;

  constructor(
    private userService: UserService,
    private runInfoService: ClientRunInfoService,
    private submissionService: SubmissionService,
    private logService: LogService
  ) {
    this.println(`VBSServerConnectionService created`);
    this.connect();
  }

  connect() {

      // === Handshake / Login ===
      this.userService.postApiV1Login({
        username: GlobalConstants.configUSER,
        password: GlobalConstants.configPASS
      } as LoginRequest)
      .subscribe((login: UserDetails) => {
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
          this.sessionId = login.sessionId!;
          this.println(this.sessionId);
      
          // Wait for a second (do other things)
          setTimeout(() => {
              // === Evaluation Run Info ===
              this.runInfoService.getApiV1ClientRunInfoList(this.sessionId!).subscribe((currentRuns: ClientRunInfoList) => {
              this.println(`Found ${currentRuns.runs.length} ongoing evaluation runs`);
              currentRuns.runs.forEach((run: ClientRunInfo) => {
                      this.println(`${run.name} (${run.id}): ${run.status}`);
                      if (run.description) {
                      this.println(run.description);
                      this.println('');
                      }
                  });
              });
          });

      });
  }

  handleSubmissionResponse(status: SuccessfulSubmissionsStatus, segment: string) {
    this.println('The submission was successful. LOG missing');

    // === Example 3: Log ===
    /*
    this.logService.postApiV1LogResult(this.sessionId!, {
      timestamp: Date.now(),
      sortType: 'list',
      results: [
        {item: 'some_item_name', segment: 3, score: 0.9, rank: 1} as QueryResult,
        {item: 'some_item_name', segment: 5, score: 0.85, rank: 2} as QueryResult,
        {item: 'some_other_item_name', segment: 12, score: 0.76, rank: 3} as QueryResult
      ],
      events: [],
      resultSetAvailability: ''
    } as QueryResultLog);
    */
  }

  private handleSubmissionError(err:any) {
    if (err.status === 401) {
      console.error('There was an authentication error during the submission. Check the session id.');
    } else if (err.status === 404) {
      console.error('There is currently no active task which would accept submissions.');
    } else {
      console.error(`Something unexpected went wrong during the submission: : ${JSON.stringify(err)}`);
    }
    return of(null);
  }

  submitFrame(videoid: string, frame: number) {
    // === Submission ===
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
    
  }

  logout(appComp: AppComponent) {
      // === Graceful logout ===
      this.userService.getApiV1Logout(this.sessionId!).subscribe((logout: SuccessStatus) => {
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