import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShotlistComponent } from './shotlist.component';

describe('ShotlistComponent', () => {
  let component: ShotlistComponent;
  let fixture: ComponentFixture<ShotlistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShotlistComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShotlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
