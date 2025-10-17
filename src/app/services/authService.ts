import { Injectable, inject, signal, Injector, runInInjectionContext } from '@angular/core';
import { 
  Auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  user, 
  User as FirebaseUser, 
  updateProfile 
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { User } from '../interfaces/user.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private injector = inject(Injector);

  // Estado reactivo del usuario
  currentUser = signal<User | null>(null);
  user$: Observable<FirebaseUser | null> = user(this.auth);

  constructor() {
    // Escuchar cambios de autenticación
    this.user$.subscribe(async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await this.getUserData(firebaseUser.uid);
        this.currentUser.set(userData);
      } else {
        this.currentUser.set(null);
      }
    });
  }

  // Registro de nuevo usuario
  async register(email: string, password: string, displayName: string) {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Actualizar perfil
      await updateProfile(credential.user, { displayName });

      // Crear documento en Firestore
      const userData: User = {
        uid: credential.user.uid,
        email: email,
        displayName: displayName,
        role: 'user',
        createdAt: new Date(),
        lastConnection: new Date()
      };

      await setDoc(doc(this.firestore, `users/${credential.user.uid}`), userData);
      
      this.currentUser.set(userData);
      this.router.navigate(['/home']);
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  // Iniciar sesión
  async login(email: string, password: string) {
    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      
      // Actualizar última conexión
      await updateDoc(doc(this.firestore, `users/${credential.user.uid}`), {
        lastConnection: new Date()
      });

      const userData = await this.getUserData(credential.user.uid);
      this.currentUser.set(userData);

      // Redirigir según el rol
      if (userData?.role === 'admin') {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/home']);
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  // Login con Google
  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const credential = await signInWithPopup(this.auth, provider);
      
      // Verificar si el usuario ya existe en Firestore
      const userDoc = await getDoc(doc(this.firestore, `users/${credential.user.uid}`));
      
      if (!userDoc.exists()) {
        // Si es nuevo, crear documento
        const userData: User = {
          uid: credential.user.uid,
          email: credential.user.email || '',
          displayName: credential.user.displayName || 'Usuario',
          role: 'user',
          createdAt: new Date(),
          lastConnection: new Date()
        };

        await setDoc(doc(this.firestore, `users/${credential.user.uid}`), userData);
        this.currentUser.set(userData);
      } else {
        // Si ya existe, actualizar última conexión
        await updateDoc(doc(this.firestore, `users/${credential.user.uid}`), {
          lastConnection: new Date()
        });
        
        const userData = userDoc.data() as User;
        this.currentUser.set(userData);
      }

      // Redirigir según el rol
      if (this.currentUser()?.role === 'admin') {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/home']);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error con Google Sign-In:', error);
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  // Cerrar sesión
  async logout() {
    try {
      await signOut(this.auth);
      this.currentUser.set(null);
      this.router.navigate(['/login']);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: 'Error al cerrar sesión' };
    }
  }

  // Obtener datos del usuario desde Firestore
  private async getUserData(uid: string): Promise<User | null> {
    try {
      const docRef = doc(this.firestore, `users/${uid}`);
      const userDoc = await runInInjectionContext(this.injector, () =>
        getDoc(docRef)
      );
      
      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
}

  // Verificar si es admin
  isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }

  // Verificar si está autenticado
  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  // Mensajes de error en español
  private getErrorMessage(errorCode: string): string {
    const errorMessages: { [key: string]: string } = {
      'auth/email-already-in-use': 'Este correo ya está registrado',
      'auth/invalid-email': 'Correo electrónico inválido',
      'auth/operation-not-allowed': 'Operación no permitida',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
      'auth/user-disabled': 'Usuario deshabilitado',
      'auth/user-not-found': 'Usuario no encontrado',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/invalid-credential': 'Credenciales inválidas',
      'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
      'auth/popup-closed-by-user': 'Ventana cerrada antes de completar el inicio de sesión',
      'auth/cancelled-popup-request': 'Operación cancelada',
      'auth/popup-blocked': 'Ventana emergente bloqueada por el navegador'
    };
    
    return errorMessages[errorCode] || 'Error al procesar la solicitud';
  }
}