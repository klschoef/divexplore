import { ViewChild,ElementRef,Component, AfterViewInit } from '@angular/core';
import { HostListener } from '@angular/core';
import { GlobalConstants, WebSocketEvent } from './global-constants';
import { mdiImageSizeSelectSmall } from '@mdi/js';
import { mdiImageSizeSelectLarge } from '@mdi/js';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})


export class AppComponent implements AfterViewInit {

  @ViewChild('inputfield') inputfield!: ElementRef<HTMLInputElement>;

  title = 'divexplore';
  clipSocketWorker: Worker | undefined;
  clipSocketWorkerState: WebSocketEvent | undefined;
  queryinput: string = '';
  queryresults: Array<string> = [];
  queryresult_ids: Array<string> = [];
  queryresult_num: Array<string> = [];
  maxresults = GlobalConstants.maxResultsToReturn; 
  totalReturnedResults = 0; //how many results did our query return in total?
  resultsPerPage = GlobalConstants.resultsPerPage; 
  selectedPage = '1'; //user-selected page
  pages = ['1']
  thumbSize = 'small';
  selectedDataset = 'v3c-v';
  queryFieldHasFocus = false;
  datasets = [
    {id: 'v3c-v', name: 'Videos: V3C'},
    {id: 'v3c-s', name: 'Shots: V3C'},
    {id: 'marine-v', name: 'Videos: Marine'}, 
    {id: 'marine-s', name: 'Shots: Marine'}
  ];
    
  
  ngOnInit() {
    this.openWebSocketCLIP();
  }

  ngAfterViewInit(): void {
  }

  @HostListener('document:keyup', ['$event'])
  handleKeyboardEventUp(event: KeyboardEvent) { 
    if (this.queryFieldHasFocus == false) {
      if (event.key == 'q') {
        this.inputfield.nativeElement.select();
      } else if (event.key == 'x') {
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

  onQueryInputFocus() {
    this.queryFieldHasFocus = true;
  }

  onQueryInputBlur() {
    this.queryFieldHasFocus = false;
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
 
  performQuery() {
    console.log(this.clipSocketWorkerState);
    if (this.clipSocketWorker !== undefined && this.clipSocketWorkerState == WebSocketEvent.OPEN) {
      console.log('query for', this.queryinput);
      let msg = { 
        type: "textquery", 
        query: this.queryinput,
        maxresults: this.maxresults,
        resultsperpage: this.resultsPerPage, 
        selectedpage: this.selectedPage, 
        dataset: this.selectedDataset
      };
      this.clipSocketWorker.postMessage({ event: WebSocketEvent.MESSAGE, content: msg });
      //this.clipSocketWorker.send(JSON.stringify(event));
    } else {
      alert(`Connection down / worker issue sate=${this.clipSocketWorkerState}. Try to manually re-connect, please!`);
    }
  }

  resetQuery() {
    this.queryinput = '';
    this.inputfield.nativeElement.focus();
    this.inputfield.nativeElement.select();
    this.selectedPage = '1';
    this.pages = ['1'];
    this.queryresults = [];
    this.queryresult_ids = [];
    this.queryresult_num = [];
  }

  getBaseURL() {
    if (this.selectedDataset == 'marine-v') {
      return GlobalConstants.keyframeBaseURLMarine_Summaries; //XL 
    }
    else if (this.selectedDataset == 'v3c-v') {
      return GlobalConstants.keyframeBaseURLV3C_Summaries; //XL
    }
    if (this.selectedDataset == 'marine-s') {
      return GlobalConstants.keyframeBaseURLMarine_Shots; 
    }
    else if (this.selectedDataset == 'v3c-s') {
      return GlobalConstants.keyframeBaseURLV3C_Shots;
    }
    else 
    return '';
  }

  getIDPartNums() {
    if (this.selectedDataset == 'marine-v' || this.selectedDataset == 'marine-s') {
      return 3; 
    }
    else { //if (this.selectedDataset == 'v3c-v' || this.selectedDataset == 'v3c-v') {
      return 1;
    }
  }

  checkCLIPConnection() {
    if (this.clipSocketWorkerState != WebSocketEvent.OPEN) {
      this.openWebSocketCLIP();
    }
  }

  openWebSocketCLIP() {
    if (typeof Worker !== 'undefined') {
      // Create a new worker
      this.clipSocketWorker = new Worker(new URL('./wsclip.worker', import.meta.url));

      // messages from the worker
      this.clipSocketWorker.onmessage = ({ data }) => {
        console.log(`page got message: ${data}`);
        if (data.event === WebSocketEvent.OPEN) {
          this.clipSocketWorkerState = WebSocketEvent.OPEN;
        } 
        else if (data.event === WebSocketEvent.CLOSE) {
          this.clipSocketWorkerState = WebSocketEvent.CLOSE;
        }
        else if (data.event === WebSocketEvent.ERROR) {
          this.clipSocketWorkerState = WebSocketEvent.ERROR;
        }
        else if (data.event === WebSocketEvent.MESSAGE) {
          console.log(data.event);
          //console.log(data.content);
          let keyframeBaseURL = this.getBaseURL();
          let underscorePositionID = this.getIDPartNums();

          let qresults = JSON.parse(data.content);
          this.totalReturnedResults = qresults.totalresults; //totally existing results
          //create pages array
          this.pages = [];
          for (let i = 1; i < this.totalReturnedResults / this.resultsPerPage; i++) {
            this.pages.push(i.toString());
          }
          //populate images
          this.queryresults = [];
          this.queryresult_ids = [];
          this.queryresult_num = [];
          let num = (parseInt(this.selectedPage) - 1) * this.resultsPerPage + 1;
          for (var e of qresults.results) {
            this.queryresults.push(keyframeBaseURL + e);
            //this.queryresult_ids.push(e.split('_',underscorePositionID).join('_'));
            this.queryresult_ids.push(e.split('/',1)[0]);
            this.queryresult_num.push(num.toString());
            num++;
          }

          this.inputfield.nativeElement.blur();
          
        }
      };
      this.clipSocketWorker.postMessage({ event: WebSocketEvent.OPEN });
    } else {
      // Web Workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
      console.log('web workers are not supported');
    }
  }

  closeWebSocketCLIP() {
    this.clipSocketWorker?.postMessage({ event: WebSocketEvent.CLOSE });
  }


}

