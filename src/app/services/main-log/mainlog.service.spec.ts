import { TestBed } from '@angular/core/testing';

import { MainlogService } from './mainlog.service';

describe('MainlogService', () => {
  let service: MainlogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MainlogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
