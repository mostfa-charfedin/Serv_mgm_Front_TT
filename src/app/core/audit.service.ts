import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
export interface AuditPage {
    content: any[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
    private http = inject(HttpClient);
    private api = environment.apiUrl + '/audit';

    getAllAuditLogs(page: number = 0, size: number = 10): Observable<AuditPage> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString());
        return this.http.get<AuditPage>(this.api, { params });
    }

    getAuditLogsByUser(username: string, page: number = 0, size: number = 10): Observable<AuditPage> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString());
        return this.http.get<AuditPage>(`${this.api}/user/${encodeURIComponent(username)}`, { params });
    }

    getAuditLogsByAction(action: string, page: number = 0, size: number = 10): Observable<AuditPage> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString());
        return this.http.get<AuditPage>(`${this.api}/action/${encodeURIComponent(action)}`, { params });
    }

    getAuditLogsByEntityType(entityType: string, page: number = 0, size: number = 10): Observable<AuditPage> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString());
        return this.http.get<AuditPage>(`${this.api}/entity-type/${encodeURIComponent(entityType)}`, { params });
    }

    getAuditLogsByDateRange(startDate: Date, endDate: Date, page: number = 0, size: number = 10): Observable<AuditPage> {
        const params = new HttpParams()
            .set('startDate', this.formatLocalDateTime(startDate))
            .set('endDate', this.formatLocalDateTime(endDate))
            .set('page', page.toString())
            .set('size', size.toString());
        return this.http.get<AuditPage>(`${this.api}/date-range`, { params });
    }

    private formatLocalDateTime(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const y = date.getFullYear();
        const m = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        const h = pad(date.getHours());
        const min = pad(date.getMinutes());
        const sec = pad(date.getSeconds());
        return `${y}-${m}-${d}T${h}:${min}:${sec}`;
    }
}
