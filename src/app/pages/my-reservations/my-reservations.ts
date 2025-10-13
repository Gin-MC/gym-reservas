import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../services/authService';
import { ReservationsService } from '../../services/reservations';
import { Reservation } from '../../interfaces/reservation.interface';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  templateUrl: './my-reservations.html',
  styleUrl: './my-reservations.css'
})
export class MyReservations implements OnInit {
  private authService = inject(AuthService);
  private reservationsService = inject(ReservationsService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  allReservations: Reservation[] = [];
  upcomingReservations: Reservation[] = [];
  completedReservations: Reservation[] = [];
  cancelledReservations: Reservation[] = [];
  
  loading = true;
  cancellingReservationId = signal<string | null>(null);

  // Estadísticas
  stats = {
    total: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0
  };

  async ngOnInit() {
    await this.loadReservations();
  }

  async loadReservations() {
    this.loading = true;
    const user = this.authService.currentUser();
    
    console.log('👤 Usuario actual:', user);
    
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    console.log('📡 Obteniendo reservas para userId:', user.uid);
    
    this.allReservations = await this.reservationsService.getUserReservations(user.uid);
    
    console.log('📋 Total de reservas obtenidas:', this.allReservations.length);
    console.log('📊 Reservas:', this.allReservations);
    
    this.filterReservations();
    
    console.log('🔜 Próximas:', this.upcomingReservations.length);
    console.log('✅ Completadas:', this.completedReservations.length);
    console.log('❌ Canceladas:', this.cancelledReservations.length);
    
    this.calculateStats();
    this.loading = false;
  }

  filterReservations() {
    const now = new Date();

    this.upcomingReservations = this.allReservations.filter(r => 
      r.status === 'confirmed' && r.classDate >= now
    );

    this.completedReservations = this.allReservations.filter(r => 
      r.status === 'completed' || (r.status === 'confirmed' && r.classDate < now)
    );

    this.cancelledReservations = this.allReservations.filter(r => 
      r.status === 'cancelled'
    );
  }

  calculateStats() {
    this.stats = {
      total: this.allReservations.length,
      upcoming: this.upcomingReservations.length,
      completed: this.completedReservations.length,
      cancelled: this.cancelledReservations.length
    };
  }

  async cancelReservation(reservation: Reservation) {
    // Verificar si la clase ya pasó
    if (reservation.classDate < new Date()) {
      this.snackBar.open('No puedes cancelar una clase que ya pasó', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    // Confirmar cancelación
    const confirmed = confirm(`¿Estás seguro de cancelar tu reserva para "${reservation.className}"?`);
    
    if (!confirmed) {
      return;
    }

    this.cancellingReservationId.set(reservation.id!);
    
    const result = await this.reservationsService.cancelReservation(reservation.id!);
    
    this.cancellingReservationId.set(null);

    if (result.success) {
      this.snackBar.open('Reserva cancelada exitosamente', 'Cerrar', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
      
      // Recargar reservas
      await this.loadReservations();
    } else {
      this.snackBar.open(result.error || 'Error al cancelar reserva', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
  }

  formatDate(date: Date): string {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  formatReservationDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getStatusColor(reservation: Reservation): string {
    if (reservation.status === 'cancelled') return 'cancelled';
    if (reservation.classDate < new Date()) return 'completed';
    return 'confirmed';
  }

  getStatusText(reservation: Reservation): string {
    if (reservation.status === 'cancelled') return 'Cancelada';
    if (reservation.classDate < new Date()) return 'Completada';
    return 'Confirmada';
  }

  getStatusIcon(reservation: Reservation): string {
    if (reservation.status === 'cancelled') return 'cancel';
    if (reservation.classDate < new Date()) return 'check_circle';
    return 'event_available';
  }

  canCancelReservation(reservation: Reservation): boolean {
    return reservation.status === 'confirmed' && reservation.classDate >= new Date();
  }

  isCancelling(reservationId: string): boolean {
    return this.cancellingReservationId() === reservationId;
  }
}