import { Injectable } from '@angular/core';
import { WSServerStatus,GlobalConstants } from "./global-constants";
import { Observable, Observer } from 'rxjs';
import { AnonymousSubject } from 'rxjs/internal/Subject';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators';


const URL = GlobalConstants.nodeServerURL;

export interface Message {
    source: string;
    content: string;
}

@Injectable({
  providedIn: 'root'
})
export class NodeServerConnectionService {

  private subject: AnonymousSubject<MessageEvent> | undefined;
  public messages: Subject<Message>;

  public connectionState: WSServerStatus = WSServerStatus.UNSET;

  constructor() {
    console.log('NodeServerConnectionService created');
    this.messages = <Subject<Message>>this.connect(URL).pipe(
      map(
            (response: MessageEvent): Message => {
                console.log(`node-server: ${response.data}`);
                let data = JSON.parse(response.data)
                return data;
            }
        )
      );
  }

  public connectToServer() {
    this.messages = <Subject<Message>>this.connect(URL).pipe(
    map(
          (response: MessageEvent): Message => {
              console.log(`node-server: ${response.data}`);
              let data = JSON.parse(response.data)
              return data;
          }
      )
    );
    return this.messages;
  }

  public connect(url:string): AnonymousSubject<MessageEvent> {
      if (!this.subject) {
          this.subject = this.create(url);
          this.connectionState = WSServerStatus.CONNECTED;
          console.log("Connected to node-server: " + url);
      }
      return this.subject;
  }

  private create(url:string): AnonymousSubject<MessageEvent> {
      let ws = new WebSocket(url);
      let observable = new Observable((obs: Observer<MessageEvent>) => {
          ws.onmessage = (e) => {
            console.log('message from node-server');
            obs.next.bind(obs);
          };
          ws.onerror = (e) => {
            console.log('Error with node-server');
            obs.error.bind(obs);
          };
          ws.onclose = (e) => {
            console.log('Disconnected from node-server');
            this.connectionState = WSServerStatus.DISCONNECTED;
            obs.complete.bind(obs);
          };
          return ws.close.bind(ws);
      });
      let observer : Observer<MessageEvent> = {
          error: (err: any) => {},
          complete: () => {},
          next: (data: Object) => {
              console.log('Sent to node-server: ', data);
              if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(data));
              }
          }
      };
      return new AnonymousSubject<MessageEvent>(observer, observable);
  }
}
