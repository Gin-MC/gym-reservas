import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Header } from './components/header/header';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'gym-reservas';
  showHeader = true;
  private router = inject(Router);

  constructor() {
    // Escuchar cambios de ruta
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Ocultar header en login y register
      const hideHeaderRoutes = ['/login', '/register'];
      this.showHeader = !hideHeaderRoutes.includes(event.urlAfterRedirects);
    });
  }
}