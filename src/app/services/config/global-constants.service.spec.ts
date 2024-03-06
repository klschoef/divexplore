import { TestBed } from '@angular/core/testing';

import { GlobalConstantsService } from './global-constants.service';

describe('GlobalConstantsService', () => {
  let service: GlobalConstantsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GlobalConstantsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
