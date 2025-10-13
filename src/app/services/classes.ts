import { Injectable, inject, runInInjectionContext, Injector } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  Timestamp
} from '@angular/fire/firestore';
import { Class } from '../interfaces/class.interface';

@Injectable({
  providedIn: 'root'
})
export class ClassesService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private classesCollection = collection(this.firestore, 'classes');

  // Crear nueva clase
  async createClass(classData: Omit<Class, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const docRef = await runInInjectionContext(this.injector, () =>
        addDoc(this.classesCollection, {
          ...classData,
          date: Timestamp.fromDate(classData.date),
          createdAt: Timestamp.now()
        })
      );
      
      return { success: true, id: docRef.id };
    } catch (error: any) {
      console.error('Error creating class:', error);
      return { success: false, error: 'Error al crear la clase' };
    }
  }

  // Obtener todas las clases
  async getAllClasses(): Promise<Class[]> {
    try {
      console.log('🔍 Obteniendo TODAS las clases desde Firestore...');
      
      const querySnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(this.classesCollection)
      );
      
      console.log('📄 Documentos encontrados en Firestore:', querySnapshot.size);
      
      if (querySnapshot.empty) {
        console.log('⚠️ No hay documentos en la colección "classes"');
        return [];
      }
      
      const classes = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: (data['date'] as Timestamp).toDate()
        } as Class;
      });
      
      console.log('✅ Total de clases procesadas:', classes.length);
      
      return classes;
    } catch (error) {
      console.error('❌ Error obteniendo clases:', error);
      return [];
    }
  }

  // Obtener clases activas
  async getActiveClasses(): Promise<Class[]> {
    try {
      const allClasses = await this.getAllClasses();
      
      if (allClasses.length === 0) {
        return [];
      }
      
      const now = new Date();
      
      const activeClasses = allClasses.filter(c => {
        return c.date >= now && c.status === 'active';
      });
      
      return activeClasses.sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {
      console.error('❌ Error obteniendo clases activas:', error);
      return [];
    }
  }

  // Obtener clase por ID
  async getClassById(classId: string): Promise<Class | null> {
    try {
      const docRef = doc(this.firestore, 'classes', classId);
      const docSnap = await runInInjectionContext(this.injector, () =>
        getDoc(docRef)
      );
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          date: (docSnap.data()['date'] as Timestamp).toDate()
        } as Class;
      }
      return null;
    } catch (error) {
      console.error('Error getting class:', error);
      return null;
    }
  }

  // Actualizar clase
  async updateClass(classId: string, classData: Partial<Class>): Promise<{ success: boolean; error?: string }> {
    try {
      const docRef = doc(this.firestore, 'classes', classId);
      
      const dataToUpdate = { ...classData };
      if (dataToUpdate.date) {
        dataToUpdate.date = Timestamp.fromDate(dataToUpdate.date) as any;
      }
      
      await runInInjectionContext(this.injector, () =>
        updateDoc(docRef, dataToUpdate)
      );
      
      return { success: true };
    } catch (error: any) {
      console.error('Error updating class:', error);
      return { success: false, error: 'Error al actualizar la clase' };
    }
  }

  // Eliminar clase
  async deleteClass(classId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const docRef = doc(this.firestore, 'classes', classId);
      await runInInjectionContext(this.injector, () =>
        deleteDoc(docRef)
      );
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting class:', error);
      return { success: false, error: 'Error al eliminar la clase' };
    }
  }

  // Actualizar cupos
  async updateSpots(classId: string, increment: number): Promise<{ success: boolean; error?: string }> {
    try {
      const classData = await this.getClassById(classId);
      
      if (!classData) {
        return { success: false, error: 'Clase no encontrada' };
      }

      const newReservedSpots = classData.reservedSpots + increment;
      const newAvailableSpots = classData.availableSpots - increment;

      if (newAvailableSpots < 0) {
        return { success: false, error: 'No hay cupos disponibles' };
      }

      const docRef = doc(this.firestore, 'classes', classId);
      await runInInjectionContext(this.injector, () =>
        updateDoc(docRef, {
          reservedSpots: newReservedSpots,
          availableSpots: newAvailableSpots,
          status: newAvailableSpots === 0 ? 'full' : 'active'
        })
      );

      return { success: true };
    } catch (error: any) {
      console.error('Error updating spots:', error);
      return { success: false, error: 'Error al actualizar cupos' };
    }
  }

  // Filtrar por día
  filterClassesByDay(classes: Class[], day: string): Class[] {
    if (day === 'Todos') {
      return classes;
    }

    const dayMap: { [key: string]: number } = {
      'Domingo': 0,
      'Lunes': 1,
      'Martes': 2,
      'Miércoles': 3,
      'Jueves': 4,
      'Viernes': 5,
      'Sábado': 6
    };

    const dayNumber = dayMap[day];
    return classes.filter(classItem => classItem.date.getDay() === dayNumber);
  }

  // Filtrar por categoría
  filterClassesByCategory(classes: Class[], category: string): Class[] {
    if (category === 'all') {
      return classes;
    }
    return classes.filter(classItem => classItem.category === category);
  }
}