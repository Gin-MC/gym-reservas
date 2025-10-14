import { Component, inject, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Class } from '../../interfaces/class.interface';
import { ClassesService } from '../../services/classes';

@Component({
  selector: 'app-class-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './class-form-dialog.html',
  styleUrl: './class-form-dialog.css'
})
export class ClassFormDialog implements OnInit {
  private fb = inject(FormBuilder);
  private classesService = inject(ClassesService);
  private dialogRef = inject(MatDialogRef<ClassFormDialog>);

  classForm: FormGroup;
  loading = false;
  isEditMode = false;
  errorMessage = '';

  // Opciones para los selects
  categories = [
    { value: 'yoga', label: 'Yoga', icon: '🧘' },
    { value: 'spinning', label: 'Spinning', icon: '🚴' },
    { value: 'pesas', label: 'Pesas', icon: '🏋️' },
    { value: 'funcional', label: 'Funcional', icon: '💪' },
    { value: 'crossfit', label: 'CrossFit', icon: '⚡' }
  ];

  instructors = [
    'Ana García',
    'Carlos Ruiz',
    'María López',
    'Roberto Silva',
    'Laura Martínez',
    'Diego Fernández'
  ];

  // Generar horarios cada 30 minutos
  timeSlots: string[] = [];
  // Fecha mínima (hoy)
  minDate = new Date();

  constructor(@Inject(MAT_DIALOG_DATA) public data: { class?: Class }) {
    this.isEditMode = !!data?.class;
    
    // Generar horarios
    this.generateTimeSlots();

    // Inicializar formulario
    this.classForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      instructor: ['', Validators.required],
      date: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      totalSpots: ['', [Validators.required, Validators.min(1), Validators.max(50)]],
      category: ['', Validators.required],
      icon: ['', Validators.required]
    });

    // Escuchar cambios en categoría para actualizar el icono
    this.classForm.get('category')?.valueChanges.subscribe(category => {
      const selectedCategory = this.categories.find(c => c.value === category);
      if (selectedCategory) {
        this.classForm.patchValue({ icon: selectedCategory.icon }, { emitEvent: false });
      }
    });
  }

  ngOnInit() {
    // Si es modo edición, cargar datos
    if (this.isEditMode && this.data.class) {
      const classData = this.data.class;
      this.classForm.patchValue({
        name: classData.name,
        description: classData.description,
        instructor: classData.instructor,
        date: classData.date,
        startTime: classData.startTime,
        endTime: classData.endTime,
        totalSpots: classData.totalSpots,
        category: classData.category,
        icon: classData.icon
      });
    }
  }

  generateTimeSlots() {
    for (let hour = 6; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        this.timeSlots.push(time);
      }
    }
  }

  async onSubmit() {
    if (this.classForm.invalid) {
      this.markFormGroupTouched(this.classForm);
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const formValue = this.classForm.value;

    if (this.isEditMode && this.data.class) {
      // Actualizar clase existente
      const updateData: Partial<Class> = {
        name: formValue.name,
        description: formValue.description,
        instructor: formValue.instructor,
        date: formValue.date,
        startTime: formValue.startTime,
        endTime: formValue.endTime,
        totalSpots: formValue.totalSpots,
        category: formValue.category,
        icon: formValue.icon,
        // Recalcular disponibles
        availableSpots: formValue.totalSpots - this.data.class.reservedSpots
      };

      const result = await this.classesService.updateClass(this.data.class.id!, updateData);

      this.loading = false;

      if (result.success) {
        this.dialogRef.close({ success: true, action: 'update' });
      } else {
        this.errorMessage = result.error || 'Error al actualizar la clase';
      }
    } else {
      // Crear nueva clase
      const newClass: Omit<Class, 'id'> = {
        name: formValue.name,
        description: formValue.description,
        instructor: formValue.instructor,
        date: formValue.date,
        startTime: formValue.startTime,
        endTime: formValue.endTime,
        totalSpots: formValue.totalSpots,
        reservedSpots: 0,
        availableSpots: formValue.totalSpots,
        status: 'active',
        category: formValue.category,
        icon: formValue.icon
      };

      const result = await this.classesService.createClass(newClass);

      this.loading = false;

      if (result.success) {
        this.dialogRef.close({ success: true, action: 'create' });
      } else {
        this.errorMessage = result.error || 'Error al crear la clase';
      }
    }
  }

  onCancel() {
    this.dialogRef.close({ success: false });
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(field: string): string {
    const control = this.classForm.get(field);

    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }
    if (control?.hasError('min')) {
      return 'El valor debe ser mayor a 0';
    }
    if (control?.hasError('max')) {
      return 'El valor máximo es 50';
    }

    return '';
  }
}