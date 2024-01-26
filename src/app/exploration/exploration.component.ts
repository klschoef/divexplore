import { Component } from '@angular/core';
import { HostListener } from '@angular/core';
import { VBSServerConnectionService, VbsServiceCommunication } from '../vbsserver-connection.service';
import { NodeServerConnectionService } from '../nodeserver-connection.service';
import { ActivatedRoute, Router } from '@angular/router';
import { GlobalConstants, WSServerStatus } from '../global-constants';
import { ClipServerConnectionService } from '../clipserver-connection.service';
import { Title } from '@angular/platform-browser';
//import { MatInputModule, MatAutocompleteModule, MatFormFieldModule } from '@angular/material';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

//import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

interface Link {
  title: string;
  url: string;
  content: string;
}

interface Cluster {
  cluster_id: string;
  name: string; 
  count: number; 
  members: [string]; 
}



@Component({
  selector: 'app-exploration',
  templateUrl: './exploration.component.html',
  styleUrls: ['./exploration.component.scss']
})
export class ExplorationComponent implements VbsServiceCommunication {
  links: Link[] = [
    { title: 'cluster0', url: 'cluster0.html', content: '<h1>Cluster 0 (1 items)</h1><a href="cluster-1.html">prev</a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="cluster1.html">next</a></br><div id="container"><img class="image" src="https://divexplore.itec.aau.at/summaries/07787/07787_summary_1_1_1_1.jpg"><img class="zoom" src="https://divexplore.itec.aau.at/summaries/07787/07787_summary_1_1_1_1.jpg"><a href="localhost:4200/video/07787">07787</a><br/></div>'},
    { title: 'cluster1', url: 'http://www.orf.at/', content: '' },
    { title: 'cluster2', url: 'cluster/cluster2.html', content: '' },
    { title: 'cluster3', url: './cluster/cluster3.html', content: '' },
    { title: 'cluster4', url: './cluster/cluster4.html', content: '' },
    { title: 'cluster5', url: './cluster/cluster5.html', content: '' },
    { title: 'cluster6', url: './cluster/cluster6.html', content: '' },
    { title: 'cluster7', url: './cluster/cluster7.html', content: '' },
    { title: 'cluster8', url: './cluster/cluster8.html', content: '' },
    { title: 'cluster9', url: './cluster/cluster9.html', content: '' },
    { title: 'cluster10', url: './cluster/cluster10.html', content: '' }
  ];
  selectedLink: Link | undefined;
  localPageHtml: String | undefined;

  nodeServerInfo: string | undefined;

  selectedServerRun: string | undefined;
  public statusTaskInfoText: string = ""; //property binding
  statusTaskRemainingTime: string = ""; //property binding
  summariesBase: string | undefined;

  clusters: Array<Cluster> = [];
  summaries: Array<string> = [];

  itemCtrl = new FormControl();
  filteredItems: Observable<Cluster[]> | undefined;

  showClusterList = false;
  selectedSummary = -1;
  showZoomedSummary = false;

  constructor(
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService,
    private titleService: Title, 
    private route: ActivatedRoute,
    private router: Router) {
  }

  onSelectLink(link: Link) {
    this.selectedLink = link;
    /*this.http.get(link.url, { responseType: 'text' }).subscribe(html => {
      this.localPageHtml = html;
    });*/
  }
  sandbox="allow-scripts"


  ngOnInit() {
    
    this.summariesBase = GlobalConstants.summariesBaseURL;

    //already connected?
    if (this.nodeService.connectionState == WSServerStatus.CONNECTED) {
      console.log('ec: node-service already connected');
    } else {
      console.log('ec: node-service not connected yet');
    }

    this.nodeService.messages.subscribe(msg => {
      this.nodeServerInfo = undefined; 

      if ('wsstatus' in msg) { 
        console.log('ec: node-notification: connected');
      } else {
        //let result = msg.content;
        console.log("ec: response from node-server: " + msg);
        let m = JSON.parse(JSON.stringify(msg));
        console.log(m);
        if (m.type === 'clusters') {
          this.clusters = m.results;
          this.filteredItems = this.itemCtrl.valueChanges.pipe(
            startWith(''),
            map(item => this._filterItems(item))
          );
        } else if (m.type === 'cluster') {
          this.summaries = m.results;
        }
      }
    });

    //repeatedly retrieve task info
    setInterval(() => {
      this.requestTaskInfo();
    }, 1000);

    //get all clusters with delay (of one second)
    setTimeout(() => {
      this.queryAllClusters();
    }, 1000);
  }

  private _filterItems(value: string): Cluster[] {
    const filterValue = value.toLowerCase();
    return this.clusters.filter(item => item.name.toLowerCase().includes(filterValue));
  }


  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) { 
    if (event.key == 'ArrowRight' || event.key == 'Tab') {
      if (this.showZoomedSummary) {
        if (this.selectedSummary < this.summaries.length-1) {
          this.selectedSummary += 1;
        }
        event.preventDefault(); 
      }
    } else if (event.key == "ArrowLeft") {
      if (this.showZoomedSummary) {
        if (this.selectedSummary > 0) {
          this.selectedSummary -= 1;
        }
        event.preventDefault(); 
      } 
    } else if (event.key == 'Space' || event.key == ' ') {
      this.showZoomedSummary = !this.showZoomedSummary;
      if (this.showZoomedSummary) {
        window.scrollTo(0, 0);
      }
      event.preventDefault();
    } else if (event.key == 'Escape') {
      this.showZoomedSummary = false;
      event.preventDefault();
    } else if (event.key === 'v' && this.showZoomedSummary) {
      this.showVideoShots(this.summaries[this.selectedSummary]);
    } 
  }

  requestTaskInfo() {
    this.vbsService.getClientTaskInfo(this.vbsService.serverRunIDs[this.vbsService.selectedServerRun!], this);
  }

  queryAllClusters() {
    let msg = { 
      dataset: 'v3c', 
      type: "clusters", 
      clientId: "direct"
    };

    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
      this.sendToNodeServer(msg);
    } 
  }

  displayFn(cluster?: Cluster): string {
    return cluster && cluster.name ? cluster.name : '';
  }
  
  selectSummary(idx: number) {
    this.selectedSummary = idx;
    this.showZoomedSummary = true;
    window.scrollTo(0, 0);
  }

  closeSummary() {
    this.showZoomedSummary = false;
  }

  queryClusterFromSelectBox(event: any) {
    console.log('selected: ' + event.option.value.name);
    this.queryCluster(event.option.value.cluster_id);
  }

  queryCluster(clusterid:string) {
    let msg = { 
      dataset: 'v3c', 
      type: "cluster",
      query: clusterid, 
      clientId: "direct"
    };

    if (this.nodeService.connectionState === WSServerStatus.CONNECTED) {
      this.showClusterList = false;
      this.sendToNodeServer(msg);
    } 
  }

  showHideClusterList() {
    this.showClusterList = !this.showClusterList;
  }

  sendToNodeServer(msg:any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.nodeService.messages.next(message);
  }

  showVideoShots(summary:string) {
    let videoid = summary.substring(0, summary.indexOf('/'));
    //this.router.navigate(['video',videoid,frame]); //or navigateByUrl(`/video/${videoid}`)
    window.open('video/' + videoid + '/1', '_blank');
  }

  selectRun() {

  }
}
