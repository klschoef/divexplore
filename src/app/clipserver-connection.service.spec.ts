import { TestBed } from '@angular/core/testing';

import { ClipServerConnectionService } from './clipserver-connection.service';

describe('ClipserverConnectionService', () => {
  let service: ClipServerConnectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClipServerConnectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
