import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData
} from '@angular/fire/firestore';
import { Reservation } from '../interfaces/reservation.interface';
import { AuthService } from './authService';
import { ClassesService } from './classes';

@Injectable({
  providedIn: 'root'
})
export class ReservationsService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private authService = inject(AuthService);
  private classesService = inject(ClassesService);
  private reservationsCollection = collection(this.firestore, 'reservations');

  // Crear nueva reserva
  async createReservation(classId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.authService.currentUser();
      if (!user) {
        return { success: false, error: 'Debes iniciar sesión para reservar' };
      }

      const classData = await this.classesService.getClassById(classId);
      if (!classData) {
        return { success: false, error: 'Clase no encontrada' };
      }

      const existingReservation = await this.hasReservation(user.uid, classId);
      if (existingReservation) {
        return { success: false, error: 'Ya tienes una reserva en esta clase' };
      }

      if (classData.availableSpots <= 0) {
        return { success: false, error: 'No hay cupos disponibles' };
      }

      const reservation: Omit<Reservation, 'id'> = {
        userId: user.uid,
        userName: user.displayName || 'Usuario',
        userEmail: user.email,
        classId: classId,
        className: classData.name,
        classDate: classData.date,
        classTime: `${classData.startTime} - ${classData.endTime}`,
        reservationDate: new Date(),
        status: 'confirmed'
      };

      await runInInjectionContext(this.injector, () =>
        addDoc(this.reservationsCollection, {
          ...reservation,
          classDate: Timestamp.fromDate(reservation.classDate),
          reservationDate: Timestamp.fromDate(reservation.reservationDate)
        })
      );

      await this.classesService.updateSpots(classId, 1);

      return { success: true };
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      return { success: false, error: 'Error al crear la reserva' };
    }
  }

  // Cancelar reserva
  async cancelReservation(reservationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const reservation = await this.getReservationById(reservationId);
      
      if (!reservation) {
        return { success: false, error: 'Reserva no encontrada' };
      }

      if (reservation.classDate < new Date()) {
        return { success: false, error: 'No puedes cancelar una clase que ya pasó' };
      }

      const docRef = doc(this.firestore, 'reservations', reservationId);
      await runInInjectionContext(this.injector, () =>
        updateDoc(docRef, {
          status: 'cancelled'
        })
      );

      await this.classesService.updateSpots(reservation.classId, -1);

      return { success: true };
    } catch (error: any) {
      console.error('Error cancelling reservation:', error);
      return { success: false, error: 'Error al cancelar la reserva' };
    }
  }

  // Obtener reservas de un usuario
  async getUserReservations(userId: string): Promise<Reservation[]> {
    try {
      console.log('🔍 Buscando reservas para userId:', userId);
      
      const q = query(
        this.reservationsCollection,
        where('userId', '==', userId),
        orderBy('classDate', 'desc')
      );
      
      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(q)
      );
      
      console.log('📄 Documentos encontrados:', querySnapshot.size);
      
      const reservations = querySnapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data();
        console.log('📝 Reserva:', docSnap.id, data);
        
        return {
          id: docSnap.id,
          ...data,
          classDate: (data['classDate'] as Timestamp).toDate(),
          reservationDate: (data['reservationDate'] as Timestamp).toDate()
        } as Reservation;
      });
      
      console.log('✅ Reservas procesadas:', reservations);
      
      return reservations;
    } catch (error) {
      console.error('❌ Error getting user reservations:', error);
      return [];
    }
  }

  // Obtener reserva por ID
  async getReservationById(reservationId: string): Promise<Reservation | null> {
    try {
      const docRef = doc(this.firestore, 'reservations', reservationId);
      const docSnap = await runInInjectionContext(this.injector, () =>
        getDoc(docRef)
      );
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          classDate: (data['classDate'] as Timestamp).toDate(),
          reservationDate: (data['reservationDate'] as Timestamp).toDate()
        } as Reservation;
      }
      return null;
    } catch (error) {
      console.error('Error getting reservation:', error);
      return null;
    }
  }

  // Verificar si un usuario ya tiene reserva en una clase
  async hasReservation(userId: string, classId: string): Promise<boolean> {
    try {
      const q = query(
        this.reservationsCollection,
        where('userId', '==', userId),
        where('classId', '==', classId),
        where('status', '==', 'confirmed')
      );
      
      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(q)
      );
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking reservation:', error);
      return false;
    }
  }

  // Obtener todas las reservas de una clase
  async getClassReservations(classId: string): Promise<Reservation[]> {
    try {
      const q = query(
        this.reservationsCollection,
        where('classId', '==', classId),
        where('status', '==', 'confirmed')
      );
      
      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(q)
      );
      
      return querySnapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          classDate: (data['classDate'] as Timestamp).toDate(),
          reservationDate: (data['reservationDate'] as Timestamp).toDate()
        } as Reservation;
      });
    } catch (error) {
      console.error('Error getting class reservations:', error);
      return [];
    }
  }

  // Obtener todas las reservas (para admin)
  async getAllReservations(): Promise<Reservation[]> {
    try {
      const q = query(this.reservationsCollection, orderBy('reservationDate', 'desc'));
      
      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(q)
      );
      
      return querySnapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          classDate: (data['classDate'] as Timestamp).toDate(),
          reservationDate: (data['reservationDate'] as Timestamp).toDate()
        } as Reservation;
      });
    } catch (error) {
      console.error('Error getting all reservations:', error);
      return [];
    }
  }
}