import { TestBed } from '@angular/core/testing';

import { DresConnectionService } from './dres-connection.service';

describe('VBSServerConnectionService', () => {
  let service: DresConnectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DresConnectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
