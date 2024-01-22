import { ViewChild,ElementRef,AfterViewInit, Component } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { VBSServerConnectionService, GUIAction, GUIActionType, VbsServiceCommunication } from '../vbsserver-connection.service';
import { NodeServerConnectionService } from '../nodeserver-connection.service';
import { ClipServerConnectionService } from '../clipserver-connection.service';
import { formatAsTime, getTimestampInSeconds, GlobalConstants, WSServerStatus } from '../global-constants';
import { mdiConsoleLine } from '@mdi/js';
import { QueryEvent, QueryEventCategory } from 'openapi/dres';
import { Title } from '@angular/platform-browser';
import { MessageBarComponent } from '../message-bar/message-bar.component';
import { Subscription } from 'rxjs';


const regExpBase = new RegExp('^\\d+$'); //i for case-insensitive (not important in this example anyway)


@Component({
  selector: 'app-shotlist',
  templateUrl: './shotlist.component.html',
  styleUrls: ['./shotlist.component.scss']
})

export class ShotlistComponent implements AfterViewInit,VbsServiceCommunication {
  videoid: string | undefined;
  framenumber: string | undefined;
  videoURL: string = ''
  keyframes: Array<string> = [];
  timelabels: Array<string> = [];
  framenumbers: Array<string> = [];

  private dresErrorMessageSubscription!: Subscription;
  private dresSuccessMessageSubscription!: Subscription;

  public statusTaskInfoText: string = ""; //property binding
  statusTaskRemainingTime: string = ""; //property binding

  keyframeBaseURL: string = '';
  videoBaseURL: string = '';
  datasetBase: string = '';
  fps = 0.0;
  vduration = 0;
  vdescription = '';
  vchannel = '';
  vtitle = '';
  vuploaddate = '';
  vtags = [];
  vcategories = [];
  vtexts =[]; 
  vspeech: any | undefined;

  topicanswer: string = '';
  answerFieldHasFocus = false;

  showButtons = -1;

  currentVideoTime: number = 0;
  @ViewChild('videoplayer') videoplayer!: ElementRef<HTMLVideoElement>;
  @ViewChild(MessageBarComponent) messageBar!: MessageBarComponent;

  constructor(
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService, 
    private titleService: Title, 
    private route: ActivatedRoute,
    private router: Router
  ) {}
  
  ngOnInit() {
    console.log('shotlist component (slc) initiated');

    this.dresErrorMessageSubscription = this.vbsService.errorMessageEmitter.subscribe(msg => {
      this.messageBar.showErrorMessage(msg);
    })
    this.dresSuccessMessageSubscription = this.vbsService.successMessageEmitter.subscribe(msg => {
      this.messageBar.showSuccessMessage(msg);
    })

    let selectedEvaluation = localStorage.getItem('selectedEvaluation');
    if (selectedEvaluation) {
      console.log('selected evaluation is ' + selectedEvaluation);
      this.vbsService.selectedServerRun = parseInt(selectedEvaluation);
    }

    this.route.paramMap.subscribe(paraMap => {
      this.videoid = paraMap.get('id')?.toString();
      this.framenumber = paraMap.get('id2')?.toString();
      this.titleService.setTitle('v' + this.videoid);
      console.log(`slc: ${this.videoid} ${this.framenumber}`);
      if (regExpBase.test(this.videoid!) == true) {
        this.keyframeBaseURL = GlobalConstants.keyframeBaseURLV3C_Shots;
        this.videoBaseURL = GlobalConstants.videoURLV3C;
        this.datasetBase = 'keyframes'; //'thumbsXL';
      } else {
        this.keyframeBaseURL = GlobalConstants.keyframeBaseURLMarine_Shots;
        this.videoBaseURL = GlobalConstants.videoURLMarine;
        this.datasetBase = 'keyframes'; //'thumbsmXL';
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

    //repeatedly retrieve task info
    setInterval(() => {
      this.requestTaskInfo();
    }, 1000);
  }

  ngAfterViewInit(): void {
    this.videoplayer.nativeElement.addEventListener('loadeddata', this.onVideoPlayerLoaded.bind(this));
  }

  requestTaskInfo() {
    if (this.vbsService.serverRunIDs.length > 0 && this.vbsService.selectedServerRun === undefined) {
      this.vbsService.selectedServerRun = 0;
    }
    if (this.vbsService.selectedServerRun !== undefined) {
      this.vbsService.getClientTaskInfo(this.vbsService.serverRunIDs[this.vbsService.selectedServerRun], this);
    }
  }

  selectRun() {

  }

  getRemainingTaskTime() {
    if (this.vbsService.selectedServerRun !== undefined) {
      let remainingTime = this.vbsService.serverRunsRemainingSecs.get(this.vbsService.serverRunIDs[this.vbsService.selectedServerRun]);
      return remainingTime;
    }
    return "";
  }

  performFileSimilarityQuery(keyframe:string) {
    //this.router.navigate(['filesimilarity',keyframe,this.datasetBase]); //or navigateByUrl(`/video/${videoid}`)
    window.open('filesimilarity/' + encodeURIComponent(keyframe.replace('.jpg',GlobalConstants.replaceJPG_back2)) + '/' + encodeURIComponent(this.datasetBase), '_blank');
  }

  onVideoPlayerLoaded(event:any) {
    console.log('video player loaded');
    if (this.framenumber) {
      this.gotoTimeOfFrame(parseInt(this.framenumber));
    }
  }

  getQueryResultCSSClass(frame:string) {
    if (this.framenumber && this.framenumber === frame) {
      return 'selectedqueryresult';
    } else {
      return 'queryresult';
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
      this.vtexts = videoinfo['texts'];
      this.vspeech = videoinfo['speech'];
    }
    this.keyframes = [];
    this.framenumbers = [];
    this.timelabels = [];
    for (let i=0; i < videoinfo['shots'].length; i++) {
      let shotinfo = videoinfo['shots'][i];
      let kf = shotinfo['keyframe'];
      this.videoURL = this.videoBaseURL + '/' + this.videoid + '.mp4';
      this.keyframes.push(`${this.videoid}/${kf}`);
      let comps = kf.replace('.jpg','').split('_');
      let fnumber = comps[comps.length-1];
      this.framenumbers.push(fnumber);
      this.timelabels.push(formatAsTime(fnumber,this.fps));
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

  gotoTimeOfShot(idx:number) {
    console.log(`goto time of shot ${idx} (fps=${this.fps})`);
    this.videoplayer.nativeElement.currentTime = parseFloat(this.framenumbers[idx]) / this.fps;
    if (this.videoplayer.nativeElement.paused) {
      this.videoplayer.nativeElement.play();
    }
    window.scrollTo(0, 0);
  }

  gotoTimeOfFrame(frame:number) {
    console.log(`goto time of frame ${frame} (fps=${this.fps})`);
    this.videoplayer.nativeElement.currentTime = frame / this.fps;
  }

  onAnswerInputFocus() {
    this.answerFieldHasFocus = true;
  }

  onAnswerInputBlur() {
    this.answerFieldHasFocus = false
  }




  /****************************************************************************
   * Submission to VBS Server
   ****************************************************************************/

  submitCurrentTime() {
    console.log('submitting time: ' + this.currentVideoTime + ' for video ' + this.videoid!);
    this.vbsService.submitFrame(this.videoid!, Math.round(this.currentVideoTime), this.fps);

    let queryEvent:QueryEvent = {
      timestamp: getTimestampInSeconds(),
      category: QueryEventCategory.OTHER,
      type: 'submit',
      value: `videoid:${this.videoid} frame:${this.currentVideoTime}` 
    }
    this.vbsService.queryEvents.push(queryEvent);
    this.vbsService.submitQueryLog();
    this.vbsService.saveLogLocally();
  }

  submitResult(index: number) {
    console.log('selected rund: ' + this.vbsService.selectedServerRun);
    console.log('submitting frame: ' + this.framenumbers[index] + ' for video ' + this.videoid! + ' with fps=' + this.fps);
    this.vbsService.submitFrame(this.videoid!, parseInt(this.framenumbers[index]), this.fps);

    let queryEvent:QueryEvent = {
      timestamp: getTimestampInSeconds(),
      category: QueryEventCategory.OTHER,
      type: 'submit',
      value: `videoid:${this.videoid} freame:${this.framenumbers[index]}` 
    }
    this.vbsService.queryEvents.push(queryEvent);
    this.vbsService.submitQueryLog();
    this.vbsService.saveLogLocally();
  }

  sendTopicAnswer() {
    this.vbsService.submitText(this.topicanswer)

    let queryEvent:QueryEvent = {
      timestamp: getTimestampInSeconds(),
      category: QueryEventCategory.OTHER,
      type: 'submitanswer',
      value: `result:${this.topicanswer}` 
    }
    this.vbsService.queryEvents.push(queryEvent);
    this.vbsService.submitQueryLog();

    //interaction logging
    let GUIaction: GUIAction = {
      timestamp: getTimestampInSeconds(), 
      actionType: GUIActionType.SUBMITANSWER,
      info: this.topicanswer
    }
    this.vbsService.interactionLog.push(GUIaction);

    //save and reset logs
    //this.vbsService.saveLogLocallyAndClear();
  }

}


