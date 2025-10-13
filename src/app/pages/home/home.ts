import { Component, inject, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../services/authService';
import { ClassesService } from '../../services/classes';
import { ReservationsService } from '../../services/reservations';
import { Class } from '../../interfaces/class.interface';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private classesService = inject(ClassesService);
  private reservationsService = inject(ReservationsService);
  private snackBar = inject(MatSnackBar);

  selectedDay = 'Todos';
  days = ['Todos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  classes: Class[] = [];
  filteredClasses: Class[] = [];
  loading = true;
  reservingClassId: string | null = null;

  async ngOnInit() {
    console.log('🔥 Iniciando carga de clases...');
    await this.loadClasses();
  }

  async loadClasses() {
    this.loading = true;
    console.log('📡 Llamando a getActiveClasses()...');
    
    try {
      this.classes = await this.classesService.getActiveClasses();
      console.log('✅ Clases obtenidas:', this.classes);
      console.log('📊 Total de clases:', this.classes.length);
      
      this.filteredClasses = this.classes;
      this.loading = false;
    } catch (error) {
      console.error('❌ Error al cargar clases:', error);
      this.loading = false;
    }
  }

  filterByDay(day: string) {
    this.selectedDay = day;
    this.filteredClasses = this.classesService.filterClassesByDay(this.classes, day);
  }

  async reserveClass(classItem: Class) {
    if (!this.authService.isAuthenticated()) {
      this.snackBar.open('Debes iniciar sesión para reservar', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      this.router.navigate(['/login']);
      return;
    }

    if (classItem.availableSpots === 0) {
      this.snackBar.open('No hay cupos disponibles', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    const hasReservation = await this.reservationsService.hasReservation(
      this.authService.currentUser()!.uid,
      classItem.id!
    );

    if (hasReservation) {
      this.snackBar.open('Ya tienes una reserva en esta clase', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.reservingClassId = classItem.id!;
    const result = await this.reservationsService.createReservation(classItem.id!);
    this.reservingClassId = null;

    if (result.success) {
      this.snackBar.open('¡Reserva exitosa!', 'Cerrar', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
      await this.loadClasses();
    } else {
      this.snackBar.open(result.error || 'Error al reservar', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
  }

  getStatusClass(availableSpots: number, totalSpots: number): string {
    if (availableSpots === 0) return 'full';
    if (availableSpots <= totalSpots * 0.3) return 'almost-full';
    return 'available';
  }

  getStatusText(availableSpots: number): string {
    if (availableSpots === 0) return '❌ Completo';
    if (availableSpots <= 3) return '⚠️ Casi lleno';
    return '✅ Disponible';
  }

  scrollToClasses() {
    const element = document.getElementById('classes-section');
    element?.scrollIntoView({ behavior: 'smooth' });
  }

  formatDate(date: Date): string {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  }

  isReserving(classId: string): boolean {
    return this.reservingClassId === classId;
  }
}