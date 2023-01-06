import { TestBed } from '@angular/core/testing';

import { NodeServerConnectionService } from './nodeserver-connection.service';

describe('NodeserverConnectionService', () => {
  let service: NodeServerConnectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NodeServerConnectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
