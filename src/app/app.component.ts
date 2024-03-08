import { ViewChild,ElementRef,Component, AfterViewInit } from '@angular/core';
import { HostListener } from '@angular/core';
import { GlobalConstants, WSServerStatus, WebSocketEvent } from './shared/config/global-constants';
import { VBSServerConnectionService } from './services/vbsserver-connection/vbsserver-connection.service';
import { NodeServerConnectionService } from './services/nodeserver-connection/nodeserver-connection.service';
import { ClipServerConnectionService } from './services/clipserver-connection/clipserver-connection.service';
import { Router } from '@angular/router';



@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})


export class AppComponent implements AfterViewInit {
    
  constructor(
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService,
    private router: Router) {
      this.nodeService.messages.subscribe(msg => {
        if ('wsstatus' in msg) { 
          console.log('node-notification: connected');
        } else {
          let result = msg.content;
          console.log("Response from node-server: " + result[0]);
          console.log(result[0]['shots']);
        }
      });
  }

  
  ngOnInit() {
  }

  ngAfterViewInit(): void {
  }

   /****************************************************************************
   * Queries
   ****************************************************************************/

  sendToNodeServer(msg:any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.nodeService.messages.next(message);
  }


  /****************************************************************************
   * WebSockets (CLIP and Node.js)
   ****************************************************************************/

  handleNodeMessage(msg:any) {

  }

  connectToVBSServer() {
    this.vbsService.connect();
  }

  disconnectFromVBSServer() {
    this.vbsService.logout(this);
  }

  checkNodeConnection() {
    if (this.nodeService.connectionState !== WSServerStatus.CONNECTED) {
      this.nodeService.connectToServer();
    }
  }

  checkCLIPConnection() {
    if (this.clipService.connectionState !== WSServerStatus.CONNECTED) {
      this.clipService.connectToServer();
    }
  }

  checkVBSServerConnection() {
    if (this.vbsService.vbsServerState == WSServerStatus.UNSET || this.vbsService.vbsServerState == WSServerStatus.DISCONNECTED) {
      this.connectToVBSServer();
    } else if (this.vbsService.vbsServerState == WSServerStatus.CONNECTED) {
      this.disconnectFromVBSServer();
    } 
  }

  /****************************************************************************
   * Submission to VBS Server
   ****************************************************************************/

}

