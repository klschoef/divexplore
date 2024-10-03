import { ViewChild, ElementRef, AfterViewInit, Component } from '@angular/core';
import { ViewChildren, QueryList } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { VBSServerConnectionService } from '../../services/vbsserver-connection/vbsserver-connection.service';
import { VbsServiceCommunication } from '../../shared/interfaces/vbs-task-interface';
import { NodeServerConnectionService } from '../../services/nodeserver-connection/nodeserver-connection.service';
import { ClipServerConnectionService } from '../../services/clipserver-connection/clipserver-connection.service';
import { formatAsTime, GlobalConstants, WSServerStatus } from '../../shared/config/global-constants';
import { ApiClientAnswer, QueryEvent, QueryEventCategory, RankedAnswer } from 'openapi/dres';
import { Title } from '@angular/platform-browser';
import { MessageBarComponent } from '../message-bar/message-bar.component';
import { Subscription } from 'rxjs';
import { GlobalConstantsService } from '../../shared/config/services/global-constants.service';

export interface QueryType {
  type: string;
  query: string;
  videofiltering: string;
  maxresults: number;
  resultsperpage: number;
  selectedpage: string;
  dataset: string;
}

@Component({
  selector: 'app-shotlist',
  templateUrl: './shotlist.component.html',
  styleUrls: ['./shotlist.component.scss']
})

export class ShotlistComponent implements AfterViewInit, VbsServiceCommunication {
  videoid: string | undefined;
  framenumber: string | undefined;
  videoURL: string = ''
  keyframes: Array<string> = [];
  timelabels: Array<string> = [];
  framenumbers: Array<string> = [];
  revertKeyframes: Array<string> = [];

  selectedDataset: string = '';
  selectedVideoFiltering: string = '';
  selectedQueryType: string = '';
  queryinput: string = '';
  nodeServerInfo: string | undefined;
  queryBaseURL: string = '';
  queryTimestamp: number = 0;
  deletedKeyFrames: any[] = [];

  private dresErrorMessageSubscription!: Subscription;
  private dresSuccessMessageSubscription!: Subscription;

  public statusTaskInfoText: string = ""; //property binding
  statusTaskRemainingTime: string = ""; //property binding

  imgWidth = this.globalConstants.imageWidth;
  imgHeight = this.globalConstants.imageWidth / GlobalConstants.imgRatio;

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
  vtexts = [];
  vspeech: any | undefined;

  topicanswer: string = '';
  answerFieldHasFocus = false;
  showVideoBox = true;

  showButtons = -1;

  currentVideoTime: number = 0;
  @ViewChild('videoplayer') videoplayer!: ElementRef<HTMLVideoElement>;
  @ViewChild(MessageBarComponent) messageBar!: MessageBarComponent;
  @ViewChildren('queryResult') queryResults!: QueryList<ElementRef>;

  constructor(
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService,
    private titleService: Title,
    private route: ActivatedRoute,
    private router: Router,
    private globalConstants: GlobalConstantsService
  ) { }

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
      this.keyframeBaseURL = this.globalConstants.thumbsBaseURL; //GlobalConstants.thumbsBaseURL;
      this.videoBaseURL = this.globalConstants.videosBaseURL; //GlobalConstants.videosBaseURL;
      this.datasetBase = 'keyframes'; //'thumbsXL';

    });

    //already connected?
    if (this.nodeService.connectionState == WSServerStatus.CONNECTED) {
      this.requestDataFromDB();
    }
    this.nodeService.messages.subscribe(msg => {
      let m = JSON.parse(JSON.stringify(msg));
      //console.log(`slc: response from node service: ${msg}`)
      if ('wsstatus' in msg) {
        //console.log('slc: node-service: connected');
        this.requestDataFromDB();
      } else {
        if ("scores" in msg || m.type === 'ocr-text') {
          console.log("slc: response from node-service: ");
          console.log(msg);

          let result = m.results;
          let validResults = [];

          //TODO: Don't send full new query but use -v
          for (let i = 0; i < result.length; i++) {
            if (result[i].startsWith(this.videoid!)) {
              validResults.push(result[i]);
            }
          }

          let queryResults = this.queryResults.toArray();

          for (let i = 0; i < queryResults.length; i++) {
            let currentResults = queryResults[i].nativeElement.firstElementChild?.getAttribute('src');
            let currentResultsVideoid = currentResults?.split("/").slice(-2).join("/");

            if (!validResults.includes(currentResultsVideoid!)) {
              this.deletedKeyFrames.push({
                element: queryResults[i].nativeElement,
                parent: queryResults[i].nativeElement.parentNode,
                index: i
              });
              queryResults[i].nativeElement.remove();
            }
          }
        } else {
          let result = msg.content;
          //console.log("slc: response from node-service: " + result[0]);
          this.loadVideoShots(result[0]);
        }
      }
    });

    this.clipService.messages.subscribe(msg => {
      if ('wsstatus' in msg) {
        console.log('qc: CLIP-notification: connected');
      } else {
        console.log("qc: response from clip-server: " + msg);
        //this.handleQueryResponseMessage(msg);
      }
    });

    //repeatedly retrieve task info
    setInterval(() => {
      this.requestTaskInfo();
    }, 1000);
  }


  undoQueryAction() {
    // Sort deleted keyframes by the stored index to restore them in the correct order
    this.deletedKeyFrames.sort((a, b) => a.index - b.index);

    // Iterate through all deleted keyframes and restore them
    while (this.deletedKeyFrames.length > 0) {
      let lastDeleted = this.deletedKeyFrames.shift(); // Get the first deleted keyframe (since sorted by index)

      // Ensure the parent exists and insert the element at its original position
      if (lastDeleted.parent) {
        let parentElement = lastDeleted.parent;

        // If the index is valid, re-insert the element at the correct position
        if (parentElement.children.length >= lastDeleted.index) {
          let referenceNode = parentElement.children[lastDeleted.index];
          parentElement.insertBefore(lastDeleted.element, referenceNode);
        } else {
          // If the index is out of bounds, append it at the end of the parent
          parentElement.appendChild(lastDeleted.element);
        }
      }
    }
  }

  ngAfterViewInit(): void {
    this.videoplayer.nativeElement.addEventListener('loadeddata', this.onVideoPlayerLoaded.bind(this));
    this.queryResults.changes.subscribe((list: QueryList<ElementRef>) => {
      this.scrollToSelectedQueryResult();
    });
  }

  scrollToSelectedQueryResult() {
    const selectedElement = this.queryResults.toArray().find(el => el.nativeElement.classList.contains('selectedqueryresult'));
    if (selectedElement) {
      const elementPosition = selectedElement.nativeElement.getBoundingClientRect().top + window.scrollY;
      const offset = 50; // Adjust this value as needed
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
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

  classifyVideoId(videoId: string) {
    const patternFiveNumbers = /^\d{5}$/;
    const patternLHE = /^LHE\d{2}$/;
    const patternThreeUnderscores = /^[^\s_]+(_[^\s_]+){2}$/;

    if (patternFiveNumbers.test(videoId)) {
      return 'v3c';
    } else if (patternLHE.test(videoId)) {
      return 'lhe';
    } else if (patternThreeUnderscores.test(videoId)) {
      return 'mvk';
    } else {
      return 'unknown';
    }
  }

  performFileSimilarityQuery(keyframe: string) {
    //this.router.navigate(['filesimilarity',keyframe,this.datasetBase]); //or navigateByUrl(`/video/${videoid}`)
    let dataset = this.classifyVideoId(this.videoid!);
    //console.log(this.videoid + " --> " + dataset);
    window.open('filesimilarity/' + encodeURIComponent(keyframe.replace('.jpg', GlobalConstants.replaceJPG_back2)) + '/' + dataset + '/' + encodeURIComponent(this.datasetBase), '_blank');
  }

  onVideoPlayerLoaded(event: any) {
    console.log('video player loaded');
    if (this.framenumber) {
      this.gotoTimeOfFrame(parseInt(this.framenumber));
    }
  }

  getQueryResultCSSClass(frame: string) {
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

  asTimeLabel(frame: string, withFrames: boolean = true) {
    return formatAsTime(frame, this.fps, withFrames);
  }

  requestDataFromDB() {
    console.log('slc: sending request to node-server');
    this.requestVideoShots(this.videoid!);
  }

  sendToNodeServer(msg: any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.nodeService.messages.next(message);
  }

  requestVideoShots(videoid: string) {
    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
      console.log('slc: get video info from database', videoid);
      let msg = {
        type: "videoinfo",
        videoid: videoid
      };
      this.sendToNodeServer(msg);
    } else {
      alert(`Node.js connection down: ${this.nodeService.connectionState}. Try reconnecting by pressing the red button!`);
    }
  }

  loadVideoShots(videoinfo: any) {
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

    let logResults: Array<RankedAnswer> = [];
    for (let i = 0; i < videoinfo['shots'].length; i++) {
      let shotinfo = videoinfo['shots'][i];
      let kf = shotinfo['keyframe'];
      this.videoURL = this.videoBaseURL + '/' + this.videoid + '.mp4';
      this.keyframes.push(`${this.videoid}/${kf}`);
      let comps = kf.replace('.jpg', '').split('_');
      let fnumber = comps[comps.length - 1];
      this.framenumbers.push(fnumber);
      this.timelabels.push(formatAsTime(fnumber, this.fps));

      let logAnswer: ApiClientAnswer = {
        text: undefined,
        mediaItemName: this.videoid,
        mediaItemCollectionName: '',
        start: fnumber, // / this.fps * 1000, 
        end: fnumber, // / this.fps * 1000
      }
      let logResult: RankedAnswer = {
        answer: logAnswer,
        rank: (i + 1)
      }
      logResults.push(logResult)
    }

    this.revertKeyframes = this.keyframes;

    this.vbsService.queryResults = logResults;
    this.vbsService.submitQueryResultLog('shotlist');
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

  hideVideoBox() {
    this.showVideoBox = false;
  }

  setCurrentTime(data: any) {
    this.currentVideoTime = data.target.currentTime * this.fps;
  }

  gotoTimeOfShot(idx: number) {
    this.showVideoBox = true;
    console.log(`goto time of shot ${idx} (fps=${this.fps})`);
    this.videoplayer.nativeElement.currentTime = parseFloat(this.framenumbers[idx]) / this.fps;
    if (this.videoplayer.nativeElement.paused) {
      this.videoplayer.nativeElement.play();
    }
  }

  gotoTimeOfFrame(frame: number) {
    console.log(`goto time of frame ${frame} (fps=${this.fps})`);
    this.videoplayer.nativeElement.currentTime = frame / this.fps;
  }

  onAnswerInputFocus() {
    this.answerFieldHasFocus = true;
  }

  onAnswerInputBlur() {
    this.answerFieldHasFocus = false
  }

  /* *************************************************************************
   * Query Logic
   * *************************************************************************/

  performNewTextQuery() {
    let qi = this.queryinput.trim();

    if (qi === '') {
      return;
    }

    let querySubmission = this.queryinput;

    if (this.clipService.connectionState === WSServerStatus.CONNECTED ||
      this.nodeService.connectionState === WSServerStatus.CONNECTED) {

      this.nodeServerInfo = "processing query, please wait...";

      console.log('qc: query for', querySubmission + " and " + this.selectedQueryType);
      this.queryBaseURL = this.getBaseURL();
      let msg = {
        type: "textquery",
        clientId: "direct",
        query: querySubmission,
        maxresults: 1000,
        resultsperpage: 1000,
        selectedpage: '1',
        dataset: this.selectedDataset,
        videofiltering: this.selectedVideoFiltering
      };
      //this.previousQuery = msg;

      msg.dataset = this.selectedDataset;
      msg.type = this.selectedQueryType;
      msg.videofiltering = this.selectedVideoFiltering;

      this.queryTimestamp = this.getTimestampInSeconds();

      if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
        console.log('qc: send to node-server: ' + msg);
        this.sendToNodeServer(msg);
      } else {
        this.sendToCLIPServer(msg);
      }
      //query event logging
      let queryEvent: QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.TEXT,
        type: this.selectedQueryType,
        value: querySubmission
      }
      this.vbsService.queryEvents.push(queryEvent);


    } else {
      alert(`CLIP connection down: ${this.clipService.connectionState}. Try reconnecting by pressing the red button!`);
    }
  }

  getTimestampInSeconds() {
    return Math.floor(Date.now() / 1000);
  }

  getBaseURL() {
    return this.globalConstants.thumbsBaseURL;
  }

  resetPageAndPerformQuery() {
    this.vbsService.queryResults = [];
    this.vbsService.queryEvents = [];
    this.performNewTextQuery();
  }

  getQueryTypes() {
    return [
      { id: 'textquery', name: 'Free-Text' },
      { id: 'ocr-text', name: 'OCR-Text' },
      { id: 'speech', name: 'Speech' }
    ];
  }

  sendToCLIPServer(msg: any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.clipService.messages.next(message);
    this.queryTimestamp = this.getTimestampInSeconds();
  }

  /****************************************************************************
   * Submission to VBS Server
   ****************************************************************************/

  submitCurrentTime() {
    let currentDataSet = this.classifyVideoId(this.videoid!);
    console.log('submitting time: ' + this.currentVideoTime + ' for video ' + this.videoid! + ' with fps=' + this.fps + " and dataset " + currentDataSet);
    this.vbsService.submitFrame(this.videoid!, Math.round(this.currentVideoTime), this.fps, this.vduration, currentDataSet);

    //query event logging
    let queryEvent: QueryEvent = {
      timestamp: Date.now(),
      category: QueryEventCategory.OTHER,
      type: 'submitTime',
      value: this.videoid! + ',' + this.currentVideoTime
    }
    this.vbsService.queryEvents.push(queryEvent);
    this.vbsService.submitQueryResultLog('interaction');
  }

  submitResult(index: number) {
    let currentDataSet = this.classifyVideoId(this.videoid!);
    console.log('submitting frame: ' + this.framenumbers[index] + ' for video ' + this.videoid! + ' with fps=' + this.fps + " and dataset " + currentDataSet);
    this.vbsService.submitFrame(this.videoid!, parseInt(this.framenumbers[index]), this.fps, this.vduration, currentDataSet);

    //query event logging
    let queryEvent: QueryEvent = {
      timestamp: Date.now(),
      category: QueryEventCategory.OTHER,
      type: 'submitShot',
      value: this.videoid! + ',' + index + ',' + this.framenumbers[index]
    }
    this.vbsService.queryEvents.push(queryEvent);
    this.vbsService.submitQueryResultLog('interaction');
  }

  sendTopicAnswer() {
    console.log('submitting text: ' + this.topicanswer);
    this.vbsService.submitText(this.topicanswer)

    //query event logging
    let queryEvent: QueryEvent = {
      timestamp: Date.now(),
      category: QueryEventCategory.OTHER,
      type: "submitAnswer2",
      value: this.topicanswer
    }
    this.vbsService.queryEvents.push(queryEvent);
    this.vbsService.submitQueryResultLog('interaction');
  }

}


