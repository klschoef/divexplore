import { Injectable } from '@angular/core';
import { WSServerStatus,GlobalConstants } from "./global-constants";
import { Observable, Observer } from 'rxjs';
import { AnonymousSubject } from 'rxjs/internal/Subject';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators';


const URL = GlobalConstants.nodeServerURL;
let statusConnected = {'wsstatus':'connected'};

export interface Message {
    source: string;
    content: any;
}

@Injectable({
  providedIn: 'root'
})
export class NodeServerConnectionService {

  private subject: AnonymousSubject<MessageEvent> | undefined;
  public messages: Subject<Message>;

  public connectionState: WSServerStatus = WSServerStatus.UNSET;;

  constructor() {
    console.log('NodeServerConnectionService created');
    this.messages = this.connectToServer();
  }

  public connectToServer() {
    console.log(`will connect to node server: ${URL}`)
    this.messages = <Subject<Message>>this.connectToWebsocket(URL).pipe(
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
            console.log('message from node-server');
            obs.next(msg);
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
                  ws.send(JSON.stringify(data));
                  console.log('Sent to node-server: ', data);
              }
          }
      };
      return new AnonymousSubject<MessageEvent>(observer, observable);
  }
}
