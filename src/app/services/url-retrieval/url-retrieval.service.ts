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
