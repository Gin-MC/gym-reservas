import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/authService';
import { ClassesService } from '../../services/classes';
import { ReservationsService } from '../../services/reservations';
import { Class } from '../../interfaces/class.interface';
import { Reservation } from '../../interfaces/reservation.interface';
import { User } from '../../interfaces/user.interface';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

interface UserWithReservations extends User {
  reservationsCount: number;
  activeReservations: string[];
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    // RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit {
  private authService = inject(AuthService);
  private classesService = inject(ClassesService);
  private reservationsService = inject(ReservationsService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  // Data
  allClasses: Class[] = [];
  allReservations: Reservation[] = [];
  allUsers: UserWithReservations[] = [];
  
  // Selected class for detail view
  selectedClass = signal<Class | null>(null);
  selectedClassReservations: Reservation[] = [];

  // Loading states
  loading = true;
  loadingUsers = false;
  deletingClassId = signal<string | null>(null);

  // Table columns
  classesColumns = ['icon', 'name', 'instructor', 'date', 'time', 'totalSpots', 'reserved', 'available', 'status', 'actions'];
  usersColumns = ['name', 'email', 'registered', 'reservations', 'status', 'lastConnection'];
  reservationsColumns = ['user', 'class', 'date', 'time', 'reservationDate', 'status'];

  // Stats
  stats = {
    totalClasses: 0,
    activeClasses: 0,
    totalReservations: 0,
    totalUsers: 0,
    occupancyRate: 0
  };

  async ngOnInit() {
    // Verificar que sea admin
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/home']);
      return;
    }

    await this.loadAllData();
  }

  async loadAllData() {
    this.loading = true;
    await Promise.all([
      this.loadClasses(),
      this.loadReservations(),
      this.loadUsers()
    ]);
    this.calculateStats();
    this.loading = false;
  }

  async loadClasses() {
    this.allClasses = await this.classesService.getAllClasses();
    console.log('📚 Clases cargadas:', this.allClasses.length);
  }

  async loadReservations() {
    this.allReservations = await this.reservationsService.getAllReservations();
    console.log('📋 Reservas cargadas:', this.allReservations.length);
  }

  async loadUsers() {
    this.loadingUsers = true;
    try {
      const usersCollection = collection(this.firestore, 'users');
      const querySnapshot = await getDocs(usersCollection);
      
      const users: User[] = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));

      // Agregar información de reservas a cada usuario
      this.allUsers = users.map(user => {
        const userReservations = this.allReservations.filter(r => 
          r.userId === user.uid && r.status === 'confirmed'
        );
        
        return {
          ...user,
          reservationsCount: userReservations.length,
          activeReservations: userReservations.map(r => r.className)
        };
      });

      console.log('👥 Usuarios cargados:', this.allUsers.length);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
    this.loadingUsers = false;
  }

  calculateStats() {
    this.stats.totalClasses = this.allClasses.length;
    this.stats.activeClasses = this.allClasses.filter(c => c.status === 'active').length;
    this.stats.totalReservations = this.allReservations.filter(r => r.status === 'confirmed').length;
    this.stats.totalUsers = this.allUsers.length;

    // Calcular tasa de ocupación
    const totalSpots = this.allClasses.reduce((sum, c) => sum + c.totalSpots, 0);
    const reservedSpots = this.allClasses.reduce((sum, c) => sum + c.reservedSpots, 0);
    this.stats.occupancyRate = totalSpots > 0 ? Math.round((reservedSpots / totalSpots) * 100) : 0;
  }

  async viewClassDetails(classItem: Class) {
    this.selectedClass.set(classItem);
    this.selectedClassReservations = await this.reservationsService.getClassReservations(classItem.id!);
    console.log('📊 Reservas de la clase:', this.selectedClassReservations.length);
  }

  closeClassDetails() {
    this.selectedClass.set(null);
    this.selectedClassReservations = [];
  }

  async deleteClass(classItem: Class) {
    const confirmed = confirm(`¿Estás seguro de eliminar la clase "${classItem.name}"? Esta acción no se puede deshacer.`);
    
    if (!confirmed) return;

    // Verificar si tiene reservas
    const classReservations = await this.reservationsService.getClassReservations(classItem.id!);
    
    if (classReservations.length > 0) {
      this.snackBar.open(
        `No puedes eliminar esta clase porque tiene ${classReservations.length} reserva(s) activa(s)`,
        'Cerrar',
        { duration: 5000, panelClass: ['error-snackbar'] }
      );
      return;
    }

    this.deletingClassId.set(classItem.id!);
    const result = await this.classesService.deleteClass(classItem.id!);
    this.deletingClassId.set(null);

    if (result.success) {
      this.snackBar.open('Clase eliminada exitosamente', 'Cerrar', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
      await this.loadClasses();
      this.calculateStats();
    } else {
      this.snackBar.open(result.error || 'Error al eliminar clase', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
  }

  formatDate(date: Date): string {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  }

  formatDateTime(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatShortDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getStatusClass(status: string): string {
    return status === 'active' ? 'active' : status === 'full' ? 'full' : 'cancelled';
  }

  getStatusText(classItem: Class): string {
    if (classItem.status === 'cancelled') return 'Cancelada';
    if (classItem.availableSpots === 0) return 'Completa';
    if (classItem.availableSpots <= classItem.totalSpots * 0.3) return 'Casi Llena';
    return 'Activa';
  }

  getOccupancyColor(percentage: number): string {
    if (percentage >= 80) return 'high';
    if (percentage >= 50) return 'medium';
    return 'low';
  }

  getOccupancyPercentage(classItem: Class): number {
    return Math.round((classItem.reservedSpots / classItem.totalSpots) * 100);
  }

  isDeleting(classId: string): boolean {
    return this.deletingClassId() === classId;
  }

  getUserStatusText(user: UserWithReservations): string {
    if (!user.lastConnection) return 'Inactivo';
    
    const now = new Date();
    const lastConn = user.lastConnection instanceof Date 
      ? user.lastConnection 
      : new Date(user.lastConnection as any);
    
    const diffDays = Math.floor((now.getTime() - lastConn.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Activo';
    if (diffDays <= 7) return 'Activo';
    return 'Inactivo';
  }

  getLastConnectionText(user: UserWithReservations): string {
    if (!user.lastConnection) return 'Nunca';
    
    const lastConn = user.lastConnection instanceof Date 
      ? user.lastConnection 
      : new Date(user.lastConnection as any);
    
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastConn.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    
    return lastConn.toLocaleDateString('es-ES');
  }
}
