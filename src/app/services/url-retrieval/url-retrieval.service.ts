import { Injectable } from '@angular/core';
import { GlobalConstantsService } from 'src/app/shared/config/services/global-constants.service';

@Injectable({
  providedIn: 'root'
})
export class UrlRetrievalService {
  private baseThumbsUrl: string = '';
  private baseVideosUrl: string = '';

  constructor(    
      private globalConstants: GlobalConstantsService,
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
  
  getVideoUrl(videoId: string) {
    return `${this.baseVideosUrl}${videoId}.mp4`;
  }
}
