import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminService {
    private http = inject(HttpClient);
    private api = environment.apiUrl + '/admin';

    // --- Operating Systems ---
    getOperatingSystems() { return this.http.get<any[]>(`${this.api}/operating-systems`); }
    getAllOperatingSystems() { return this.http.get<any[]>(`${this.api}/operating-systems`); }
    createOperatingSystem(data: any) { return this.http.post<any>(`${this.api}/operating-systems`, data); }
    updateOperatingSystem(id: number, data: any) { return this.http.put<any>(`${this.api}/operating-systems/${id}`, data); }
    deleteOperatingSystem(id: number) { return this.http.delete(`${this.api}/operating-systems/${id}`); }

    // --- Server Types ---
    getServerTypes() { return this.http.get<any[]>(`${this.api}/server-types`); }
    createServerType(data: any) { return this.http.post<any>(`${this.api}/server-types`, data); }
    updateServerType(id: number, data: any) { return this.http.put<any>(`${this.api}/server-types/${id}`, data); }
    deleteServerType(id: number) { return this.http.delete(`${this.api}/server-types/${id}`); }

    // --- SGBD ---
    getSgbds() { return this.http.get<any[]>(`${this.api}/sgbds`); }
    createSgbd(data: any) { return this.http.post<any>(`${this.api}/sgbds`, data); }
    updateSgbd(id: number, data: any) { return this.http.put<any>(`${this.api}/sgbds/${id}`, data); }
    deleteSgbd(id: number) { return this.http.delete(`${this.api}/sgbds/${id}`); }

    // --- SGBD Releases ---
    getSgbdReleases(sgbdId: number) { return this.http.get<any[]>(`${this.api}/sgbds/${sgbdId}/releases`); }
    createSgbdRelease(sgbdId: number, data: any) { return this.http.post<any>(`${this.api}/sgbds/${sgbdId}/releases`, data); }
    updateSgbdRelease(id: number, data: any) { return this.http.put<any>(`${this.api}/sgbd-releases/${id}`, data); }
    deleteSgbdRelease(id: number) { return this.http.delete(`${this.api}/sgbd-releases/${id}`); }

    // --- Environments ---
    getEnvironments() { return this.http.get<any[]>(`${this.api}/environments`); }
    createEnvironment(data: any) { return this.http.post<any>(`${this.api}/environments`, data); }
    updateEnvironment(id: number, data: any) { return this.http.put<any>(`${this.api}/environments/${id}`, data); }
    deleteEnvironment(id: number) { return this.http.delete(`${this.api}/environments/${id}`); }

    // --- Users ---
    getUsers() { return this.http.get<any[]>(`${this.api}/users`); }
    updateUser(id: number, data: any) { return this.http.put<any>(`${this.api}/users/${id}`, data); }
    createUser(data: any) { return this.http.post<any>(`${this.api}/users`, data); }

    // --- Platforms ---
    getPlatforms() { return this.http.get<any[]>(`${this.api}/platforms`); }
    getPlatformById(id: number) { return this.http.get<any>(`${this.api}/platforms/${id}`); }
    createPlatform(data: any) { return this.http.post<any>(`${this.api}/platforms`, data); }
    updatePlatform(id: number, data: any) { return this.http.put<any>(`${this.api}/platforms/${id}`, data); }
    deletePlatform(id: number) { return this.http.delete(`${this.api}/platforms/${id}`); }

    // --- Clusters ---
    getClusters() { return this.http.get<any[]>(`${this.api}/clusters`); }
    getClustersByPlatform(platformId: number) { return this.http.get<any[]>(`${this.api}/clusters/by-platform/${platformId}`); }
    createCluster(data: any) { return this.http.post<any>(`${this.api}/clusters`, data); }
    updateCluster(id: number, data: any) { return this.http.put<any>(`${this.api}/clusters/${id}`, data); }
    deleteCluster(id: number) { return this.http.delete(`${this.api}/clusters/${id}`); }
}
