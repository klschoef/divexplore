import { ViewChild, ElementRef, Component, ViewChildren, QueryList, AfterViewInit, Renderer2 } from '@angular/core';
import { HostListener } from '@angular/core';
import { GlobalConstants, WSServerStatus, formatAsTime, QueryType, getTimestampInSeconds } from '../../shared/config/global-constants';
import { VBSServerConnectionService } from '../../services/vbsserver-connection/vbsserver-connection.service';
import { VbsServiceCommunication } from '../../shared/interfaces/vbs-task-interface';
import { GlobalConstantsService } from '../../shared/config/services/global-constants.service';
import { NodeServerConnectionService } from '../../services/nodeserver-connection/nodeserver-connection.service';
import { ClipServerConnectionService } from '../../services/clipserver-connection/clipserver-connection.service';
import { ActivatedRoute } from '@angular/router';
import { QueryEvent, QueryEventCategory, RankedAnswer, ApiClientAnswer } from 'openapi/dres';
import { Title } from '@angular/platform-browser';
import { MessageBarComponent } from '../message-bar/message-bar.component';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { UrlRetrievalService } from 'src/app/services/url-retrieval/url-retrieval.service';

interface Shot {
  keyframe: string;
}

interface temporalQueries {
  query: string;
}

@Component({
  selector: 'app-query',
  templateUrl: './query.component.html',
  styleUrls: ['./query.component.scss']
})
export class QueryComponent implements AfterViewInit, VbsServiceCommunication {
  // Component's core properties
  @ViewChild('inputfield') inputfield!: ElementRef<HTMLInputElement>;
  @ViewChild('videopreview', { static: false }) videopreview!: ElementRef;
  @ViewChild(MessageBarComponent) messageBar!: MessageBarComponent;
  @ViewChild('scrollableContainer') scrollableContainer!: ElementRef<HTMLDivElement>;
  @ViewChildren('videoPlayers') videoPlayers!: QueryList<ElementRef<HTMLVideoElement>>;

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
  submittedStatus: { [key: string]: boolean } = {};
  submittedFrame: string = "";

  // Metadata and summaries for video analysis
  metadata: any;
  summaries: Array<string> = [];
  selectedSummaryIdx = 0;

  // Video playback and preview properties
  videoSummaryPreview: string = '';
  videoLargePreview: string = '';
  videoPlayPreview: string = '';
  videoExplorePreview: Array<string> = [];
  shotPreview: Array<string> = [];
  currentContent: 'image' | 'thumbnail' | 'video' | 'shots' | 'explore' = 'image';

  // UI state and navigation properties
  temporalQueries: temporalQueries[] = [];
  selectedItem = 0;
  showPreview = false;
  showHelpActive = false;
  showHistoryActive = false;
  thumbSize = 'small';
  selectedHistoryEntry: string | undefined;
  queryFieldHasFocus = false;
  answerFieldHasFocus = false;
  showButtons = -1;
  activeButton: string = 'image';
  showConfigForm = false;
  columnsCountExplore: number = 3;
  columnsCountShots: number = 8;
  isOverImage: boolean = false;
  displayedImages: Array<string> = [];
  displayedShots: Array<string> = [];
  private debounceTimer?: number;
  batchSizeExplore: string = this.globalConstants.exploreResultsPerLoad; //how many cluster images to show in explore-preview
  batchSizeShots: string = this.globalConstants.shotsResultsPerLoad; //how many shots to show in shot-preview

  // Video Preview
  hoveredIndex: number | null = null;
  videoAvailable: { [key: number]: boolean } = {};
  videoSource: string = '';
  videoLoaded = false;
  preloadedVideos: Map<string, HTMLVideoElement> = new Map(); //used in video scrubbing
  videoLoading: boolean = false;
  isShiftPressed: boolean = false;
  shotsInfo: { [videoId: string]: any } = {};

  // Toast
  showToast: boolean = false;
  toastMessage: string = "";
  toastMessageNewLine: string = "";
  toastLink: string = "";
  toastImageSrc: string | null = null;

  // Dataset and query configuration
  selectedDataset = 'default'; //'v3c-s';
  datasets = [
    { id: 'default', name: 'Default' },
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
    { id: 'videoid', name: 'VideoId' },
    { id: 'predictions', name: 'Predictions' }
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
  file_sim_keyframe: string | undefined;
  file_sim_pathPrefix: string | undefined;
  file_sim_page: string = "1";
  nodeServerInfo: string | undefined;
  isSimilarityQuery = false;

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

  videoReady: boolean[] = [];
  isMouseOverShot: boolean = false;
  scrubbingVideoLoaded = false;

  suggestions: string[] = [
    'Bleeding', 'Grasper', 'Needlepassing', 'Thread-fragment', 'Bipolar-forceps',
    'SuctionIrrigation', 'Clip', 'Needle-holder', 'Hook', 'Sealer-divider', 'Ovary',
    'Irrigator', 'Rest', 'Uterus', 'Morcellator', 'Thread', 'Scissors', 'Needle'
  ];
  filteredSuggestions: string[] = [];

  constructor(
    private globalConstants: GlobalConstantsService,
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService,
    public urlRetrievalService: UrlRetrievalService,
    private renderer: Renderer2,
    private titleService: Title,
    private route: ActivatedRoute,
    public dialog: MatDialog) {
    this.queryTypeMap = new Map<string, typeof this.queryTypes>();
    this.initializeMap();
  }

  ngOnInit() {
    this.dresErrorMessageSubscription = this.vbsService.errorMessageEmitter.subscribe(msg => {
      this.messageBar.showErrorMessage(msg);
    })
    this.dresSuccessMessageSubscription = this.vbsService.successMessageEmitter.subscribe(msg => {
      this.messageBar.showSuccessMessage(msg);
      let message = {
        type: 'videosubmission',
        videoId: this.submittedFrame
      }
      this.sendToNodeServer(message);
    })

    let selectedEvaluation = localStorage.getItem('selectedEvaluation');
    if (selectedEvaluation) {
      console.log('selected evaluation is ' + selectedEvaluation);
      this.vbsService.selectedServerRun = parseInt(selectedEvaluation);
    }

    this.urlRetrievalServiceSubscription = this.urlRetrievalService.explorationResults$.subscribe(results => {
      if (results) {
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
      }
      if (paraMap.get('page')) {
        this.file_sim_page = paraMap.get('page')!.toString();
        this.selectedPage = this.file_sim_page;
      }

      if (this.file_sim_keyframe && this.file_sim_pathPrefix) {
        this.isSimilarityQuery = true;
      }
    });

    if (this.nodeService.connectionState == WSServerStatus.CONNECTED) {
      console.log('qc: node-service already connected');
    } else {
      console.log('qc: node-service not connected yet');
    }

    this.nodeService.messages.subscribe(msg => {
      this.nodeServerInfo = undefined;

      if ('wsstatus' in msg) {
        console.log('qc: node-notification: connected');
        if (this.file_sim_keyframe && this.file_sim_pathPrefix) {
          console.log('perfoming similarity query');
          this.sendFileSimilarityQuery(this.file_sim_keyframe, this.file_sim_pathPrefix);
        } else {
          //TODO: what is a historyLastQuery?
          /*
          console.log('perfoming history last query');
          this.performHistoryLastQuery();
          */
        }
      } else {
        //let result = msg.content;
        let m = JSON.parse(JSON.stringify(msg));
        if ("videoid" in msg) {
          this.queryresult_fps.set(m.videoid, m.fps);
          this.loadScrubbingVideo();
        } else {
          if ("scores" in msg || m.type === 'ocr-text') {
            this.handleQueryResponseMessage(msg);
          } else {
            if ("type" in msg) {
              if (m.type == 'metadata') {
                this.metadata = m.results[0];
                if (this.metadata?.location) {
                }
              } else if (m.type === 'info') {
                this.nodeServerInfo = m.message;
              } else if (m.type === 'videosummaries') {
                this.summaries = msg.content[0]['summaries'];
                this.selectedSummaryIdx = Math.floor(this.summaries.length / 2);
                this.displayVideoSummary();
              } else if (m.type === 'clusterimage') {
                const resultsArray: Array<string> = m.results;
                const updatedResults = resultsArray.map(image => this.globalConstants.summariesBaseURL + '/' + image);
                this.videoExplorePreview = updatedResults;
                this.displayedImages = [];
                this.loadMoreImages();
              } else if (m.type === 'videoinfo') {
                const shots = m.content[0].shots;
                this.shotsInfo[m.content[0].videoid] = shots;
                this.queryresult_fps.set(m.content[0].videoid, m.content[0].fps);
                const keyframes: Array<string> = m.content[0].shots.map((shot: Shot) => shot.keyframe);
                const updatedResults = keyframes.map(keyframe => this.globalConstants.thumbsBaseURL + '/' + this.queryresult_videoid[this.selectedItem] + "/" + keyframe);
                this.shotPreview = updatedResults;
                this.displayedShots = [];
                this.loadMoreShots();
              } else if (m.type === 'updatesubmissions') {
                localStorage.removeItem('submittedFrames');

                m.videoId.forEach((id: string) => {
                  this.markFrameAsSubmitted(id);
                });
              } else if (m.type === 'share') {
                console.log('qc: share-url: ' + m.url);
                console.log(m);
                let videoid = m.url.split('/')[2];
                let frameid = m.url.split('/')[3];
                let querystring = m.query;

                this.showToast = true;
                this.toastMessage = videoid + "/" + frameid;
                this.toastMessageNewLine = querystring;
                this.toastLink = m.url;
                this.toastImageSrc = this.urlRetrievalService.getThumbnailUrl(videoid, frameid);
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

    const submittedFrames = JSON.parse(localStorage.getItem('submittedFrames') || '[]');
    submittedFrames.forEach((item: string) => {
      this.submittedStatus[item] = true;
    });
  }

  ngOnDestroy() {
    this.dresErrorMessageSubscription.unsubscribe();
    this.dresSuccessMessageSubscription.unsubscribe();
    this.urlRetrievalServiceSubscription.unsubscribe();
  }

  ngAfterViewInit(): void {
  }

  ngAfterViewChecked(): void {
    if (this.videopreview && this.currentContent === 'video') {
      this.playVideoAtFrame();
    }
  }

  /***************** Video Scrubbing Feature Start ***************************/

  loadScrubbingVideo() {
    this.scrubbingVideoLoaded = false;
    if (this.hoveredIndex != null && this.isShiftPressed) {
      const video = document.getElementById("scrubbingVideo" + this.hoveredIndex) as HTMLVideoElement;
      if (video) {
        this.scrubbingVideoLoaded = true;
        video.src = this.getVideoSource(this.hoveredIndex);
        video.load();
      } else {
        console.log("video element " + this.hoveredIndex + " not loaded");
      }
    }
  }

  unloadScrubbingVideo() {
    if (this.hoveredIndex != null) {
      const video = document.getElementById("scrubbingVideo" + this.hoveredIndex) as HTMLVideoElement;
      if (video) {
        video.src = "";
      } else {
        console.log("video element " + this.hoveredIndex + " not loaded");
      }
    }
  }

  onMouseMove(event: MouseEvent, i: number): void {
    if (event.shiftKey && this.hoveredIndex == i) {
      const video = document.getElementById("scrubbingVideo" + this.hoveredIndex) as HTMLVideoElement;
      if (!this.scrubbingVideoLoaded && video) {
        this.scrubbingVideoLoaded = true;
        video.src = this.getVideoSource(this.hoveredIndex);
        video.load();
      }

      const videoPlayer = (event.target as HTMLVideoElement);
      if (!videoPlayer) return;

      const videoId = this.queryresult_videoid[i];
      const shots = this.shotsInfo[videoId];
      if (!shots) {
        console.log("Shots info not available for", videoId);
        return;
      }

      const keyframe = this.queryresult_frame[i];
      const matchingShot = shots.find((shot: Shot) => shot.keyframe.includes(keyframe));
      if (!matchingShot) {
        console.error("Matching shot not found for keyframe:", keyframe);
        return;
      }

      const videofps = this.queryresult_fps.get(videoId)!;
      const rect = videoPlayer.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const offsetRatio = mouseX / rect.width;
      const startFrame = matchingShot.from + offsetRatio * (matchingShot.to - matchingShot.from);
      const startTime = startFrame / videofps;

      if (isFinite(startTime) && startTime >= 0) {
        videoPlayer.currentTime = Math.max(0, startTime);
      } else {
        console.error("Invalid startTime:", startTime);
      }
    }
  }

  getVideoSource(item: any) {
    const videoId = this.queryresult_videoid[item];
    return this.globalConstants.scrubVideosBaseURL + videoId + '.mp4';
  }

  setVideoSource(videoUrl: string, video: HTMLVideoElement): void {
    this.videoSource = videoUrl;
    video.currentTime = 0;
    video.load();
  }

  checkVideoAvailability(index: number): void {
    const item = this.displayQueryResult[index];
    const videoId = item.split('/')[0];
    const videoUrl = this.getVideoSource(item);

    if (!this.preloadedVideos.has(videoId)) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = videoUrl;

      video.onloadedmetadata = () => {
        this.preloadedVideos.set(videoId, video);
        this.videoAvailable[index] = true;
        if (this.hoveredIndex === index) this.setVideoSource(videoUrl, video);
      };

      video.onerror = () => {
        console.error(`Failed to load video with ID: ${videoId}`);
        this.videoAvailable[index] = false;
      };
    } else {
      const preloadedVideo = this.preloadedVideos.get(videoId);
      if (preloadedVideo && this.hoveredIndex === index) {
        this.setVideoSource(videoUrl, preloadedVideo);
      }
    }
  }

  mouseOverShot(event: MouseEvent, i: number) {
    if (this.hoveredIndex === i) return;

    this.showButtons = i;
    this.getFPSForItem(i);

    if (event.shiftKey) {
      if (this.hoveredIndex != null) this.unloadScrubbingVideo();
      this.hoveredIndex = i;
      if (this.queryresult_fps.get(this.queryresult_videoid[i]) !== undefined) {
        this.loadScrubbingVideo();
      }
    } else {
      this.hoveredIndex = i;
    }

    if (!this.shotsInfo[this.queryresult_videoid[i]]) {
      this.loadShotList(this.queryresult_videoid[i]);
    }
  }

  mouseLeaveShot(i: number) {
    this.showButtons = -1;
    this.hoveredIndex = null;
  }

  /***************** Video Scrubbing Feature End ***************************/

  shareVideo(i: number = -1) {

    let videoid = this.queryresult_videoid[this.selectedItem];
    let frame = this.queryresult_frame[this.selectedItem];
    let url = '/video/' + videoid + '/' + frame;

    if (i != -1) {
      videoid = this.queryresult_videoid[i];
      frame = this.queryresult_frame[i];
      url = '/video/' + videoid + '/' + frame;
    }

    console.log('qc: share video: ' + url + ' for video: ' + videoid + ' and frame: ' + frame + ' and query: ' + this.queryinput);

    let message = {
      type: 'share',
      url: url,
      query: this.queryinput
    }

    this.sendToNodeServer(message);
  }

  handleToastClose() { //Close the toast message
    this.showToast = false;
  }

  loadMoreShots() { //Load more images in Shot Preview
    const startIndex = this.displayedShots.length;
    const endIndex = startIndex + parseInt(this.batchSizeShots);
    const nextBatch = this.shotPreview.slice(startIndex, endIndex);
    this.displayedShots = [...this.displayedShots, ...nextBatch];
  }

  loadMoreImages() { //Load more images in Explore Preview
    const startIndex = this.displayedImages.length;
    const endIndex = startIndex + parseInt(this.batchSizeExplore);
    const nextBatch = this.videoExplorePreview.slice(startIndex, endIndex);
    this.displayedImages = [...this.displayedImages, ...nextBatch];
  }

  playVideoAtFrame(): void { //Start video preview at the selected frame
    this.getFPSForItem(this.selectedItem);
    let videoId = this.queryresult_videoid[this.selectedItem];

    if (this.shotsInfo[videoId] === undefined) {
      console.log("Shots info not available for", videoId);
      this.loadShotList(videoId);
    }

    let frame = parseFloat(this.queryresult_frame[this.selectedItem]);
    let keyframe = this.queryresult_frame[this.selectedItem];
    let fps = this.queryresult_fps.get(this.queryresult_videoid[this.selectedItem])!;
    let time = frame / fps;

    const shots = this.shotsInfo[videoId];
    const matchingShot = shots.find((shot: Shot) => shot.keyframe.includes(keyframe));
    const startFrame = matchingShot.from / fps;

    const videoElement = this.videopreview.nativeElement;

    if (!Number.isNaN(time) && !(videoElement.currentTime > 0)) {
      console.log("Resetting...")
      this.renderer.setProperty(videoElement, 'currentTime', startFrame);
      this.renderer.listen(videoElement, 'loadedmetadata', () => {
        videoElement.play();
      });
    }
  }

  private initializeMap(): void {
    //filter out predictions for v3c
    const filteredQueryTypesForDefault = this.queryTypes.filter(
      qt => !['metadata', 'predictions'].includes(qt.id)
    );
    this.queryTypeMap.set('default', filteredQueryTypesForDefault);
    
    const filteredQueryTypesForV3C = this.queryTypes.filter(
      qt => !['predictions'].includes(qt.id)
    );
    this.queryTypeMap.set('v3c', filteredQueryTypesForV3C);

    const filteredQueryTypesForMVK = this.queryTypes.filter(
      qt => !['metadata', 'speech', 'predictions'].includes(qt.id)
    );
    this.queryTypeMap.set('mvk', filteredQueryTypesForMVK);

    const filteredQueryTypesForLHE = this.queryTypes.filter(
      qt => !['metadata', 'speech'].includes(qt.id)
    );
    this.queryTypeMap.set('lhe', filteredQueryTypesForLHE);
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
    this.videoLargePreview = this.urlRetrievalService.getThumbnailLargeUrl(videoId, frame);
    this.videoPlayPreview = this.urlRetrievalService.getVideoUrl(videoId);
  }

  reloadComponent(): void {
    window.location.reload();
  }

  showHelp() {
    this.showHelpActive = !this.showHelpActive;
  }

  showHistory() {
    this.showHistoryActive = !this.showHistoryActive;
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

  addTemporalQuery() {
    if (this.temporalQueries.length < 3)
      this.temporalQueries.push({ query: '' });
  }

  removeTemporalQuery(index: number) {
    this.temporalQueries.splice(index, 1);
  }

  newTab(): void {
    const currentUrl = window.location.href;
    window.open(currentUrl, '_blank');
  }

  asTimeLabel(frame: string, withFrames: boolean = true) {
    return frame;
  }

  @HostListener('document:keyup', ['$event'])
  handleKeyboardEventUp(event: KeyboardEvent) {
    if (!this.queryFieldHasFocus && !this.answerFieldHasFocus && !this.showConfigForm && !this.showHistoryActive) {
      switch (event.key) {
        case 'q':
          this.inputfield.nativeElement.select();
          break;
        case 'e':
          this.inputfield.nativeElement.focus();
          break;
        case 'Shift':
          this.isShiftPressed = false;
          this.unloadScrubbingVideo();
          break;
        case 'Escape':
          this.closeVideoPreview();
          break;
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.queryFieldHasFocus && !this.answerFieldHasFocus && !this.showConfigForm && !this.showHistoryActive) {
      event.preventDefault();
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowLeft':
          // Handle other arrow key operations
          this.handleArrowKeys(event);
          break;
        case 'ArrowUp':
          if (this.currentContent === 'explore' || this.currentContent === 'shots') {
            const element = this.scrollableContainer.nativeElement;
            element.scrollBy(0, -100);
          } else if (this.showPreview && this.selectedSummaryIdx > 0) {

            this.selectedSummaryIdx -= 1;
            this.displayVideoSummary();
          }
          break;
        case 'ArrowDown':
          if (this.currentContent === 'explore' || this.currentContent === 'shots') {
            const element = this.scrollableContainer.nativeElement;
            element.scrollBy(0, 100);
          } else if (this.showPreview && this.selectedSummaryIdx < this.summaries.length - 1) {
            this.selectedSummaryIdx += 1;
            this.displayVideoSummary();
          }
          break;
        case 'Tab':
          const contents: Array<'image' | 'thumbnail' | 'video' | 'shots' | 'explore'> = ['image', 'thumbnail', 'video', 'shots'];
          let currentIndex = contents.indexOf(this.currentContent as 'image' | 'thumbnail' | 'video' | 'shots' | 'explore'); // Ensure the type matches
          currentIndex = (currentIndex + 1) % contents.length; // Move to the next content, looping back to the start
          const nextContent = contents[currentIndex];
          console.log(currentIndex, nextContent);
          this.setContent(nextContent);
          this.currentContent = nextContent;
          break;
        case ' ':
          if (this.currentContent === 'explore') {
            this.loadMoreImages();
          } else if (this.currentContent === 'shots') {
            this.loadMoreShots();
          } else {
            this.showPreview = !this.showPreview;
            if (this.showPreview) this.showVideoPreview();
          }
          break;
        case 's':
          if (this.showPreview && this.currentContent != 'video') {
            this.submitResult(this.selectedItem);
          }
          break;
        case 'Shift':
          this.isShiftPressed = true;
          this.loadScrubbingVideo();
          break;
        default:
          if (this.isNumericKey(event.key) && !this.showPreview) {
            this.gotoPage(event.key);
          } else if (this.isNumericKey(event.key) && this.showPreview) {
            switch (event.key) {
              case '1':
                this.setContent('image');
                break;
              case '2':
                this.setContent('thumbnail');
                break;
              case '3':
                this.setContent('video');
                break;
              case '4':
                this.setContent('shots');
                break;
              case '5':
                this.setContent('explore');
                break;
              case '0':
                this.showVideoShots(this.queryresult_videoid[this.selectedItem], this.queryresult_frame[this.selectedItem])
                break;

            }
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
      } else {
        if (this.currentContent === 'explore') {
          if (key === 'ArrowRight' && this.columnsCountExplore < 5) {
            this.columnsCountExplore += 1;
          } else if (key === 'ArrowLeft' && this.columnsCountExplore > 1) {
            this.columnsCountExplore -= 1;
          }
        } else if (this.currentContent === 'shots') {
          if (key === 'ArrowRight' && this.columnsCountShots < 10) {
            this.columnsCountShots += 1;
          } else if (key === 'ArrowLeft' && this.columnsCountShots > 5) {
            this.columnsCountShots -= 1;
          }
        }
      }
    } else {
      let toShow = this.showPreview;
      if (key === 'ArrowRight') {
        this.selectedItem = this.selectedItem < this.queryresult_videoid.length - 1 ? this.selectedItem + 1 : !this.showPreview ? 0 : this.selectedItem;
      } else { // ArrowLeft
        this.selectedItem = this.selectedItem > 0 ? this.selectedItem - 1 : !this.showPreview ? this.queryresult_videoid.length - 1 : this.selectedItem;
      }
      if (toShow) {
        this.showVideoPreview();
      }
    }
  }

  @HostListener('wheel', ['$event'])
  handleScrollEvent(event: WheelEvent) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = window.setTimeout(() => {
      if (this.isOverImage) {
        event.preventDefault();
        // Your existing logic
        if (event.deltaY < 0) { // Scrolling up
          if (this.showPreview && this.selectedSummaryIdx > 0) {
            this.selectedSummaryIdx -= 1;
            this.displayVideoSummary();
          }
        } else if (event.deltaY > 0) { // Scrolling down
          if (this.showPreview && this.selectedSummaryIdx < this.summaries.length - 1) {
            this.selectedSummaryIdx += 1;
            this.displayVideoSummary();
          }
        }
      }
    }, 300); // Adjust the 300ms debounce time as needed
  }


  private isNumericKey(key: string): boolean {
    return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(key);
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

  filterSuggestions(): void {
    if (this.queryinput) {
      this.filteredSuggestions = this.suggestions.filter((action) =>
        action.toLowerCase().includes(this.queryinput.toLowerCase())
      );
    } else {
      this.filteredSuggestions = [];
    }
  }

  onInputChange(): void {
    if (this.selectedDataset === 'lhe' && this.selectedQueryType === 'predictions') {
      this.filterSuggestions();
    }
  }

  selectSuggestion(suggestion: string) {
    // Set the query input to the selected suggestion
    this.queryinput = suggestion;

    // Clear the filtered suggestions list after selecting a suggestion
    this.filteredSuggestions = [];
  }


  onQueryInputFocus() {
    this.queryFieldHasFocus = true;
    if (this.selectedDataset === 'lhe' && this.selectedQueryType === 'predictions') {
      this.filterSuggestions();
    }
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
    this.displayVideoSummary();
    this.requestVideoSummaries(this.queryresult_videoid[this.selectedItem]);

    //query event logging
    let queryEvent: QueryEvent = {
      timestamp: Date.now(),
      category: QueryEventCategory.BROWSING,
      type: "videosummary",
      value: this.queryresult_videoid[this.selectedItem]
    }
    this.vbsService.queryEvents.push(queryEvent);
    //this.vbsService.submitQueryResultLog('interaction');

    if (this.currentContent === 'explore') {
      this.loadExploreImages(this.queryresult_videoid[this.selectedItem]);
    } else if (this.currentContent === 'shots') {
      this.loadShotList(this.queryresult_videoid[this.selectedItem]);
    }
  }

  closeVideoPreview() {
    //this.videopreview.nativeElement.style.display = 'none';
    this.showPreview = false;
    this.selectedSummaryIdx = 0;
    this.videoSummaryPreview = '';
    this.videoLargePreview = '';
    this.videoPlayPreview = '';
    this.videoExplorePreview = [];
  }

  setContent(content: 'image' | 'thumbnail' | 'video' | 'shots' | 'explore') {
    this.currentContent = content;
    this.activeButton = content;

    /* c */

    this.showVideoPreview();
  }

  loadExploreImages(videoid: string) {
    let msg = {
      dataset: 'v3c',
      type: "clusterimage",
      query: videoid,
      clientId: "direct"
    };

    console.log('ec: queryClusterForImages: ' + videoid);

    if (this.nodeService.connectionState == WSServerStatus.CONNECTED) {
      console.log("ec: sent message to node-server: " + msg);
      let message = {
        source: 'appcomponent',
        content: msg
      };
      this.nodeService.messages.next(message);
    }
  }

  loadShotList(videoid: string) {
    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
      let msg = {
        type: "videoinfo",
        videoid: videoid
      };
      this.sendToNodeServer(msg);
    } else {
      alert(`Node.js connection down: ${this.nodeService.connectionState}. Try reconnecting by pressing the red button!`);
    }
  }

  exploreToShotlist(explorationUrl: string) {
    let videoId: string = "";
    const url = new URL(explorationUrl);
    const paths = url.pathname.split('/');
    const summariesXLIndex = paths.indexOf('summaries');
    if (summariesXLIndex !== -1 && summariesXLIndex + 1 < paths.length) {
      videoId = paths[summariesXLIndex + 2];
    }
    console.log("Browsing to: " + videoId)
    this.showVideoShots(videoId, '1');
  }

  shotPreviewToShotList(previewurl: string) {
    const url = new URL(previewurl);
    const paths = url.pathname.split('/');
    const [videoid, frame_with_extension] = paths[paths.length - 1].split('_');
    const frame_number = frame_with_extension.split('.')[0];

    this.showVideoShots(videoid, frame_number);
  }

  showVideoShots(videoid: string, frame: string) {
    //this.router.navigate(['video',videoid,frame]); //or navigateByUrl(`/video/${videoid}`)
    window.open('video/' + videoid + '/' + frame, '_blank');
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

  getTimeInSecondsFor(i: number): number {
    let fps = this.queryresult_fps.get(this.queryresult_videoid[i]);
    if (fps !== undefined) {
      // Calculate time in seconds based on frame and FPS
      return parseFloat(this.queryresult_frame[i]) / fps;
    } else {
      return 0; // Default start time
    }
  }

  resetPageAndPerformQuery() {
    //this.selectedQueryType = 'textquery';
    if (this.selectedQueryType !== 'textquery') {
      this.temporalQueries = [];
    }
    this.selectedPage = '1';
    this.performTextQuery();
  }

  resetQuery() {
    this.queryinput = '';
    this.temporalQueries = [];
    this.inputfield.nativeElement.focus();
    this.inputfield.nativeElement.select();
    this.file_sim_keyframe = undefined
    this.file_sim_pathPrefix = undefined
    this.previousQuery = undefined
    this.selectedPage = '1';
    this.selectedDataset = 'default';
    this.selectedVideoFiltering = 'all';
    this.pages = ['1'];
    this.clearResultArrays();

    let message = {
      type: 'resetsubmission'
    }
    this.sendToNodeServer(message);
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

    let querySubmission = this.queryinput;

    if (this.temporalQueries.length > 0) {
      //concatenate all input fields with "<"
      let combinedQuery = querySubmission;

      for (let query of this.temporalQueries) {
        combinedQuery += "<" + query.query;
      }
      querySubmission = combinedQuery;
    }

    this.showHelpActive = false;
    this.showHistoryActive = false;
    this.showPreview = false;

    if (this.clipService.connectionState === WSServerStatus.CONNECTED ||
      this.nodeService.connectionState === WSServerStatus.CONNECTED) {

      this.nodeServerInfo = "processing query, please wait...";

      if (this.previousQuery !== undefined && this.previousQuery.type === 'textquery' && this.previousQuery.query !== this.queryinput) {
        this.selectedPage = '1';
      }

      console.log('qc: query for', querySubmission + " videofiltering=" + this.selectedVideoFiltering + " and " + this.queryType);
      this.queryBaseURL = this.getBaseURL();
      let msg = {
        type: "textquery",
        clientId: "direct",
        query: querySubmission,
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
        console.log('qc: send to node-server: ' + msg);
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
        value: querySubmission
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

    let keyframe_file_ending = keyframe.split('.')[0] + '.' + this.globalConstants.imageFileExtension;

    window.open('filesimilarity/' + encodeURIComponent(keyframe_file_ending) + '/' + this.selectedDataset + '/' + encodeURIComponent(this.datasetBase) + '/' + selectedPage, target);
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

  performHistoryQuery(hist: QueryType): void {
    this.queryinput = hist.query;
    this.selectedDataset = hist.dataset;
    this.selectedQueryType = hist.type;
    this.selectedVideoFiltering = hist.videofiltering;
    this.selectedPage = hist.selectedpage;
    this.previousQuery = undefined;
    this.file_sim_keyframe = undefined;
    this.file_sim_pathPrefix = undefined;
    this.performQuery(false);

    let queryEvent: QueryEvent = {
      timestamp: Date.now(),
      category: QueryEventCategory.OTHER,
      type: "historyquery",
      value: hist.query
    }
    this.vbsService.queryEvents.push(queryEvent);
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
    if (qresults.totalresults === 0) {
      this.nodeServerInfo = 'The query returned 0 results!';
    }

    this.totalReturnedResults = qresults.totalresults; //totally existing results

    //create pages array
    this.pages = [];
    if (qresults.totalresults < this.globalConstants.resultsPerPage || qresults.type === 'videoid' || qresults.type === 'metadata' || qresults.type === 'speech') {
      console.log("total results: " + this.totalReturnedResults + " results per page: " + this.globalConstants.resultsPerPage + " pages: " + this.totalReturnedResults / this.globalConstants.resultsPerPage)

      this.pages.push('1');
    } else {
      console.log("total results: " + this.totalReturnedResults + " results per page: " + this.globalConstants.resultsPerPage + " pages: " + this.totalReturnedResults / this.globalConstants.resultsPerPage)
      for (let i = 1; i <= Math.ceil(this.totalReturnedResults / this.globalConstants.resultsPerPage); i++) {
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

    this.submittedFrame = videoid;

    if (this.currentContent === 'video' && this.showPreview) { //Check if currently in video preview (to submit time instead of frame)
      let videoElement = this.videopreview.nativeElement;
      let currentTime = videoElement.currentTime;
      let fps = this.queryresult_fps.get(videoid);
      let frame = Math.floor(currentTime * fps!);

      frameNumber = frame.toString();
    }

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
      this.vbsService.submitFrame(videoid, parseInt(frameNumber), response.fps, response.duration, this.selectedDataset);

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

  markFrameAsSubmitted(videoid: string) {
    this.submittedStatus[videoid] = true;

    let submittedFrames = JSON.parse(localStorage.getItem('submittedFrames') || '[]');
    if (!submittedFrames.includes(videoid)) {
      submittedFrames.push(videoid);
      localStorage.setItem('submittedFrames', JSON.stringify(submittedFrames));
    }
  }

  isVideoSubmitted(keyframe: string): boolean {
    const videoid = keyframe.split('/')[0];
    const submittedVideoIds = JSON.parse(localStorage.getItem('submittedFrames') || '[]');
    return submittedVideoIds.includes(videoid);
  }

  get displayQueryResult() {
    if (this.globalConstants.showSubmittedFrames) {
      return this.queryresults;
    } else {
      return this.queryresults.filter(item => !this.isVideoSubmitted(item));
    }
  }
}
