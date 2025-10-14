import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassFormDialog } from './class-form-dialog';

describe('ClassFormDialog', () => {
  let component: ClassFormDialog;
  let fixture: ComponentFixture<ClassFormDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassFormDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
