import { Component } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { VBSServerConnectionService } from '../vbsserver-connection.service';
import { NodeServerConnectionService } from '../nodeserver-connection.service';
import { ClipServerConnectionService } from '../clipserver-connection.service';
import { GlobalConstants, WSServerStatus } from '../global-constants';

@Component({
  selector: 'app-shotlist',
  templateUrl: './shotlist.component.html',
  styleUrls: ['./shotlist.component.scss']
})

export class ShotlistComponent {
  videoid: string | undefined;
  videoURL: string = ''
  keyframes: Array<string> = [];

  constructor(
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService, 
    private route: ActivatedRoute,
  ) {
    this.nodeService.messages.subscribe(msg => {
      let result = msg.content;
      console.log("Response from node-server: " + result[0]);
      this.loadVideoShots(result[0]);
    });
  }

  ngOnInit() {
    console.log('shot list initiated');
    this.route.paramMap.subscribe(paraMap => {
      this.videoid = paraMap.get('id')?.toString();
      console.log(this.videoid);
      this.requestVideoShots(this.videoid!);
    });
  }

  getBaseURLFromKey(selDat: string) {
    if (selDat == 'marine-v') {
      return GlobalConstants.keyframeBaseURLMarine_SummariesXL; 
    }
    else if (selDat == 'v3c-v') {
      return GlobalConstants.keyframeBaseURLV3C_SummariesXL; 
    }
    if (selDat == 'marine-s') {
      return GlobalConstants.keyframeBaseURLMarine_Shots; 
    }
    else if (selDat == 'v3c-s') {
      return GlobalConstants.keyframeBaseURLV3C_Shots;
    }
    else 
    return '';
  }

  getBaseURL() {
    return this.getBaseURLFromKey('v3c-s');
  }

  sendToNodeServer(msg:any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.nodeService.messages.next(message);
  }

  requestVideoShots(videoid:string) {
    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
      console.log('get video info from database', videoid);
      let msg = { 
        type: "videoinfo", 
        videoid: videoid
      };
      //this.nodeSocketWorker.postMessage({ event: WebSocketEvent.MESSAGE, content: msg });
      this.sendToNodeServer(msg);
    } else {
      alert(`Node.js connection down: ${this.nodeService.connectionState}. Try reconnecting by pressing the red button!`);
    }
  }

  loadVideoShots(videoinfo:any) {
    console.log(videoinfo['shots']);
    for (let i=0; i < videoinfo['shots'].length; i++) {
      let shotinfo = videoinfo['shots'][i];
      let kf = shotinfo['keyframe'];
      this.videoURL = GlobalConstants.videoURLV3C + '/' + this.videoid + '.mp4';
      this.keyframes.push(`${this.getBaseURL()}/${this.videoid}/${kf}`);
    }
  }


  connectToVBSServer() {
    this.vbsService.connect();
  }

  disconnectFromVBSServer() {
    //this.vbsService.logout(this);
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

  submitResult(index: number) {
    let keyframe = this.keyframes[index];
    let comps = keyframe.split('_');
    let frameNumber = comps[comps.length-1].split('.')[0]
    console.log(`${this.videoid} - ${keyframe} - ${frameNumber}`);
    this.vbsService.submitFrame(this.videoid!, parseInt(frameNumber));
  }


}


