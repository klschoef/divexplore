import { ViewChild, ElementRef, Component, AfterViewInit, Renderer2 } from '@angular/core';
import { HostListener } from '@angular/core';
import { GlobalConstants, WSServerStatus, WebSocketEvent, formatAsTime, QueryType, getTimestampInSeconds } from '../../shared/config/global-constants';
import { VBSServerConnectionService } from '../../services/vbsserver-connection/vbsserver-connection.service';
import { VbsServiceCommunication } from '../../shared/interfaces/vbs-task-interface';
import { GUIAction, GUIActionType } from '../../shared/interfaces/gui-action';
import { GlobalConstantsService } from '../../shared/config/services/global-constants.service';
import { NodeServerConnectionService } from '../../services/nodeserver-connection/nodeserver-connection.service';
import { ClipServerConnectionService } from '../../services/clipserver-connection/clipserver-connection.service';
import { Router, ActivatedRoute } from '@angular/router';
import { query } from '@angular/animations';
import { QueryEvent, QueryResultLog, QueryEventLog, QueryEventCategory, RankedAnswer, ApiClientAnswer } from 'openapi/dres';
import { Title } from '@angular/platform-browser';
import { MessageBarComponent } from '../message-bar/message-bar.component';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ConfigFormComponent } from '../config-form/config-form.component';
import { UrlRetrievalService } from 'src/app/services/url-retrieval/url-retrieval.service';

@Component({
  selector: 'app-query',
  templateUrl: './query.component.html',
  styleUrls: ['./query.component.scss']
})
export class QueryComponent implements AfterViewInit, VbsServiceCommunication {
  // Component's core properties
  @ViewChild('inputfield') inputfield!: ElementRef<HTMLInputElement>;
  @ViewChild('historyDiv') historyDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('videopreview', { static: false }) videopreview!: ElementRef;
  @ViewChild(MessageBarComponent) messageBar!: MessageBarComponent;

  // Subscriptions for handling events
  private dresErrorMessageSubscription!: Subscription;
  private dresSuccessMessageSubscription!: Subscription;
  private urlRetrievalServiceSubscription!: Subscription;

  // Query-related properties
  queryinput: string = '';
  queryresults: Array<string> = [];
  queryresult_resultnumber: Array<string> = [];
  queryresult_videoid: Array<string> = [];
  queryresult_frame: Array<string> = [];
  queryresult_videopreview: Array<string> = [];
  queryTimestamp: number = 0;
  queryType: string = '';
  previousQuery: any | undefined;
  querydataset: string = '';

  // Metadata and summaries for video analysis
  metadata: any;
  summaries: Array<string> = [];
  selectedSummaryIdx = 0;

  // Video playback and preview properties
  videoSummaryPreview: string = '';
  videoLargePreview: string = '';
  videoPlayPreview: string = '';
  videoExplorePreview: Array<string> = [];
  currentContent: 'image' | 'thumbnail' | 'video' | 'explore' = 'image';
  //videoSummaryLargePreview: string = '';

  // UI state and navigation properties
  selectedItem = 0;
  showPreview = false;
  showHelpActive = false;
  thumbSize = 'small';
  selectedHistoryEntry: string | undefined;
  queryFieldHasFocus = false;
  answerFieldHasFocus = false;
  showButtons = -1;
  activeButton: string = 'image';
  showConfigForm = false;
  columnsCount: number = 3;

  // Dataset and query configuration
  selectedDataset = 'v3c'; //'v3c-s';
  datasets = [
    { id: 'v3c', name: 'V3C' },
    { id: 'mvk', name: 'MVK' },
    { id: 'lhe', name: 'LHE' }
  ];
  selectedQueryType = 'textquery';
  private queryTypes = [
    { id: 'textquery', name: 'Free-Text' },
    { id: 'ocr-text', name: 'OCR-Text' },
    { id: 'metadata', name: 'Metadata' },
    { id: 'speech', name: 'Speech' },
    { id: 'videoid', name: 'VideoId' }
  ];
  selectedVideoFiltering = 'all';
  videoFiltering = [
    { id: 'all', name: 'All/v' },
    { id: 'first', name: 'First/v' }
  ];

  // Results and pagination
  totalReturnedResults = 0; //how many results did our query return in total?
  selectedPage = '1'; //user-selected page
  pages = ['1']

  // Helper properties for file similarity and node server info
  file_sim_keyframe: string | undefined
  file_sim_pathPrefix: string | undefined
  file_sim_page: string = "1"
  nodeServerInfo: string | undefined;

  // Display ratios and base URLs
  imgWidth = this.globalConstants.imageWidth;
  imgHeight = this.globalConstants.imageWidth / GlobalConstants.imgRatio;
  queryBaseURL = this.getBaseURL();
  keyframeBaseURL: string = '';
  datasetBase: string = 'keyframes';

  // FPS mapping for video frames
  queryresult_fps = new Map<string, number>();

  // Mapping for different query types based on the selected dataset
  private queryTypeMap: Map<string, typeof this.queryTypes>;

  // Task information properties
  public statusTaskInfoText: string = ""; //property binding
  statusTaskRemainingTime: string = ""; //property binding

  constructor(
    private globalConstants: GlobalConstantsService,
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService,
    public urlRetrievalService: UrlRetrievalService,
    private renderer: Renderer2,
    private titleService: Title,
    private route: ActivatedRoute,
    private router: Router,
    public dialog: MatDialog) {
    this.queryTypeMap = new Map<string, typeof this.queryTypes>();
    this.initializeMap();
  }

  ngOnInit() {
    console.log('query component (qc) initated imWidth=' + this.imgWidth + " imHeight=" + this.imgHeight);

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

    this.urlRetrievalServiceSubscription = this.urlRetrievalService.explorationResults$.subscribe(results => {
      if (results) {
        console.log('qc: exploration results receive ' + results)
        this.videoExplorePreview = results;
      }
    });

    this.route.paramMap.subscribe(paraMap => {
      this.file_sim_keyframe = paraMap.get('id')?.toString();
      if (this.file_sim_keyframe) {
        console.log(`qc: ${this.file_sim_keyframe}`);
        this.titleService.setTitle(this.file_sim_keyframe.substring(this.file_sim_keyframe.indexOf('/') + 1));
      }
      let sds = paraMap.get('id2')?.toString();
      if (sds !== undefined) {
        this.selectedDataset = sds;
      }
      this.file_sim_pathPrefix = paraMap.get('id3')?.toString();
      if (this.file_sim_pathPrefix) {
        console.log(`qc: ${this.file_sim_pathPrefix}`);
        //this.selectedDataset = 'v3c';
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
      console.log('qc: 1234 node-service already connected');
    } else {
      console.log('qc: 1234 node-service not connected yet');
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
        if ("videoid" in msg) {
          this.queryresult_fps.set(m.videoid, m.fps);
        } else {
          //console.log("qc: response from node-server: " + msg);
          if ("scores" in msg || m.type === 'ocr-text') {
            this.handleQueryResponseMessage(msg);
          } else {
            if ("type" in msg) {
              if (m.type == 'metadata') {
                this.metadata = m.results[0];
                //this.pages = ['1'];
                //console.log('received metadata: ' + JSON.stringify(msg));
                if (this.metadata?.location) {
                }
              } else if (m.type === 'info') {
                //console.log(m.message);
                this.nodeServerInfo = m.message;
              } else if (m.type === 'videosummaries') {
                this.summaries = msg.content[0]['summaries'];
                this.selectedSummaryIdx = Math.floor(this.summaries.length / 2);
                this.displayVideoSummary();
              }
            } else {
              this.handleQueryResponseMessage(msg);
            }
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
    this.urlRetrievalServiceSubscription.unsubscribe();
  }

  ngAfterViewInit(): void {
    this.historyDiv.nativeElement.hidden = true;
  }

  ngAfterViewChecked(): void {
    if (this.videopreview && this.currentContent === 'video') {
      this.playVideoAtFrame();
    }
  }

  playVideoAtFrame(): void {
    this.getFPSForItem(this.selectedItem);

    let frame = parseFloat(this.queryresult_frame[this.selectedItem]);
    let fps = this.queryresult_fps.get(this.queryresult_videoid[this.selectedItem])!;
    let time = frame / fps;

    const videoElement = this.videopreview.nativeElement;

    if (videoElement.paused && !Number.isNaN(time)) {
      this.renderer.setProperty(videoElement, 'currentTime', time);
      this.renderer.listen(videoElement, 'loadedmetadata', () => {
        videoElement.play();
      });
    }
  }

  private initializeMap(): void {
    // Add the array to the map for 'v3c'
    this.queryTypeMap.set('v3c', [...this.queryTypes]);

    // Filter and add the array for 'mvk' and 'lhe'
    const filteredQueryTypes = this.queryTypes.filter(qt => !['ocr-text', 'metadata', 'speech'].includes(qt.id));
    this.queryTypeMap.set('mvk', filteredQueryTypes);
    this.queryTypeMap.set('lhe', filteredQueryTypes);
  }

  public getQueryTypes(key: string): typeof this.queryTypes {
    return this.queryTypeMap.get(key) || [];
  }

  toggleConfigDialog(): void {
    this.showConfigForm = !this.showConfigForm;
  }

  private displayVideoSummary() {
    let videoId = this.queryresult_videoid[this.selectedItem];
    let frame = this.queryresult_frame[this.selectedItem];
    let summary = this.summaries[this.selectedSummaryIdx];

    this.videoSummaryPreview = this.urlRetrievalService.getPreviewSummaryUrl(summary);
    //this.videoSummaryLargePreview = this.urlRetrievalService.getPreviewSummaryLargeUrl(summary);
    this.videoLargePreview = this.urlRetrievalService.getThumbnailUrl(videoId, frame);
    this.videoPlayPreview = this.urlRetrievalService.getVideoUrl(videoId);
  }

  reloadComponent(): void {
    window.location.reload();
  }

  showHelp() {
    this.showHelpActive = !this.showHelpActive;
  }

  toggleConfigModal() {
    this.showConfigForm = !this.showConfigForm;
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
      let histj: [QueryType] = JSON.parse(hist);
      for (let i = 0; i < histj.length; i++) {
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
      let queryHistory: Array<QueryType> = JSON.parse(hist);
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
        queryHistory.splice(containedPos, 1);
        queryHistory.unshift(msg);
        localStorage.setItem('history', JSON.stringify(queryHistory));
      }
      else {
        queryHistory.unshift(msg);
        localStorage.setItem('history', JSON.stringify(queryHistory));
      }
    } else {
      let queryHistory: Array<QueryType> = [msg];
      localStorage.setItem('history', JSON.stringify(queryHistory));
    }
  }

  newTab(): void {
    const currentUrl = window.location.href;
    window.open(currentUrl, '_blank');
  }

  asTimeLabel(frame: string, withFrames: boolean = true) {
    console.log('TODO: need FPS in query component!')
    return frame;
    //return formatAsTime(frame, this.fps, withFrames);
  }

  @HostListener('document:keyup', ['$event'])
  handleKeyboardEventUp(event: KeyboardEvent) {
    if (!this.queryFieldHasFocus && !this.answerFieldHasFocus && !this.showConfigForm) {
      switch (event.key) {
        case 'q':
          this.inputfield.nativeElement.select();
          break;
        case 'e':
          this.inputfield.nativeElement.focus();
          break;
        case 'Escape':
          this.closeVideoPreview();
          break;
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.queryFieldHasFocus && !this.answerFieldHasFocus && !this.showConfigForm) {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowLeft':
          this.handleArrowKeys(event);
          break;
        case 'ArrowUp':
          if (this.showPreview && this.selectedSummaryIdx > 0) {
            this.selectedSummaryIdx -= 1;
            this.displayVideoSummary();
          }
          break;
        case 'ArrowDown':
          if (this.showPreview && this.selectedSummaryIdx < this.summaries.length - 1) {
            this.selectedSummaryIdx += 1;
            this.displayVideoSummary();
          }
          break;
        case ' ':
          this.showPreview = !this.showPreview;
          if (this.showPreview) this.showVideoPreview();
          break;
        /*
        case 's':
          this.submitResult(this.selectedItem);
          break;
        case 'v':
          this.showVideoShots(this.queryresult_videoid[this.selectedSummaryIdx],'1');
          break;
        */
        default:
          if (this.isNumericKey(event.key) && !this.showPreview) {
            this.gotoPage(event.key);
          }
          break;
      }
      event.preventDefault();
    }
  }

  private handleArrowKeys(event: KeyboardEvent) {
    const { key, shiftKey } = event;
    if (shiftKey) {
      if (!this.showPreview) {
        key === 'ArrowRight' ? this.nextPage() : this.prevPage();
      }
    } else {
      let toShow = this.showPreview;
      if (key === 'ArrowRight') {
        this.selectedItem = this.selectedItem < this.queryresult_videoid.length - 1 ? this.selectedItem + 1 : !this.showPreview ? 0 : this.selectedItem;
      } else { // ArrowLeft
        this.selectedItem = this.selectedItem > 0 ? this.selectedItem - 1 : !this.showPreview ? this.queryresult_videoid.length - 1 : this.selectedItem;
      }
      if (toShow) this.showVideoPreview();
    }
  }

  private isNumericKey(key: string): boolean {
    return ['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(key);
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

  gotoPage(pnum: string) {
    let testPage = parseInt(pnum);
    if (testPage < this.pages.length && testPage > 0) {
      this.selectedPage = pnum;
      this.performQuery();
    }
  }

  getBaseURLFromKey(selDat: string) {
    return this.globalConstants.thumbsBaseURL; // GlobalConstants.thumbsBaseURL;
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

  handleAnswerFieldFocusChange(hasFocus: boolean) {
    this.answerFieldHasFocus = hasFocus;
  }

  selectItemAndShowSummary(idx: number, event: MouseEvent) {
    this.selectedItem = idx;
    this.showPreview = true;
    this.showVideoPreview();
    this.adjustVideoPreviewPosition(event);
  }

  adjustVideoPreviewPosition(event: MouseEvent) {
    const previewElement = document.querySelector('.videopreview') as HTMLElement;
    if (previewElement) {
      // Get the clicked element's position
      const rect = (event.target as HTMLElement).getBoundingClientRect();

      // Set the position of the preview element
      previewElement.style.left = `${rect.left}px`; // Align left edge with clicked item
      previewElement.style.top = `${rect.top + window.scrollY}px`; // Align top edge considering scroll
      previewElement.style.display = 'block';
    }
  }

  /* Shows video preview on click on query-result */
  showVideoPreview() {
    this.requestVideoSummaries(this.queryresult_videoid[this.selectedItem]);
    //window.scrollTo(0, 0);

    //console.log("show video preview for " + this.queryresult_videoid[this.selectedItem]);

    //query event logging
    let queryEvent: QueryEvent = {
      timestamp: Date.now(),
      category: QueryEventCategory.BROWSING,
      type: "videosummary",
      value: this.queryresult_videoid[this.selectedItem]
    }
    this.vbsService.queryEvents.push(queryEvent);
    this.vbsService.submitQueryResultLog('interaction');

    if (this.currentContent === 'explore') {
      this.urlRetrievalService.getExplorationUrls(this.queryresult_videoid[this.selectedItem]);
    }
  }

  closeVideoPreview() {
    //this.videopreview.nativeElement.style.display = 'none';
    this.showPreview = false;
  }

  setContent(content: 'image' | 'thumbnail' | 'video' | 'explore') {
    this.currentContent = content;
    this.activeButton = content;

    if (content === 'explore') {
      this.urlRetrievalService.getExplorationUrls(this.queryresult_videoid[this.selectedItem]);
    }
  }

  createShotLink(explorationUrl: string) {
    let videoId: string = "";
    const url = new URL(explorationUrl);
    const paths = url.pathname.split('/');
    const summariesXLIndex = paths.indexOf('summariesXL');
    console.log('paths: ' + summariesXLIndex + " Path length: " + paths.length);
    console.log('paths: ' + paths);
    if (summariesXLIndex !== -1 && summariesXLIndex + 1 < paths.length) {
      videoId = paths[summariesXLIndex + 2];
    }
    this.showVideoShots(videoId, '1');
  }

  showVideoShots(videoid: string, frame: string) {
    //this.router.navigate(['video',videoid,frame]); //or navigateByUrl(`/video/${videoid}`)
    window.open('video/' + videoid + '/' + frame, '_blank');
  }

  mouseOverShot(i: number) {
    this.showButtons = i;
    this.getFPSForItem(i);
  }

  mouseLeaveShot(i: number) {
    this.showButtons = -1;
  }

  getFPSForItem(i: number) {
    if (this.queryresult_fps.get(this.queryresult_videoid[i]) == undefined) {
      let msg = {
        type: "videofps",
        synchronous: false,
        videoid: this.queryresult_videoid[i]
      };
      this.sendToNodeServer(msg);
    }
  }

  getTimeInformationFor(i: number) {
    let fps = this.queryresult_fps.get(this.queryresult_videoid[i]);
    if (fps !== undefined) {
      let sTime = formatAsTime(this.queryresult_frame[i], fps, false);
      return sTime;
    } else {
      return ''; //this.queryresult_frame[i];
    }
  }

  resetPageAndPerformQuery() {
    //this.selectedQueryType = 'textquery';
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
    this.selectedVideoFiltering = 'all';
    this.pages = ['1'];
    this.clearResultArrays();
    let queryHistory: Array<QueryType> = [];
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

    let qi = this.queryinput.trim();
    if (qi === '') {
      return;
    }

    if (qi == '*' && this.selectedQueryType !== 'videoid') {
      this.messageBar.showErrorMessage('* queries work only for VideoId');
      return;
    }

    if (qi == '*' && this.selectedQueryType === 'videoid' && (this.selectedVideoFiltering !== 'first' || this.selectedDataset === 'v3c')) {
      this.messageBar.showErrorMessage('* queries work only with MVK or LHE and Video Filter (First/v)');
      return;
    }

    this.showHelpActive = false;
    this.showPreview = false;

    if (this.clipService.connectionState === WSServerStatus.CONNECTED ||
      this.nodeService.connectionState === WSServerStatus.CONNECTED) {

      this.nodeServerInfo = "processing query, please wait...";

      if (this.previousQuery !== undefined && this.previousQuery.type === 'textquery' && this.previousQuery.query !== this.queryinput) {
        this.selectedPage = '1';
      }

      console.log('qc: query for', this.queryinput + " videofiltering=" + this.selectedVideoFiltering + " and " + this.queryType);
      this.queryBaseURL = this.getBaseURL();
      let msg = {
        type: "textquery",
        clientId: "direct",
        query: this.queryinput,
        maxresults: this.globalConstants.maxResultsToReturn,
        resultsperpage: this.globalConstants.resultsPerPage,
        selectedpage: this.selectedPage,
        dataset: this.selectedDataset,
        videofiltering: this.selectedVideoFiltering
      };
      this.previousQuery = msg;

      msg.dataset = this.selectedDataset;
      msg.type = this.selectedQueryType;
      msg.videofiltering = this.selectedVideoFiltering;

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
      let queryEvent: QueryEvent = {
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

  performSimilarityQuery(serveridx: number) {
    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
      //alert(`search for ${i} ==> ${idx}`);
      console.log('similarity-query for ', serveridx);
      this.queryBaseURL = this.getBaseURL();
      let msg = {
        type: "similarityquery",
        query: serveridx.toString(),
        videofiltering: this.selectedVideoFiltering,
        maxresults: this.globalConstants.maxResultsToReturn,
        resultsperpage: this.globalConstants.resultsPerPage,
        selectedpage: this.selectedPage,
        dataset: this.selectedDataset
      };
      this.previousQuery = msg;

      this.sendToNodeServer(msg);
      this.saveToHistory(msg);

      //query event logging
      let queryEvent: QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.IMAGE,
        type: "similarityquery",
        value: `result# ${this.queryresult_resultnumber[serveridx]}`
      }
      this.vbsService.queryEvents.push(queryEvent);

    }
  }

  performFileSimilarityQuery(keyframe: string, pathprefix: string = this.datasetBase, selectedPage: string = "1") {
    //this.router.navigate(['filesimilarity',keyframe,this.datasetBase,selectedPage]); //or navigateByUrl(`/video/${videoid}`)
    let target = '_blank';
    if (this.file_sim_keyframe === keyframe) {
      target = '_self';
    }
    window.open('filesimilarity/' + encodeURIComponent(keyframe.replace('.jpg', GlobalConstants.replaceJPG_back2)) + '/' + this.selectedDataset + '/' + encodeURIComponent(this.datasetBase) + '/' + selectedPage, target);
  }

  sendFileSimilarityQuery(keyframe: string, pathprefix: string) {
    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {

      console.log('file-similarity-query for ', keyframe);
      let msg = {
        type: "file-similarityquery",
        query: keyframe,
        videofiltering: this.selectedVideoFiltering,
        pathprefix: pathprefix,
        maxresults: this.globalConstants.maxResultsToReturn,
        resultsperpage: this.globalConstants.resultsPerPage,
        selectedpage: this.file_sim_page,
        dataset: this.selectedDataset
      };
      this.previousQuery = msg;

      this.sendToNodeServer(msg);
      this.saveToHistory(msg);

      //query event logging
      let queryEvent: QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.BROWSING,
        type: "filesimilarityquery",
        value: `${keyframe}`
      }
      this.vbsService.queryEvents.push(queryEvent);
    }
  }

  performHistoryQuery() {
    console.log(`run hist: ${this.selectedHistoryEntry}`)
    let hist = localStorage.getItem('history')
    if (hist && this.selectedHistoryEntry !== "-1") {
      let queryHistory: Array<QueryType> = JSON.parse(hist);
      let msg: QueryType = queryHistory[parseInt(this.selectedHistoryEntry!)];

      if (msg.type === 'file-similarityquery') {
        this.previousQuery = undefined;
        this.queryinput = '';
      } else {
        this.queryinput = msg.query;
        this.selectedDataset = msg.dataset;
        this.selectedQueryType = msg.type;
        this.selectedVideoFiltering = msg.videofiltering;
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
      let queryEvent: QueryEvent = {
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
      let queryHistory: Array<QueryType> = JSON.parse(hist);
      let msg: QueryType = queryHistory[0];
      if (msg.type === 'textquery') {
        this.queryinput = msg.query;
        this.selectedDataset = msg.dataset;
        this.selectedPage = msg.selectedpage;
      }

      this.sendToCLIPServer(msg);

      //query event logging
      let queryEvent: QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.OTHER,
        type: "historylastquery",
        value: msg.query
      }
      this.vbsService.queryEvents.push(queryEvent);
    }
  }

  requestVideoSummaries(videoid: string) {
    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
      //console.log('qc: get video summaries info from database', videoid);
      let msg = {
        type: "videosummaries",
        videoid: videoid
      };
      this.sendToNodeServer(msg);
    } else {
      alert(`Node.js connection down: ${this.nodeService.connectionState}. Try reconnecting by pressing the red button!`);
    }
  }

  sendToCLIPServer(msg: any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.clipService.messages.next(message);
    this.queryTimestamp = getTimestampInSeconds();
  }

  sendToNodeServer(msg: any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.nodeService.messages.next(message);
  }


  /****************************************************************************
   * WebSockets (CLIP and Node.js)
   ****************************************************************************/
  handleQueryResponseMessage(qresults: any) {
    console.log(qresults);
    //console.log('dataset=' + qresults.dataset);

    if (qresults.totalresults === 0) {
      this.nodeServerInfo = 'The query returned 0 results!';
    }

    this.totalReturnedResults = qresults.totalresults; //totally existing results

    //create pages array
    this.pages = [];
    if (qresults.num == qresults.totalresults || qresults.type === 'ocr-text' || qresults.type === 'videoid' || qresults.type === 'metadata' || qresults.type === 'speech') {
      this.pages.push('1');
    } else {
      for (let i = 1; i < this.totalReturnedResults / this.globalConstants.resultsPerPage; i++) {
        this.pages.push(i.toString());
      }
    }
    //populate images
    this.clearResultArrays();

    let resultnum = (parseInt(this.selectedPage) - 1) * this.globalConstants.resultsPerPage + 1;
    this.querydataset = qresults.dataset;
    this.keyframeBaseURL = this.getBaseURLFromKey(qresults.dataset);

    let logResults: Array<RankedAnswer> = [];

    for (let i = 0; i < qresults.results.length; i++) {
      let e = qresults.results[i].replace('.png', GlobalConstants.replacePNG2);
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

      let logAnswer: ApiClientAnswer = {
        text: undefined,
        mediaItemName: videoid,
        mediaItemCollectionName: this.selectedDataset,
        start: framenumber,
        end: framenumber
      }
      let logResult: RankedAnswer = {
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
    let frameNumber = comps[comps.length - 1].split('.')[0]
    console.log(`${videoid} - ${keyframe} - ${frameNumber}`);

    let msg = {
      type: "videofps",
      synchronous: true,
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
      let queryEvent: QueryEvent = {
        timestamp: Date.now(),
        category: QueryEventCategory.OTHER,
        type: "submitFrame",
        value: videoid + ',' + frameNumber
      }
      this.vbsService.queryEvents.push(queryEvent);
      this.vbsService.submitQueryResultLog('interaction');
    });
  }
}
