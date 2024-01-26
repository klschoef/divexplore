import { ViewChild,ElementRef,Component, AfterViewInit } from '@angular/core';
import { HostListener } from '@angular/core';
import { GlobalConstants, WSServerStatus, WebSocketEvent, formatAsTime, QueryType, getTimestampInSeconds } from '../global-constants';
import { VBSServerConnectionService, GUIAction, GUIActionType, VbsServiceCommunication } from '../vbsserver-connection.service';
import { NodeServerConnectionService } from '../nodeserver-connection.service';
import { ClipServerConnectionService } from '../clipserver-connection.service';
import { Router,ActivatedRoute } from '@angular/router';
import { query } from '@angular/animations';
import { QueryEvent, QueryResultLog, QueryEventLog, QueryEventCategory, RankedAnswer, ApiClientAnswer } from 'openapi/dres';
import { Title } from '@angular/platform-browser';
import { MessageBarComponent } from '../message-bar/message-bar.component';
import { Subscription } from 'rxjs';
 


@Component({
  selector: 'app-query',
  templateUrl: './query.component.html',
  styleUrls: ['./query.component.scss']
})
export class QueryComponent implements AfterViewInit,VbsServiceCommunication {

  @ViewChild('inputfield') inputfield!: ElementRef<HTMLInputElement>;
  @ViewChild('historyDiv') historyDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('videopreview') videopreview!: ElementRef<HTMLDivElement>;
  @ViewChild(MessageBarComponent) messageBar!: MessageBarComponent;

  private dresErrorMessageSubscription!: Subscription;
  private dresSuccessMessageSubscription!: Subscription;
  
  file_sim_keyframe: string | undefined
  file_sim_pathPrefix: string | undefined
  file_sim_page: string = "1"
  
  nodeServerInfo: string | undefined;

  imgWidth = GlobalConstants.imgWidth;
  imgHeight = GlobalConstants.imgHeight;

  
  queryinput: string = '';
  topicanswer: string = '';
  queryresults: Array<string> = [];
  //: Array<number> = [];
  queryresult_resultnumber: Array<string> = [];
  queryresult_videoid: Array<string> = [];
  queryresult_frame: Array<string> = [];
  queryresult_videopreview: Array<string> = [];
  queryTimestamp: number = 0;
  queryType: string = '';
  metadata: any;
  summaries: Array<string> = [];
  selectedSummaryIdx = 0;

  
  public statusTaskInfoText: string = ""; //property binding
  statusTaskRemainingTime: string = ""; //property binding

  videopreviewimage: string = '';

  previousQuery : any | undefined;

  querydataset: string = '';
  queryBaseURL = this.getBaseURL();
  datasetBase: string = 'keyframes';
  keyframeBaseURL: string = '';
  
  maxresults = GlobalConstants.maxResultsToReturn; 
  totalReturnedResults = 0; //how many results did our query return in total?
  resultsPerPage = GlobalConstants.resultsPerPage; 
  selectedPage = '1'; //user-selected page
  pages = ['1']

  selectedItem = 0;
  showPreview = false;
  showHelpActive = false;
  
  thumbSize = 'small';
  selectedHistoryEntry: string | undefined
  queryFieldHasFocus = false;
  answerFieldHasFocus = false;
  showButtons = -1;

  selectedDataset =  'v3c'; //'v3c-s';
  datasets = [
    {id: 'v3c', name: 'V3C'},
    {id: 'mvk', name: 'MVK'},
    {id: 'lhe', name: 'LHE'}
  ];

  selectedQueryType = 'textquery';
  queryTypes = [
    {id: 'textquery', name: 'Free-Text'},
    {id: 'ocr-text', name: 'OCR-Text'},
    {id: 'metadata', name: 'Metadata'}, 
    {id: 'speech', name: 'Speech'},
    {id: 'videoid', name: 'VideoId'}
  ];
    
  constructor(
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService, 
    private titleService: Title, 
    private route: ActivatedRoute,
    private router: Router) {
  }

  
  ngOnInit() {
    console.log('query component (qc) initated');

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
      this.file_sim_keyframe = paraMap.get('id')?.toString();
      if (this.file_sim_keyframe) {
        console.log(`qc: ${this.file_sim_keyframe}`);
        this.titleService.setTitle(this.file_sim_keyframe.substring(this.file_sim_keyframe.indexOf('/') + 1));
      }
      this.file_sim_pathPrefix = paraMap.get('id2')?.toString();
      if (this.file_sim_pathPrefix) {
        console.log(`qc: ${this.file_sim_pathPrefix}`);
        this.selectedDataset = 'v3c';
        /*if (this.file_sim_pathPrefix === 'thumbsXL') {
          this.selectedDataset = 'v3c-s';
        } else if (this.file_sim_pathPrefix === 'thumbsmXL') {
          this.selectedDataset = 'marine-s';
        }*/
      }
      if (paraMap.get('page')) {
        this.file_sim_page = paraMap.get('page')!.toString();
        this.selectedPage = this.file_sim_page;
      }
    });

    //already connected?
    if (this.nodeService.connectionState == WSServerStatus.CONNECTED) {
      console.log('qc: node-service already connected');
    } else {
      console.log('qc: node-service not connected yet');
    }
    if (this.clipService.connectionState == WSServerStatus.CONNECTED) {
      console.log('qc: CLIP-service already connected');
      if (this.file_sim_keyframe && this.file_sim_pathPrefix) {
        this.sendFileSimilarityQuery(this.file_sim_keyframe, this.file_sim_pathPrefix);
      } else {
        this.performHistoryLastQuery();
      }
    } else {
      console.log('qc: CLIP-service not connected yet');
    }

    this.nodeService.messages.subscribe(msg => {
      this.nodeServerInfo = undefined; 

      if ('wsstatus' in msg) { 
        console.log('qc: node-notification: connected');
      } else {
        //let result = msg.content;
        let m = JSON.parse(JSON.stringify(msg));
        console.log("qc: response from node-server: " + msg);
        if ("scores" in msg || m.type === 'ocr-text') {
          this.handleQueryResponseMessage(msg); 
        } else {
          if ("type" in msg) {
            if (m.type == 'metadata') {
              this.metadata = m.results[0];
              //this.pages = ['1'];
              console.log('received metadata: ' + JSON.stringify(msg));
              if (this.metadata?.location) {
              }
            } else if (m.type === 'info'){
              console.log(m.message);
              this.nodeServerInfo = m.message;
            } else if (m.type === 'videosummaries') {
              this.summaries = msg.content[0]['summaries'];
              this.selectedSummaryIdx = Math.floor(this.summaries.length/2);
              this.displayVideoSummary();
            }
          } else {
            this.handleQueryResponseMessage(msg);
          } 
        }
      }
    });

    this.clipService.messages.subscribe(msg => {
      if ('wsstatus' in msg) { 
        console.log('qc: CLIP-notification: connected');
        if (this.file_sim_keyframe && this.file_sim_pathPrefix) {
          this.sendFileSimilarityQuery(this.file_sim_keyframe, this.file_sim_pathPrefix);
        }
      } else {
        console.log("qc: response from clip-server: " + msg);
        this.handleQueryResponseMessage(msg);
      }
    });

    //repeatedly retrieve task info
    setInterval(() => {
      this.requestTaskInfo();
    }, 1000);
  }

  ngOnDestroy() {
    this.dresErrorMessageSubscription.unsubscribe();
    this.dresSuccessMessageSubscription.unsubscribe();
  }
  
  ngAfterViewInit(): void {
    this.historyDiv.nativeElement.hidden = true;
  }
  
  private displayVideoSummary() {
    this.videopreviewimage = GlobalConstants.dataHost + '/' + this.summaries[this.selectedSummaryIdx];
    this.videopreview.nativeElement.style.display = 'block';
  }

  reloadComponent(): void {
    window.location.reload();
  }

  showHelp() {
    this.showHelpActive = !this.showHelpActive;
  }

  requestTaskInfo() {
    if (this.vbsService.serverRunIDs.length > 0 && this.vbsService.selectedServerRun === undefined) {
      this.vbsService.selectedServerRun = 0;
    }
    if (this.vbsService.selectedServerRun !== undefined) {
      this.vbsService.getClientTaskInfo(this.vbsService.serverRunIDs[this.vbsService.selectedServerRun], this);
    }
  }
  
  
  browseClusters() {
    this.router.navigate(['exploration']); 
  }

  toggleHistorySelect() {
    this.historyDiv.nativeElement.hidden = !this.historyDiv.nativeElement.hidden;
    /*if (!this.historyDiv.nativeElement.hidden) {
      this.historyDiv.nativeElement.focus();
    }*/
  }

  history() {
    let historyList = [];
    let hist = localStorage.getItem('history')
    if (hist) {
      let histj:[QueryType] = JSON.parse(hist);
      for (let i=0; i < histj.length; i++) {
        let ho = histj[i];
        historyList.push(`${ho.type}: ${ho.query} (${ho.dataset})`)
      }
    }
    return historyList; //JSON.parse(hist!);
  }

  saveToHistory(msg: QueryType) {
    if (msg.query === '') {
      return;
    }

    let hist = localStorage.getItem('history')
    if (hist) {
      let queryHistory:Array<QueryType> = JSON.parse(hist);
      let containedPos = -1;
      let i = 0;
      for (let qh of queryHistory) {
        if (qh.query === msg.query && qh.dataset === msg.dataset) {
          containedPos = i;
          break;
        }
        i++;
      }
      if (containedPos >= 0) {
        queryHistory.splice(containedPos,1);
        queryHistory.unshift(msg);
        localStorage.setItem('history', JSON.stringify(queryHistory));
      }
      else {
        queryHistory.unshift(msg);
        localStorage.setItem('history', JSON.stringify(queryHistory));
      }
    } else {
      let queryHistory:Array<QueryType> = [msg];
      localStorage.setItem('history', JSON.stringify(queryHistory));
    }
  }

  asTimeLabel(frame:string, withFrames:boolean=true) {
    console.log('TODO: need FPS in query component!')
    return frame;
    //return formatAsTime(frame, this.fps, withFrames);
  }

  @HostListener('document:keyup', ['$event'])
  handleKeyboardEventUp(event: KeyboardEvent) { 
    if (this.queryFieldHasFocus == false && this.answerFieldHasFocus == false) {
      if (this.queryFieldHasFocus == false) {
        if (event.key == 'q') {
          this.inputfield.nativeElement.select();
        }
        else if (event.key == 'e') {
          this.inputfield.nativeElement.focus();
        }  
        else if (event.key == 'v') {
          /*this.selectedPage = '1';
          this.selectedDataset = this.selectedDataset.replace('-s','-v');
          this.performTextQuery();*/
        }
        else if (event.key == 's') {
          /*this.selectedPage = '1';
          this.selectedDataset = this.selectedDataset.replace('-v','-s');
          this.performTextQuery();*/
        }
        else if (event.key == 'x') {
          //this.resetQuery();
        }
        else if (event.key == 'Escape') {
          this.closeVideoPreview();
        }
      }
    }
  }


  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) { 
    if (this.queryFieldHasFocus == false && this.answerFieldHasFocus == false) {
      if (event.key == 'ArrowRight' || event.key == 'Tab') {
        if (this.showPreview) {
          if (this.selectedItem < this.queryresult_videoid.length-1) {
            this.selectedItem += 1;
            this.showVideoPreview();
          }
          event.preventDefault(); 
        } else {
          this.nextPage();     
        }
      } else if (event.key == "ArrowLeft") {
        if (this.showPreview) {
          if (this.selectedItem > 0) {
            this.selectedItem -= 1;
            this.showVideoPreview();
          }
          event.preventDefault(); 
        } else {
          this.prevPage();     
        }
      } else if (event.key == "ArrowUp") {
        if (this.selectedSummaryIdx > 0) {
          this.selectedSummaryIdx -= 1;
          this.displayVideoSummary();
        }
        event.preventDefault();
      } else if (event.key == "ArrowDown") {
        if (this.selectedSummaryIdx < this.summaries.length-1) {
          this.selectedSummaryIdx += 1;
          this.displayVideoSummary();
        }
        event.preventDefault();
      } else if (event.key == 'Space' || event.key == ' ') {
        this.showPreview = !this.showPreview;
        if (this.showPreview)
          this.showVideoPreview();
        event.preventDefault();
      } else if (event.key === 'v' && this.showPreview) {
        this.showVideoShots(this.queryresult_videoid[this.selectedSummaryIdx],'1');
      } 
      else {
        switch (event.key) {
          case '1':
            this.gotoPage('1');
            break;
          case '2':
            this.gotoPage('2');
            break;
          case '3':
            this.gotoPage('3');
            break;
          case '4':
            this.gotoPage('4');
            break;
          case '5':
            this.gotoPage('5');
            break;
          case '6':
            this.gotoPage('6');
            break;
          case '7':
            this.gotoPage('7');
            break;
          case '8':
            this.gotoPage('8');
            break;
          case '9':
            this.gotoPage('9');
            break;
          case '0':
            this.gotoPage('10');
            break;
          default:
            break;
        }
      }
    }
  }

  prevPage() {
    let currPage = parseInt(this.selectedPage);
    if (currPage > 1) {
      this.selectedPage = (currPage - 1).toString();
      this.performQuery();
    }
  }

  nextPage() {
    let currPage = parseInt(this.selectedPage);
    if (currPage < this.pages.length) {
      this.selectedPage = (currPage + 1).toString();
      this.performQuery();
    }
  }

  gotoPage(pnum:string) {
    let testPage = parseInt(pnum);
    if (testPage < this.pages.length && testPage > 0) {
      this.selectedPage = pnum;
      this.performQuery();
    }
  }

  getBaseURLFromKey(selDat: string) {
    return GlobalConstants.thumbsBaseURL;
  }

  getBaseURL() {
    return this.getBaseURLFromKey(this.selectedDataset);
  }

  isVideoResult(dataset: string): boolean {
    return dataset.endsWith('v');
  }

  getIDPartNums() {
    if (this.selectedDataset == 'marine-v' || this.selectedDataset == 'marine-s') {
      return 3; 
    }
    else { //if (this.selectedDataset == 'v3c-v' || this.selectedDataset == 'v3c-v') {
      return 1;
    }
  }

  onQueryInputFocus() {
    this.queryFieldHasFocus = true;
  }

  onQueryInputBlur() {
    this.queryFieldHasFocus = false;
  }

  onAnswerInputFocus() {
    this.answerFieldHasFocus = true;
  }

  onAnswerInputBlur() {
    this.answerFieldHasFocus = false
  }

  selectItemAndShowSummary(idx:number) {
    this.selectedItem = idx;
    this.showPreview = true;
    this.showVideoPreview();
  }

  showVideoPreview() {
    this.requestVideoSummaries(this.queryresult_videoid[this.selectedItem]);
    window.scrollTo(0, 0);

    //query event logging
    let queryEvent:QueryEvent = {
      timestamp: Date.now(),
      category: QueryEventCategory.BROWSING,
      type: "videosummary",
      value: this.queryresult_videoid[this.selectedItem]
    }
    this.vbsService.queryEvents.push(queryEvent);
    this.vbsService.submitQueryResultLog('interaction');
  }

   /****************************************************************************
   * Queries
   ****************************************************************************/

  queryForVideo(i: number) {
    let v = this.queryresult_videoid[i];
    console.log('query for video ' + v);
    this.queryinput = v;
    this.selectedQueryType = 'videoid';
    this.performQuery();
  }

  performNewTextQuery() {
    this.selectedPage = '1';
    this.previousQuery = undefined;
    this.file_sim_keyframe = undefined;
    this.file_sim_pathPrefix = undefined;
    this.performQuery();
  }

  performQuery(saveToHist: boolean = true) {
    //called from the paging buttons
    if (this.file_sim_keyframe && this.file_sim_pathPrefix) {
      this.performFileSimilarityQuery(this.file_sim_keyframe, this.file_sim_pathPrefix, this.selectedPage);
    }
    else if (this.previousQuery !== undefined && this.previousQuery.type === "similarityquery") {
      this.performSimilarityQuery(parseInt(this.previousQuery.query));
    } else {
      this.performTextQuery(saveToHist);
    }
  }

  performTextQuery(saveToHist: boolean = true) {

    if (this.queryinput.trim() === '')
      return;

    if (this.clipService.connectionState === WSServerStatus.CONNECTED ||
      this.nodeService.connectionState === WSServerStatus.CONNECTED) {

      this.nodeServerInfo = "processing query, please wait...";

      if (this.previousQuery !== undefined && this.previousQuery.type === 'textquery' && this.previousQuery.query !== this.queryinput) {
        this.selectedPage = '1';
      }
      
      console.log('qc: query for', this.queryinput);
      this.queryBaseURL = this.getBaseURL();
      let msg = { 
        type: "textquery", 
        clientId: "direct", 
        query: this.queryinput,
        maxresults: this.maxresults,
        resultsperpage: this.resultsPerPage, 
        selectedpage: this.selectedPage, 
        dataset: this.selectedDataset
      };
      this.previousQuery = msg;

      msg.dataset = this.selectedDataset;
      msg.type = this.selectedQueryType;

      //this.sendToCLIPServer(msg);

      this.queryTimestamp = getTimestampInSeconds();

      if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
        this.queryType = 'database/joint';
        this.sendToNodeServer(msg);
      } else {
        this.queryType = 'CLIP';
        this.sendToCLIPServer(msg);
      }

      if (saveToHist) {
        this.saveToHistory(msg);
      }

      //query event logging
      let queryEvent:QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.TEXT,
        type: this.selectedQueryType,
        value: this.queryinput
      }
      this.vbsService.queryEvents.push(queryEvent);

      
    } else {
      alert(`CLIP connection down: ${this.clipService.connectionState}. Try reconnecting by pressing the red button!`);
    }
  }

  performSimilarityQuery(serveridx:number) {
    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
      //alert(`search for ${i} ==> ${idx}`);
      console.log('similarity-query for ', serveridx);
      this.queryBaseURL = this.getBaseURL();
      let msg = { 
        type: "similarityquery", 
        query: serveridx.toString(),
        maxresults: this.maxresults,
        resultsperpage: this.resultsPerPage, 
        selectedpage: this.selectedPage, 
        dataset: this.selectedDataset
      };
      this.previousQuery = msg;

      this.sendToNodeServer(msg);
      this.saveToHistory(msg);

      //query event logging
      let queryEvent:QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.IMAGE,
        type: "similarityquery",
        value: `result# ${this.queryresult_resultnumber[serveridx]}`
      }
      this.vbsService.queryEvents.push(queryEvent);

    }
  }

  performFileSimilarityQuery(keyframe:string, pathprefix:string = this.datasetBase, selectedPage:string = "1") {
    //this.router.navigate(['filesimilarity',keyframe,this.datasetBase,selectedPage]); //or navigateByUrl(`/video/${videoid}`)
    let target = '_blank';
    if (this.file_sim_keyframe === keyframe) {
      target = '_self';
    }
    window.open('filesimilarity/' + encodeURIComponent(keyframe.replace('.jpg',GlobalConstants.replaceJPG_back2)) + '/' + encodeURIComponent(this.datasetBase) + '/' + selectedPage, target);
  }

  sendFileSimilarityQuery(keyframe:string, pathprefix:string) {
    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {

      console.log('file-similarity-query for ', keyframe);
      let msg = { 
        type: "file-similarityquery", 
        query: keyframe,
        pathprefix: pathprefix, 
        maxresults: this.maxresults,
        resultsperpage: this.resultsPerPage, 
        selectedpage: this.file_sim_page,
        dataset: this.selectedDataset 
      };
      this.previousQuery = msg;

      this.sendToNodeServer(msg);
      this.saveToHistory(msg);

      //query event logging
      let queryEvent:QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.BROWSING,
        type: "filesimilarityquery",
        value: `${keyframe}` 
      }
      this.vbsService.queryEvents.push(queryEvent);
    }
  }

  selectRun() {
    if (this.vbsService.selectedServerRun !== undefined) {
      localStorage.setItem('selectedEvaluation', '' + this.vbsService.selectedServerRun!);
    }
  }

  getRemainingTaskTime() {
    if (this.vbsService.selectedServerRun !== undefined) {
      let remainingTime = this.vbsService.serverRunsRemainingSecs.get(this.vbsService.serverRunIDs[this.vbsService.selectedServerRun]);
      return remainingTime;
    }
    return "";
  }

  /*backInHistory() {
    this.selectedHistoryEntry = '0';
    this.performHistoryQuery();
  }*/

  performHistoryQuery() {
    console.log(`run hist: ${this.selectedHistoryEntry}`)
    let hist = localStorage.getItem('history')
    if (hist && this.selectedHistoryEntry !== "-1") {
      let queryHistory:Array<QueryType> = JSON.parse(hist);
      let msg: QueryType = queryHistory[parseInt(this.selectedHistoryEntry!)];

      if (msg.type === 'file-similarityquery') {
        this.previousQuery = undefined;
        this.queryinput = '';
      } else {
        this.queryinput = msg.query;
        this.selectedDataset = msg.dataset;
        this.selectedQueryType = msg.type;
        this.selectedPage = msg.selectedpage;
        this.previousQuery = undefined;
        this.file_sim_keyframe = undefined;
        this.file_sim_pathPrefix = undefined;
      }

      this.performQuery(false);
      //this.sendToCLIPServer(msg);
      //this.saveToHistory(msg);
      
      this.selectedHistoryEntry = "-1";
      this.historyDiv.nativeElement.hidden = true;

      //query event logging
      let queryEvent:QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.OTHER,
        type: "historyquery",
        value: msg.query
      }
      this.vbsService.queryEvents.push(queryEvent);

    }
  }

  performHistoryLastQuery() {
    let hist = localStorage.getItem('history')
    if (hist) {
      let queryHistory:Array<QueryType> = JSON.parse(hist);
      let msg: QueryType = queryHistory[0];
      if (msg.type === 'textquery') {
        this.queryinput = msg.query;
        this.selectedDataset = msg.dataset;
        this.selectedPage = msg.selectedpage;
      }

      this.sendToCLIPServer(msg);

      //query event logging
      let queryEvent:QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.OTHER,
        type: "historylastquery",
        value: msg.query
      }
      this.vbsService.queryEvents.push(queryEvent);
    }
  }

  requestVideoSummaries(videoid:string) {
    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
      console.log('qc: get video summaries info from database', videoid);
      let msg = { 
        type: "videosummaries", 
        videoid: videoid
      };
      this.sendToNodeServer(msg);
    } else {
      alert(`Node.js connection down: ${this.nodeService.connectionState}. Try reconnecting by pressing the red button!`);
    }
  }

  sendToCLIPServer(msg:any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.clipService.messages.next(message);
    this.queryTimestamp = getTimestampInSeconds();
  }

  sendToNodeServer(msg:any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.nodeService.messages.next(message);
  }
  
  showVideoShots(videoid:string, frame:string) {
    //this.router.navigate(['video',videoid,frame]); //or navigateByUrl(`/video/${videoid}`)
    window.open('video/' + videoid + '/' + frame, '_blank');
  }

  /*performSimilarityQueryForIndex(idx:number) {
    this.selectedPage = '1';
    let serveridx = this.queryresult_serveridx[idx];
    this.performSimilarityQuery(serveridx);
  }*/

  resetPageAndPerformQuery() {
    this.selectedPage = '1';
    this.performTextQuery();
  }

  resetQuery() {
    this.queryinput = '';
    this.inputfield.nativeElement.focus();
    this.inputfield.nativeElement.select();
    this.file_sim_keyframe = undefined
    this.file_sim_pathPrefix = undefined
    this.previousQuery = undefined
    this.selectedPage = '1';
    this.selectedDataset = 'v3c';
    this.pages = ['1'];
    this.clearResultArrays();
    let queryHistory:Array<QueryType> = [];
    localStorage.setItem('history', JSON.stringify(queryHistory));
  }


  private clearResultArrays() {
    this.queryresults = [];
    //this.queryresult_serveridx = [];
    this.queryresult_resultnumber = [];
    this.queryresult_videoid = [];
    this.queryresult_frame = [];
    this.queryresult_videopreview = [];
    this.queryTimestamp = 0;
    this.vbsService.queryEvents = []
    this.vbsService.queryResults = []
  }

  /****************************************************************************
   * WebSockets (CLIP and Node.js)
   ****************************************************************************/

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


  closeVideoPreview() {
    //this.videopreview.nativeElement.style.display = 'none';
    this.showPreview = false;
  }

  handleQueryResponseMessage(qresults:any) {
    console.log(qresults);
    //console.log('dataset=' + qresults.dataset);
    
    if (qresults.totalresults === 0) {
      this.nodeServerInfo = 'The query returned 0 results!';
    }

    this.totalReturnedResults = qresults.totalresults; //totally existing results

    //create pages array
    this.pages = [];
    if (qresults.type === 'ocr-text' || qresults.type === 'videoid' || qresults.type === 'metadata' || qresults.type === 'speech') {
      this.pages.push('1');
    } else {
      for (let i = 1; i < this.totalReturnedResults / this.resultsPerPage; i++) {
        this.pages.push(i.toString());
      }
    }
    //populate images
    this.clearResultArrays();

    let resultnum = (parseInt(this.selectedPage) - 1) * this.resultsPerPage + 1;
    this.querydataset = qresults.dataset;
    this.keyframeBaseURL = this.getBaseURLFromKey(qresults.dataset);
    
    let logResults:Array<RankedAnswer> = [];
    for (let i = 0; i < qresults.results.length; i++) {
      let e = qresults.results[i].replace('.png',GlobalConstants.replacePNG2);
      let filename = e.split('/');
      let videoid = filename[0];
      // Split the second part of the filename by underscore and take the last element
      let parts = filename[1].split('_');
      let framenumber = parts[parts.length - 1].split('.')[0];
      //let framenumber = filename[1].split('_')[1].split('.')[0];
      this.queryresults.push(e);
      //this.queryresult_serveridx.push(qresults.resultsidx[i]);
      this.queryresult_videoid.push(videoid);
      this.queryresult_frame.push(framenumber);
      this.queryresult_resultnumber.push(resultnum.toString());
      this.queryresult_videopreview.push('');

      let logAnswer:ApiClientAnswer = {
        text: undefined,
        mediaItemName: videoid,
        mediaItemCollectionName: this.selectedDataset,
        start: framenumber, 
        end: framenumber
      }
      let logResult:RankedAnswer = {
        answer: logAnswer,
        rank: resultnum
      }
      logResults.push(logResult)
      resultnum++;
    }

    this.inputfield.nativeElement.blur();
    this.nodeServerInfo = undefined;

    this.vbsService.queryResults = logResults;
    this.vbsService.submitQueryResultLog('feedbackModel', this.selectedPage);
  }

  closeWebSocketCLIP() {
    if (this.clipService.connectionState !== WSServerStatus.CONNECTED) {
      this.clipService.connectToServer();
    }
  }

  /****************************************************************************
   * Submission to VBS Server
   ****************************************************************************/


  submitResult(index: number) {
    let videoid = this.queryresult_videoid[index];
    let keyframe = this.queryresults[index];
    let comps = keyframe.split('_');
    let frameNumber = comps[comps.length-1].split('.')[0]
    console.log(`${videoid} - ${keyframe} - ${frameNumber}`);

    let msg = { 
      type: "videofps", 
      videoid: videoid
    };
    let message = {
      source: 'appcomponent',
      content: msg
    };
    
    this.nodeService.sendMessageAndWait(message).subscribe((response) => {
      console.log('Received video info: fps=' + response.fps + " duration=" + response.duration);

      this.vbsService.submitFrame(videoid, parseInt(frameNumber), response.fps, response.duration);

      //query event logging
      let queryEvent:QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.OTHER,
        type: "submitFrame",
        value: videoid + ',' + frameNumber
      }
      this.vbsService.queryEvents.push(queryEvent);
      this.vbsService.submitQueryResultLog('interaction');
    });

    

  }

  sendTopicAnswer() {
    this.vbsService.submitText(this.topicanswer)

    let queryEvent:QueryEvent = {
      timestamp: Date.now(),
      category: QueryEventCategory.OTHER,
      type: 'submitAnswer1',
      value: this.topicanswer
    }
    this.vbsService.queryEvents.push(queryEvent);
    this.vbsService.submitQueryResultLog('interaction');
  }
}
