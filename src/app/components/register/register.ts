import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/authService';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  registerForm: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;
  loading = false;
  errorMessage = '';

  constructor() {
    this.registerForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required, 
        Validators.minLength(6),
        this.strongPasswordValidator()
      ]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validator: this.passwordMatchValidator.bind(this)
    });

    // Escuchar cambios en password para revalidar confirmPassword
    this.registerForm.get('password')?.valueChanges.subscribe(() => {
      this.registerForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  // Validador de contraseña fuerte
  strongPasswordValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;

      if (!value) {
        return null;
      }

      const hasLetter = /[a-zA-Z]/.test(value);
      const hasNumber = /[0-9]/.test(value);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);

      const passwordValid = hasLetter && hasNumber && hasSpecialChar;

      return !passwordValid ? {
        strongPassword: {
          hasLetter,
          hasNumber,
          hasSpecialChar
        }
      } : null;
    };
  }

  // Validador para verificar que las contraseñas coincidan
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    if (confirmPassword.errors && !confirmPassword.errors['passwordMismatch']) {
      return null;
    }

    if (password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      confirmPassword.setErrors(null);
      return null;
    }
  }

  async onSubmit() {
    if (this.registerForm.valid) {
      this.loading = true;
      this.errorMessage = '';

      const { displayName, email, password } = this.registerForm.value;
      const result = await this.authService.register(email, password, displayName);

      this.loading = false;

      if (!result.success) {
        this.errorMessage = result.error || 'Error al registrarse';
      }
    } else {
      this.markFormGroupTouched(this.registerForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(field: string): string {
    const control = this.registerForm.get(field);
    
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('email')) {
      return 'Email inválido';
    }
    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }
    
    // Error de contraseña fuerte
    if (field === 'password' && control?.hasError('strongPassword')) {
      const errors = control.errors?.['strongPassword'];
      const missing = [];
      
      if (!errors.hasLetter) missing.push('letras');
      if (!errors.hasNumber) missing.push('números');
      if (!errors.hasSpecialChar) missing.push('caracteres especiales (!@#$%^&*)');
      
      return `La contraseña debe contener: ${missing.join(', ')}`;
    }
    
    // Error de coincidencia de contraseñas
    if (field === 'confirmPassword') {
      const confirmPassword = this.registerForm.get('confirmPassword');
      if (confirmPassword?.errors?.['passwordMismatch']) {
        return 'Las contraseñas no coinciden';
      }
    }
    
    return '';
  }

  // Método para verificar si hay error de coincidencia
  hasPasswordMismatch(): boolean {
    const confirmPassword = this.registerForm.get('confirmPassword');
    return confirmPassword?.touched === true && this.registerForm.hasError('passwordMismatch');
  }
}