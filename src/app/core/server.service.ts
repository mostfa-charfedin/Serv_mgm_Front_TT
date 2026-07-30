import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class ServerService {
    private http = inject(HttpClient);
    private api = environment.apiUrl + '/servers';

    getServers(search: string = '', status: string = '', platformId: number | null = null, serverTypeId: number | null = null, page: number = 0, size: number = 10) {
        let url = `${this.api}?page=${page}&size=${size}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (status) url += `&status=${encodeURIComponent(status)}`;
        if (platformId !== null && platformId !== undefined) url += `&platformId=${platformId}`;
        if (serverTypeId !== null && serverTypeId !== undefined) url += `&serverTypeId=${serverTypeId}`;
        return this.http.get<any>(url);
    }

    getServer(id: number) {
        return this.http.get<any>(`${this.api}/${id}`);
    }

    createServer(data: any) {
        return this.http.post<any>(this.api, data);
    }

    updateServer(id: number, data: any) {
        return this.http.put<any>(`${this.api}/${id}`, data);
    }

    deleteServer(id: number) {
        return this.http.delete(`${this.api}/${id}`);
    }

    getArchivedServers(page: number = 0, size: number = 10) {
        return this.http.get<any>(`${this.api}/archived?page=${page}&size=${size}`);
    }

    hardDeleteServer(id: number) {
        return this.http.delete(`${this.api}/${id}/hard`);
    }

    restoreServer(id: number) {
        return this.http.post<any>(`${this.api}/${id}/restore`, {});
    }

    getServersByPlatform(platformId: number) {
        return this.http.get<any[]>(`${this.api}/by-platform/${platformId}`);
    }

    exportServerExcel(id: number): Observable<Blob> {
        return this.http.get(`${this.api}/excel/export/${id}`, { responseType: 'blob' });
    }

    exportAllServersExcel(): Observable<Blob> {
        return this.http.get(`${this.api}/excel/export-all`, { responseType: 'blob' });
    }

    importServersExcel(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<any>(`${this.api}/excel/import`, formData);
    }

    importServerExcel(id: number, file: File) {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<any>(`${this.api}/excel/import/${id}`, formData);
    }
}
