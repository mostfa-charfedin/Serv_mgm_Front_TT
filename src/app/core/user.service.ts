import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
    private http = inject(HttpClient);
    private api = environment.apiUrl + '/admin/users';

    getUsers() {
        return this.http.get<any[]>(this.api);
    }

    getArchivedUsers() {
        return this.http.get<any[]>(`${this.api}/archived`);
    }

    archiveUser(userId: number) {
        return this.http.delete(`${this.api}/${userId}`);
    }

    restoreUser(userId: number) {
        return this.http.post(`${this.api}/${userId}/restore`, {});
    }

    updateUser(userId: number, data: any) {
        return this.http.put(`${this.api}/${userId}`, data);
    }

    createUser(data: any) {
        return this.http.post(`${this.api}`, data);
    }
}
