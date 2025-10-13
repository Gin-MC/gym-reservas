import { TestBed } from '@angular/core/testing';

import { Reservations } from './reservations';

describe('Reservations', () => {
  let service: Reservations;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Reservations);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
