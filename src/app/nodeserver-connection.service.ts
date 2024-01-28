import { Injectable } from '@angular/core';
import { WSServerStatus,GlobalConstants } from "./global-constants";
import { Observable, Observer } from 'rxjs';
import { AnonymousSubject } from 'rxjs/internal/Subject';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { GlobalConstantsService } from './global-constants.service';


//const URL = GlobalConstants.nodeServerURL;
let statusConnected = {'wsstatus':'connected'};

export interface Message {
    source: string;
    content: any;
}

export interface FPSResponse {
  type: string;
  fps: number;
  duration: number;
  correlationId: string;
}

@Injectable({
  providedIn: 'root'
})
export class NodeServerConnectionService {

  private subject: AnonymousSubject<MessageEvent> | undefined;
  public messages: Subject<Message>;


  public connectionState: WSServerStatus = WSServerStatus.UNSET;;

  constructor(private globalConstants: GlobalConstantsService) {
    console.log('NodeServerConnectionService created');
    this.messages = this.connectToServer();
  }

  public connectToServer() {
    let URL = this.globalConstants.nodeServerURL;
    console.log(`will connect to node server: ${URL}`)
    this.messages = <Subject<Message>>this.connectToWebsocket(this.globalConstants.nodeServerURL).pipe(
    map(
          (response: MessageEvent): Message => {
              //console.log(`node-server: ${response.data}`);
              let data = JSON.parse(response.data)
              return data;
          }
      )
    );
    return this.messages;
  }

  public connectToWebsocket(url:string): AnonymousSubject<MessageEvent> {
    if (!this.subject) {
      this.subject = this.create(url);
    }
    return this.subject;
  }

  private create(url:string): AnonymousSubject<MessageEvent> {
      let ws = new WebSocket(url);
      let observable = new Observable((obs: Observer<MessageEvent>) => {
          ws.onopen = (e) => {
            this.connectionState = WSServerStatus.CONNECTED;
            console.log("Connected to node-server: " + url);
            let msg = {'data': JSON.stringify(statusConnected)};
            obs.next(new MessageEvent('message', msg));
          }
          ws.onmessage = (msg) => {
            //console.log("received: " + msg.data);
            let d = JSON.parse(msg.data);
            //console.log(d);
            if (d.type == 'videofps' && d.synchronous == true) {
              const requestSubject = this.pendingRequests.get(d.correlationId);
              if (requestSubject) {
                  requestSubject.next(d);
                  requestSubject.complete();
                  this.pendingRequests.delete(d.correlationId);
              }
            } else {
              /*if (d.type !== 'videofps') {
                console.log('message from node-server');
              }*/
              obs.next(msg);
            }
          };
          ws.onerror = (e) => {
            console.log('Error with node-server');
            obs.error(obs);
          };
          ws.onclose = (e) => {
            console.log('Disconnected from node-server');
            this.connectionState = WSServerStatus.DISCONNECTED;
            this.subject = undefined
            return obs.complete.bind(obs);
          };
          return ws.close.bind(ws);
      });
      let observer : Observer<MessageEvent> = {
          error: (err: any) => {},
          complete: () => {},
          next: (data: Object) => {
              if (ws.readyState === WebSocket.OPEN) {
                let strObj = JSON.stringify(data);
                ws.send(strObj);
                /*if (!strObj.includes('videofps')) {
                  console.log('Sent to node-server: ', data);
                }*/
              }
          }
      };
      return new AnonymousSubject<MessageEvent>(observer, observable);
  }

  private pendingRequests: Map<string, Subject<FPSResponse>> = new Map();
   

  public sendMessageAndWait(message: any): Observable<FPSResponse> {
      const responseObservable = new Subject<FPSResponse>();
      const correlationId = this.generateCorrelationId();
      message.correlationId = correlationId;
      this.pendingRequests.set(correlationId, responseObservable);

      this.messages.next(message);

      return responseObservable.asObservable();
  }

  private generateCorrelationId(): string {
      // Generate a unique ID
      return Math.random().toString(36).substring(2, 15);
  }
}
