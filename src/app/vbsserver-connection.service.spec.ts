import { TestBed } from '@angular/core/testing';

import { VBSServerConnectionService } from './vbsserver-connection.service';

describe('VBSServerConnectionService', () => {
  let service: VBSServerConnectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VBSServerConnectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
