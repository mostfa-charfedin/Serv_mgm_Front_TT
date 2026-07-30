import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from './core/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    CommonModule
  ],
  template: `
    <!-- Modern Premium Navigation -->
    <mat-toolbar class="navbar glass-effect" *ngIf="authService.isAuthenticated()">
      <div class="nav-container">
        <div class="logo" routerLink="/dashboard">
          <img src="Logo TT.png" alt="Logo TT" class="logo-img" />
          <span class="logo-text">Infra<span class="bold">TT</span></span>
        </div>
        <!-- Desktop nav (hidden on small screens) -->
        <nav class="nav-links" *ngIf="userRole$ | async as role">
          <a mat-button routerLink="/dashboard" routerLinkActive="active-link" [routerLinkActiveOptions]="{exact: true}">
            <mat-icon>dashboard</mat-icon> Dashboard
          </a>
          <a mat-button routerLink="/statistics" routerLinkActive="active-link" class="stats-link">
            <mat-icon>insights</mat-icon> Statistiques
          </a>
          <a mat-button routerLink="/servers" routerLinkActive="active-link">
            <mat-icon>dns</mat-icon> Servers
          </a>
          <a mat-button routerLink="/admin" *ngIf="role === 'ADMIN' || role === 'DBA'" routerLinkActive="active-link">
            <mat-icon>admin_panel_settings</mat-icon> Admin
          </a>
          <a mat-button routerLink="/admin/users" *ngIf="role === 'ADMIN'" routerLinkActive="active-link">
            <mat-icon>group</mat-icon> Users
          </a>
        </nav>

        <!-- Mobile nav menu trigger -->
        <button mat-icon-button class="mobile-menu" [matMenuTriggerFor]="navMenu" aria-label="Open navigation menu">
          <mat-icon>menu</mat-icon>
        </button>
        <mat-menu #navMenu="matMenu">
          <button mat-menu-item routerLink="/dashboard"><mat-icon>dashboard</mat-icon><span>Dashboard</span></button>
          <button mat-menu-item routerLink="/statistics"><mat-icon>insights</mat-icon><span>Statistiques</span></button>
          <button mat-menu-item routerLink="/servers"><mat-icon>dns</mat-icon><span>Servers</span></button>
          <button mat-menu-item *ngIf="(userRole$ | async) === 'ADMIN' || (userRole$ | async) === 'DBA'" routerLink="/admin"><mat-icon>admin_panel_settings</mat-icon><span>Admin</span></button>
          <button mat-menu-item *ngIf="(userRole$ | async) === 'ADMIN'" routerLink="/admin/users"><mat-icon>group</mat-icon><span>Users</span></button>
        </mat-menu>

        <span class="spacer"></span>

        <div class="user-action" *ngIf="userRole$ | async as role">
          <button mat-icon-button [matMenuTriggerFor]="userMenu" class="avatar-btn">
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu" xPosition="before">
            <div class="menu-header">
              <div class="user-info">
                <span class="username">Connected as</span>
                <span class="role-badge">{{ role }}</span>
              </div>
            </div>
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Logout</span>
            </button>
          </mat-menu>
        </div>
      </div>
    </mat-toolbar>

    <main class="content-area">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .navbar {
      height: 70px;
      position: sticky;
      top: 0;
      z-index: 1000;
      padding: 0 5%;
      display: flex;
      align-items: center;
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    .nav-container {
      display: flex;
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
      align-items: center;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      margin-right: 40px;
    }
    .logo-img {
      width: 34px;
      height: 34px;
      object-fit: contain;
      border-radius: 8px;
    }
    .logo-text {
      font-size: 20px;
      font-weight: 500;
      letter-spacing: -0.5px;
      color: #1e293b;
    }
    .bold { font-weight: 800; color: #6366f1; }
    
    .nav-links {
      display: flex;
      gap: 8px;
    }
    .mobile-menu { display: none; }
    .nav-links a {
      color: #64748b;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 16px;
      height: 40px;
      border-radius: 8px;
    }
    .nav-links a mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .stats-link {
      background: #eef2ff;
      color: #4f46e5;
      font-weight: 700;
    }

    .stats-link mat-icon { color: #4f46e5; }
    
    .menu-header {
      padding: 16px;
      border-bottom: 1px solid #f1f5f9;
      min-width: 180px;
    }
    .user-info { display: flex; flex-direction: column; gap: 4px; }
    .username { font-size: 12px; color: #64748b; }
    .role-badge {
      font-size: 14px;
      font-weight: 600;
      color: #6366f1;
      text-transform: uppercase;
    }
    
    .content-area {
      max-width: 1400px;
      margin: 0 auto;
      padding: 30px 5%;
    }
    .avatar-btn {
      color: #64748b;
      transform: scale(1.2);
    }
    @media (max-width: 900px) {
      .mobile-menu { display: inline-flex; }
      .nav-links { display: none; }
      .logo-text { display: none; }
      .logo { margin-right: 8px; }
      .logo-img { width: 28px; height: 28px; }
      .navbar { padding: 0 12px; }
      .content-area { padding: 16px; }
    }
  `]
})
export class App {
  authService = inject(AuthService);
  userRole$ = this.authService.userRole$;

  logout() {
    this.authService.logout();
  }
}
