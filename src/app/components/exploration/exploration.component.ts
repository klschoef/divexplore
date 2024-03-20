import { Component } from '@angular/core';
import { HostListener } from '@angular/core';
import { VBSServerConnectionService } from '../../services/vbsserver-connection/vbsserver-connection.service';
import { VbsServiceCommunication } from '../../shared/interfaces/vbs-task-interface';
import { NodeServerConnectionService } from '../../services/nodeserver-connection/nodeserver-connection.service';
import { ActivatedRoute, Router } from '@angular/router';
import { GlobalConstants, WSServerStatus } from '../../shared/config/global-constants';
import { ClipServerConnectionService } from '../../services/clipserver-connection/clipserver-connection.service';
import { Title } from '@angular/platform-browser';
//import { MatInputModule, MatAutocompleteModule, MatFormFieldModule } from '@angular/material';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

//import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { GlobalConstantsService } from '../../shared/config/services/global-constants.service';

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
    private router: Router,
    private globalConstants: GlobalConstantsService) {
  }

  sandbox = "allow-scripts"

  ngOnInit() {

    this.summariesBase = this.globalConstants.summariesBaseURL; //GlobalConstants.summariesBaseURL;

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
        if (this.selectedSummary < this.summaries.length - 1) {
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

  queryCluster(clusterid: string) {
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

  sendToNodeServer(msg: any) {
    let message = {
      source: 'appcomponent',
      content: msg
    };
    this.nodeService.messages.next(message);
  }

  showVideoShots(summary: string) {
    let videoid = summary.substring(0, summary.indexOf('/'));
    //this.router.navigate(['video',videoid,frame]); //or navigateByUrl(`/video/${videoid}`)
    window.open('video/' + videoid + '/1', '_blank');
  }

  selectRun() {

  }
}
