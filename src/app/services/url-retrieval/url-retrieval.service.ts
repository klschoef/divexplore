import { Injectable } from '@angular/core';
import { GlobalConstantsService } from 'src/app/shared/config/services/global-constants.service';
import { NodeServerConnectionService } from '../nodeserver-connection/nodeserver-connection.service';
import { WSServerStatus } from 'src/app/shared/config/global-constants';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UrlRetrievalService {
  private baseThumbsUrl: string = '';
  private baseVideosUrl: string = '';
  private explorationSubscription: any;
  nodeServerInfo: string | undefined;

  private explorationResultsSource = new BehaviorSubject<Array<string>>([]);
  public explorationResults$ = this.explorationResultsSource.asObservable();

  explorationResults: Array<string> = [];

  constructor(
    private globalConstants: GlobalConstantsService,
    public nodeService: NodeServerConnectionService
  ) {
    this.baseThumbsUrl = this.globalConstants.thumbsBaseURL;
    this.baseVideosUrl = this.globalConstants.videosBaseURL;

    if (this.nodeService.connectionState == WSServerStatus.CONNECTED) {
      console.log('ec: node-service already connected');
    } else {
      console.log('ec: node-service not connected yet');
    }
  }

  getExplorationUrls(videoId: string) {
    this.explorationSubscription = this.nodeService.messages.subscribe(msg => {
      this.nodeServerInfo = undefined;

      if ('wsstatus' in msg) {
        console.log('ec: node-service connected');
      } else {
        let m = JSON.parse(JSON.stringify(msg));
        console.log(m);
        if (m.type === 'clusterimage') {
          const resultsArray: Array<string> = m.results
          const updatedResults = resultsArray.map(image => this.globalConstants.summariesBaseURL + '/' + image);
          this.explorationResultsSource.next(updatedResults);
        }
      }
    });

    let msg = {
      dataset: 'v3c',
      type: "clusterimage",
      query: videoId,
      clientId: "direct"
    };

    console.log('ec: queryClusterForImages: ' + videoId);

    if (this.nodeService.connectionState == WSServerStatus.CONNECTED) {
      console.log("ec: sent message to node-server: " + msg);
      let message = {
        source: 'appcomponent',
        content: msg
      };
      this.nodeService.messages.next(message);
    }
  }

  getThumbnailUrl(videoId: string, frame: string) {
    return `${this.baseThumbsUrl}${videoId}/${videoId}_${frame}.jpg`;
  }

  getPreviewSummaryUrl(summaries: string) {
    return this.globalConstants.dataHost + '/' + summaries;
  }

  getPreviewSummaryLargeUrl(summaries: string) {
    return this.globalConstants.summariesLargeBaseUrl + '/' + summaries;
  }

  getVideoUrl(videoId: string) {
    return `${this.baseVideosUrl}${videoId}.mp4`;
  }
}
