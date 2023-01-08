import { ViewChild,ElementRef,Component, AfterViewInit } from '@angular/core';
import { HostListener } from '@angular/core';
import { GlobalConstants, WSServerStatus, WebSocketEvent, formatAsTime, QueryType } from '../global-constants';
import { VBSServerConnectionService } from '../vbsserver-connection.service';
import { NodeServerConnectionService } from '../nodeserver-connection.service';
import { ClipServerConnectionService } from '../clipserver-connection.service';
import { Router,ActivatedRoute } from '@angular/router';
import { query } from '@angular/animations';

@Component({
  selector: 'app-query',
  templateUrl: './query.component.html',
  styleUrls: ['./query.component.scss']
})
export class QueryComponent implements AfterViewInit {

  @ViewChild('inputfield') inputfield!: ElementRef<HTMLInputElement>;
  @ViewChild('historyDiv') historyDiv!: ElementRef<HTMLDivElement>;
  
  file_sim_keyframe: string | undefined
  file_sim_pathPrefix: string | undefined
  
  
  queryinput: string = '';
  queryresults: Array<string> = [];
  queryresult_serveridx: Array<number> = [];
  queryresult_resultnumber: Array<string> = [];
  queryresult_videoid: Array<string> = [];
  queryresult_frame: Array<string> = [];

  previousQuery : any | undefined;

  querydataset: string = '';
  queryBaseURL = this.getBaseURL();
  
  maxresults = GlobalConstants.maxResultsToReturn; 
  totalReturnedResults = 0; //how many results did our query return in total?
  resultsPerPage = GlobalConstants.resultsPerPage; 
  selectedPage = '1'; //user-selected page
  pages = ['1']
  
  thumbSize = 'small';
  selectedDataset = 'v3c-s';
  selectedHistoryEntry: string | undefined
  queryFieldHasFocus = false;
  datasets = [
    {id: 'v3c-s', name: 'Shots: V3C'},
    {id: 'v3c-v', name: 'Videos: V3C'},
    {id: 'marine-s', name: 'Shots: Marine'},
    {id: 'marine-v', name: 'Videos: Marine'} 
  ];
    
  constructor(
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService, 
    private route: ActivatedRoute,
    private router: Router) {
  }

  
  ngOnInit() {
    console.log('query component (qc) initated');

    this.route.paramMap.subscribe(paraMap => {
      this.file_sim_keyframe = paraMap.get('id')?.toString();
      if (this.file_sim_keyframe) {
        console.log(`qc: ${this.file_sim_keyframe}`);
      }
      this.file_sim_pathPrefix = paraMap.get('id2')?.toString();
      if (this.file_sim_pathPrefix) {
        console.log(`qc: ${this.file_sim_pathPrefix}`);
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
        this.performFileSimilarityQuery(this.file_sim_keyframe, this.file_sim_pathPrefix);
      }
    } else {
      console.log('qc: CLIP-service not connected yet');
    }

    this.nodeService.messages.subscribe(msg => {
      if ('wsstatus' in msg) { 
        console.log('qc: node-notification: connected');
      } else {
        let result = msg.content;
        console.log("qc: response from node-server: " + result[0]);
        console.log(result[0]['shots']);
      }
    });

    this.clipService.messages.subscribe(msg => {
      if ('wsstatus' in msg) { 
        console.log('qc: CLIP-notification: connected');
        if (this.file_sim_keyframe) {
          this.performFileSimilarityQuery(this.file_sim_keyframe, 'thumbsXL');
        }
      } else {
        console.log("qc: response from clip-server: " + msg);
        this.handleCLIPMessage(msg);
      }
    });
  }

  ngAfterViewInit(): void {
    this.historyDiv.nativeElement.hidden = true;
  }
  

  toggleHistorySelect() {
    this.historyDiv.nativeElement.hidden = !this.historyDiv.nativeElement.hidden;
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
    
    if (this.queryFieldHasFocus == false) {
      if (event.key == 'q') {
        this.inputfield.nativeElement.select();
      }
      else if (event.key == 'e') {
        this.inputfield.nativeElement.focus();
      }  
      else if (event.key == 'v') {
        this.selectedDataset = this.selectedDataset.replace('-s','-v');
        this.performTextQuery();
      }
      else if (event.key == 's') {
        this.selectedDataset = this.selectedDataset.replace('-v','-s');
        this.performTextQuery();
      }
      else if (event.key == 'x') {
        this.resetQuery();
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) { 
    if (this.queryFieldHasFocus == false) {
      if (event.key == 'ArrowRight' || event.key == 'Tab') {
        this.nextPage();     
      } else if (event.key == "ArrowLeft") {
        this.prevPage();
      } else {
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

   /****************************************************************************
   * Queries
   ****************************************************************************/


  performQuery() {
    //called from the paging buttons
    if (this.previousQuery !== undefined && this.previousQuery.type === "similarityquery") {
      this.performSimilarityQuery(parseInt(this.previousQuery.query));
    } else {
      this.performTextQuery();
    }
  }
  
  performTextQuery() {
    if (this.clipService.connectionState === WSServerStatus.CONNECTED) {
      if (this.previousQuery !== undefined && this.previousQuery.type === 'textquery' && this.previousQuery.query !== this.queryinput) {
        this.selectedPage = '1';
      }
      
      console.log('qc: query for', this.queryinput);
      this.queryBaseURL = this.getBaseURL();
      let msg = { 
        type: "textquery", 
        query: this.queryinput,
        maxresults: this.maxresults,
        resultsperpage: this.resultsPerPage, 
        selectedpage: this.selectedPage, 
        dataset: this.selectedDataset
      };
      this.previousQuery = msg;

      this.sendToCLIPServer(msg);
      this.saveToHistory(msg);
      
    } else {
      alert(`CLIP connection down: ${this.clipService.connectionState}. Try reconnecting by pressing the red button!`);
    }
  }

  performSimilarityQuery(serveridx:number) {
    if (this.clipService.connectionState === WSServerStatus.CONNECTED) {
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

      this.sendToCLIPServer(msg);
      this.saveToHistory(msg);
    }
  }

  performFileSimilarityQuery(keyframe:string, pathprefix:string) {
    if (this.clipService.connectionState === WSServerStatus.CONNECTED) {
      //alert(`search for ${i} ==> ${idx}`);
      console.log('file-similarity-query for ', keyframe);
      let msg = { 
        type: "file-similarityquery", 
        query: keyframe,
        pathprefix: pathprefix, 
        maxresults: this.maxresults,
        resultsperpage: this.resultsPerPage, 
        selectedpage: this.selectedPage,
        dataset: this.selectedDataset //TODO
      };
      this.previousQuery = msg;
      this.sendToCLIPServer(msg);
      this.saveToHistory(msg);
    }
  }

  runHistoryQuery() {
    console.log(`run hist: ${this.selectedHistoryEntry}`)
    let hist = localStorage.getItem('history')
    if (hist && this.selectedHistoryEntry !== "-1") {
      let queryHistory:Array<QueryType> = JSON.parse(hist);
      let msg: QueryType = queryHistory[parseInt(this.selectedHistoryEntry!)];
      this.sendToCLIPServer(msg);
      this.saveToHistory(msg);
    }
  }


  sendToCLIPServer(msg:any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.clipService.messages.next(message);
  }

  sendToNodeServer(msg:any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.nodeService.messages.next(message);
  }
  
  showVideoShots(videoid:string, frame:string) {
    this.router.navigate(['video',videoid,frame]); //or navigateByUrl(`/video/${videoid}`)
  }

  performSimilarityQueryForIndex(idx:number) {
    this.selectedPage = '1';
    let serveridx = this.queryresult_serveridx[idx];
    this.performSimilarityQuery(serveridx);
  }

  resetPageAndPerformQuery() {
    this.selectedPage = '1';
    this.performTextQuery();
  }

  resetQuery() {
    this.queryinput = '';
    this.inputfield.nativeElement.focus();
    this.inputfield.nativeElement.select();
    this.selectedPage = '1';
    this.pages = ['1'];
    this.clearResultArrays();
  }


  private clearResultArrays() {
    this.queryresults = [];
    this.queryresult_serveridx = [];
    this.queryresult_resultnumber = [];
    this.queryresult_videoid = [];
    this.queryresult_frame = [];
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


  handleNodeMessage(msg:any) {

  }

  handleCLIPMessage(qresults:any) {
    console.log(qresults);
    //console.log(data.content);
    //let keyframeBaseURL = this.getBaseURL();
    let underscorePositionID = this.getIDPartNums();

    this.totalReturnedResults = qresults.totalresults; //totally existing results
    //create pages array
    this.pages = [];
    for (let i = 1; i < this.totalReturnedResults / this.resultsPerPage; i++) {
      this.pages.push(i.toString());
    }
    //populate images
    this.clearResultArrays();

    let resultnum = (parseInt(this.selectedPage) - 1) * this.resultsPerPage + 1;
    this.querydataset = qresults.dataset;
    let keyframeBase = this.getBaseURLFromKey(qresults.dataset);
    
    //for (var e of qresults.results) {
    for (let i = 0; i < qresults.results.length; i++) {
      let e = qresults.results[i];
      let filename = e.split('/');
      this.queryresults.push(keyframeBase + e);
      this.queryresult_serveridx.push(qresults.resultsidx[i]);
      this.queryresult_videoid.push(filename[0]);
      this.queryresult_frame.push(filename[1].split('_')[1].split('.')[0]);
      this.queryresult_resultnumber.push(resultnum.toString());
      resultnum++;
    }

    this.inputfield.nativeElement.blur();
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
    this.vbsService.submitFrame(videoid, parseInt(frameNumber));
  }



}
