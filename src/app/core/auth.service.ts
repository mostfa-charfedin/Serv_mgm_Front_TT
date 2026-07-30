import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  private tokenKey = 'jwt_token';
  private api = environment.apiUrl + '/auth';

  private userRoleSubject = new BehaviorSubject<string | null>(this.getRoleFromToken());
  public userRole$ = this.userRoleSubject.asObservable();

  login(credentials: any) {
    return this.http.post<any>(`${this.api}/login`, credentials).pipe(
      tap(res => {
        localStorage.setItem(this.tokenKey, res.token);
        this.userRoleSubject.next(res.role);
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.userRoleSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const decoded: any = jwtDecode(token);
      return decoded.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getRoleFromToken(): string | null {
    const token = this.getToken();
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        const authorities = decoded.authorities;
        if (Array.isArray(authorities) && authorities.length > 0) {
          const first = authorities[0];
          if (typeof first === 'string') {
            return first.replace('ROLE_', '');
          }
          if (first && typeof first === 'object' && typeof first.authority === 'string') {
            return first.authority.replace('ROLE_', '');
          }
        }
      } catch {}
    }
    return null;
  }

  getUsernameFromToken(): string | null {
    const token = this.getToken();
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        return decoded.sub; // Standard JWT 'sub' field for username
      } catch {}
    }
    return null;
  }
}
