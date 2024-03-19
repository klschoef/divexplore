import { TestBed } from '@angular/core/testing';

import { UrlRetrievalService } from './url-retrieval.service';

describe('UrlRetrievalService', () => {
  let service: UrlRetrievalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UrlRetrievalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
