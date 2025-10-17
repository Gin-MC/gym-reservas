import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../services/authService';
import { ReservationsService } from '../../services/reservations';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { Auth, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from '@angular/fire/auth';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSnackBarModule,
    MatTabsModule
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {
  private fb = inject(FormBuilder);
  public authService = inject(AuthService);//Revisar aqui
  private reservationsService = inject(ReservationsService);
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  profileForm: FormGroup;
  passwordForm: FormGroup;

  loadingProfile = false;
  loadingPassword = false;
  loadingStats = true;

  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  // Usuario actual
  currentUser = this.authService.currentUser();

  // Estadísticas
  stats = {
    totalReservations: 0,
    upcomingReservations: 0,
    completedReservations: 0,
    cancelledReservations: 0,
    memberSince: '',
    lastConnection: ''
  };

  constructor() {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
    }

    // Formulario de perfil
    this.profileForm = this.fb.group({
      displayName: [this.currentUser?.displayName || '', [Validators.required, Validators.minLength(3)]],
      email: [{ value: this.currentUser?.email || '', disabled: true }]
    });

    // Formulario de cambio de contraseña
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  async ngOnInit() {
    await this.loadStatistics();
  }

  async loadStatistics() {
    this.loadingStats = true;

    if (!this.currentUser) return;

    try {
      const reservations = await this.reservationsService.getUserReservations(this.currentUser.uid);
      const now = new Date();

      this.stats.totalReservations = reservations.length;
      this.stats.upcomingReservations = reservations.filter(r => 
        r.status === 'confirmed' && r.classDate >= now
      ).length;
      this.stats.completedReservations = reservations.filter(r => 
        r.status === 'completed' || (r.status === 'confirmed' && r.classDate < now)
      ).length;
      this.stats.cancelledReservations = reservations.filter(r => 
        r.status === 'cancelled'
      ).length;

      // Fecha de registro
      if (this.currentUser.createdAt) {
        const createdDate = this.currentUser.createdAt instanceof Date 
          ? this.currentUser.createdAt 
          : new Date(this.currentUser.createdAt as any);
        this.stats.memberSince = this.formatDate(createdDate);
      }

      // Última conexión
      if (this.currentUser.lastConnection) {
        const lastConn: any = this.currentUser.lastConnection;
        const lastConnDate = lastConn instanceof Date 
          ? lastConn 
          : lastConn?.toDate 
            ? lastConn.toDate() 
            : new Date(lastConn);
        this.stats.lastConnection = this.formatDate(lastConnDate);
      }

    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }

    this.loadingStats = false;
  }

  async updateProfile() {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched(this.profileForm);
      return;
    }

    this.loadingProfile = true;

    try {
      const newDisplayName = this.profileForm.value.displayName;

      // Actualizar en Firestore
      const userDoc = doc(this.firestore, `users/${this.currentUser!.uid}`);
      await updateDoc(userDoc, {
        displayName: newDisplayName
      });

      // Actualizar en Firebase Auth
      if (this.auth.currentUser) {
        const { updateProfile } = await import('@angular/fire/auth');
        await updateProfile(this.auth.currentUser, {
          displayName: newDisplayName
        });
      }

      // Actualizar el estado local
      const updatedUser = { ...this.currentUser!, displayName: newDisplayName };
      this.authService.currentUser.set(updatedUser);
      this.currentUser = updatedUser;

      this.snackBar.open('Perfil actualizado exitosamente', 'Cerrar', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });

      this.loadingProfile = false;
    } catch (error: any) {
      console.error('Error actualizando perfil:', error);
      this.snackBar.open('Error al actualizar perfil', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      this.loadingProfile = false;
    }
  }

  async changePassword() {
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;

    // Validar que las contraseñas coincidan
    if (newPassword !== confirmPassword) {
      this.snackBar.open('Las contraseñas nuevas no coinciden', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.loadingPassword = true;

    try {
      const user = this.auth.currentUser;

      if (!user || !user.email) {
        throw new Error('Usuario no autenticado');
      }

      // Reautenticar usuario
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Cambiar contraseña
      await updatePassword(user, newPassword);

      this.snackBar.open('Contraseña cambiada exitosamente', 'Cerrar', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });

      // Limpiar formulario
      this.passwordForm.reset();
      this.loadingPassword = false;

    } catch (error: any) {
      console.error('Error cambiando contraseña:', error);
      
      let errorMessage = 'Error al cambiar contraseña';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'La contraseña actual es incorrecta';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña nueva es muy débil';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Por seguridad, vuelve a iniciar sesión';
      }

      this.snackBar.open(errorMessage, 'Cerrar', {
        duration: 4000,
        panelClass: ['error-snackbar']
      });

      this.loadingPassword = false;
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(form: FormGroup, field: string): string {
    const control = form.get(field);

    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }
    if (control?.hasError('email')) {
      return 'Email inválido';
    }

    return '';
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  getRoleBadge(): string {
    return this.currentUser?.role === 'admin' ? 'Administrador' : 'Usuario';
  }

  getRoleColor(): string {
    return this.currentUser?.role === 'admin' ? 'admin-role' : 'user-role';
  }
}