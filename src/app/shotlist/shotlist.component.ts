import { ViewChild,ElementRef,AfterViewInit, Component } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { VBSServerConnectionService } from '../vbsserver-connection.service';
import { NodeServerConnectionService } from '../nodeserver-connection.service';
import { ClipServerConnectionService } from '../clipserver-connection.service';
import { formatAsTime, GlobalConstants, WSServerStatus } from '../global-constants';
import { mdiConsoleLine } from '@mdi/js';


const regExpBase = new RegExp('^\\d+$'); //i for case-insensitive (not important in this example anyway)


@Component({
  selector: 'app-shotlist',
  templateUrl: './shotlist.component.html',
  styleUrls: ['./shotlist.component.scss']
})

export class ShotlistComponent implements AfterViewInit {
  videoid: string | undefined;
  shotidx: string | undefined;
  videoURL: string = ''
  keyframes: Array<string> = [];
  timelabels: Array<string> = [];
  framenumbers: Array<string> = [];

  keyframeBaseURL: string = '';
  videoBaseURL: string = '';
  fps = 0.0;
  vduration = 0;
  vdescription = '';
  vchannel = '';
  vtitle = '';
  vuploaddate = '';
  vtags = [];
  vcategories = [];

  currentVideoTime: number = 0;
  @ViewChild('videoplayer') videoplayer!: ElementRef<HTMLVideoElement>;

  constructor(
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService, 
    private route: ActivatedRoute,
  ) {}
  
  ngOnInit() {
    console.log('shotlist component (slc) initiated');
    this.route.paramMap.subscribe(paraMap => {
      this.videoid = paraMap.get('id')?.toString();
      this.shotidx = paraMap.get('id2')?.toString();
      console.log(`slc: ${this.videoid} ${this.shotidx}`);
      if (regExpBase.test(this.videoid!) == true) {
        this.keyframeBaseURL = GlobalConstants.keyframeBaseURLV3C_Shots;
        this.videoBaseURL = GlobalConstants.videoURLV3C;
      } else {
        this.keyframeBaseURL = GlobalConstants.keyframeBaseURLMarine_Shots;
        this.videoBaseURL = GlobalConstants.videoURLMarine;
      }

    });

    //already connected?
    if (this.nodeService.connectionState == WSServerStatus.CONNECTED) {
      this.requestDataFromDB();
    }
    this.nodeService.messages.subscribe(msg => {
      console.log(`slc: response from node service: ${msg}`)
      if ('wsstatus' in msg) { 
        console.log('slc: node-service: connected');
        this.requestDataFromDB();
      } else {
        let result = msg.content;
        console.log("slc: response from node-service: " + result[0]);
        this.loadVideoShots(result[0]);
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.shotidx) {
      this.videoplayer.nativeElement.currentTime = parseFloat(this.framenumbers[parseInt(this.shotidx)]) / this.fps;
    }
  }

  hasMetadata(): boolean {
    if (this.vduration !== 0) {
      return true;
    } else {
      return false;
    }
  }

  asTimeLabel(frame:string, withFrames:boolean=true) {
    return formatAsTime(frame, this.fps, withFrames);
  }

  requestDataFromDB() {
    console.log('slc: sending request to node-server');
    this.requestVideoShots(this.videoid!);
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
      console.log('slc: get video info from database', videoid);
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
    console.log(videoinfo);
    this.fps = parseFloat(videoinfo['fps']);
    if ('duration' in videoinfo) {
      this.vduration = videoinfo['duration'];
      this.vdescription = videoinfo['description'];
      this.vtitle = videoinfo['title'];
      this.vuploaddate = videoinfo['uploaddate'];
      this.vchannel = videoinfo['channel'];
      this.vtags = videoinfo['tags'];
      this.vcategories = videoinfo['categories'];
    }
    this.keyframes = [];
    this.framenumbers = [];
    this.timelabels = [];
    for (let i=0; i < videoinfo['shots'].length; i++) {
      let shotinfo = videoinfo['shots'][i];
      let kf = shotinfo['keyframe'];
      this.videoURL = this.videoBaseURL + '/' + this.videoid + '.mp4';
      this.keyframes.push(`${this.keyframeBaseURL}/${this.videoid}/${kf}`);
      let comps = kf.replace('.jpg','').split('_');
      let fnumber = comps[comps.length-1];
      this.framenumbers.push(fnumber);
      this.timelabels.push(formatAsTime(fnumber,this.fps));
    }

    //shot passed?
    if (this.shotidx) {
      
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

  setCurrentTime(data:any) {
    this.currentVideoTime = data.target.currentTime * this.fps;
  }


  /****************************************************************************
   * Submission to VBS Server
   ****************************************************************************/

  submitCurrentTime() {
    this.vbsService.submitFrame(this.videoid!, Math.round(this.currentVideoTime));
  }

  submitResult(index: number) {
    this.vbsService.submitFrame(this.videoid!, parseInt(this.framenumbers[index]));
  }


}


