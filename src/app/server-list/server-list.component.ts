import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ServerService } from '../core/server.service';
import { AuthService } from '../core/auth.service';
import { AdminService } from '../core/admin.service';

@Component({
  selector: 'app-server-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatTableModule, MatPaginatorModule, MatInputModule, 
    MatButtonModule, MatIconModule, MatCardModule, 
    MatChipsModule, MatProgressSpinnerModule, MatSnackBarModule, 
    MatTooltipModule, MatSelectModule
  ],
  templateUrl: './server-list.component.html',
  styleUrls: ['./server-list.component.css']
})
export class ServerListComponent implements OnInit {
  serverService = inject(ServerService);
  authService = inject(AuthService);
  adminService = inject(AdminService);
  router = inject(Router);
  snackBar = inject(MatSnackBar);

  servers: any[] = [];
  platforms: any[] = [];
  serversByPlatform: Map<string, any[]> = new Map();
  platformOrder: string[] = [];
  displayedColumns: string[] = ['platform', 'hostname', 'status', 'instances', 'mode', 'ips', 'backup', 'alert', 'actions'];
  totalElements = 0;
  pageSize = 10000;
  pageIndex = 0;
  searchHostname = '';
  searchInstance = '';
  searchStatus = '';
  searchPlatform: number | null = null;
  searchServerType: number | null = null;
  searchIp = '';
  platformSearchText = '';
  serverTypes: any[] = [];
  loading = false;
  showArchived = false;

  get filteredPlatformOptions(): any[] {
    const q = this.platformSearchText.trim().toLowerCase();
    if (!q) return this.platforms;
    return this.platforms.filter(p =>
      (p.name || '').toLowerCase().includes(q)
      || String(p.id || '').includes(q)
    );
  }

  clearPlatformFilterSearch(event?: Event) {
    event?.stopPropagation();
    this.platformSearchText = '';
  }

  clearPlatformFilter(event?: Event) {
    event?.stopPropagation();
    this.searchPlatform = null;
    this.onSearch();
  }

  get canEdit() {
    return ['ADMIN', 'DBA'].includes(this.authService.getRoleFromToken() || '');
  }

  get canAdd() {
    return ['ADMIN', 'DBA'].includes(this.authService.getRoleFromToken() || '');
  }

  get canDelete() {
    return this.authService.getRoleFromToken() === 'ADMIN';
  }

  get canArchive() {
    return ['ADMIN', 'DBA'].includes(this.authService.getRoleFromToken() || '');
  }

  getRamPercent(server: any): number {
    if (!server) return 0;
    if (typeof server.ramPercentage === 'number' && server.ramPercentage > 0) {
      return Math.max(0, Math.min(100, Math.round(server.ramPercentage)));
    }
    const total = server.ramTotal || 0;
    const used = server.ramUsed || 0;
    if (!total) return 0;
    if (used > total) {
      return Math.max(0, Math.min(100, Math.round((total / used) * 100)));
    }
    return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
  }

  getRamUsedDisplay(server: any): number {
    if (!server) return 0;
    const used = typeof server.ramUsed === 'number' ? server.ramUsed : 0;
    const total = typeof server.ramTotal === 'number' ? server.ramTotal : 0;
    if (!total) return used;
    return used;
  }

  getDiskPercent(disk: any): number {
    if (!disk) return 0;
    if (typeof disk.usedPercentage === 'number' && disk.usedPercentage > 0) {
      return Math.max(0, Math.min(100, Math.round(disk.usedPercentage)));
    }
    const maxSize = disk.maxSize ?? 0;
    const available = disk.availableStorage;
    if (!maxSize || typeof available !== 'number') return 0;
    return Math.max(0, Math.min(100, Math.round(((maxSize - available) / maxSize) * 100)));
  }

  groupServersByPlatform() {
    this.serversByPlatform.clear();
    const platformMap = new Map<string, any[]>();
    
    // Group servers by platform name
    this.servers.forEach(server => {
      const platformName = server.platformName || 'Sans Plateforme';
      if (!platformMap.has(platformName)) {
        platformMap.set(platformName, []);
      }
      platformMap.get(platformName)!.push(server);
    });

    // Sort platform names alphabetically
    const sortedPlatforms = Array.from(platformMap.keys()).sort((a, b) => 
      a.localeCompare(b, 'fr', { numeric: true })
    );
    
    this.platformOrder = sortedPlatforms;
    
    // Create ordered Map
    sortedPlatforms.forEach(platform => {
      this.serversByPlatform.set(platform, platformMap.get(platform) || []);
    });
  }

  





  ngOnInit() {
    this.adminService.getPlatforms().subscribe({
      next: (data) => this.platforms = data,
      error: () => {}
    });
    this.adminService.getServerTypes().subscribe({
      next: (data) => this.serverTypes = data,
      error: () => {}
    });
    this.loadServers();
  }

  loadServers() {
    this.loading = true;
    if (this.showArchived) {
      this.serverService.getArchivedServers(this.pageIndex, this.pageSize).subscribe({
        next: (res: any) => {
          const content = res.content ?? (res._embedded ? res._embedded[Object.keys(res._embedded).filter(k => k !== '_links')[0]] : null) ?? (Array.isArray(res) ? res : []);
          const totalCount = res.totalElements ?? res.total_elements ?? (res.page ? res.page.totalElements : null) ?? (res.page ? res.page.total_elements : null);

          this.servers = content || [];
          this.totalElements = (totalCount !== null && totalCount !== undefined) ? totalCount : this.servers.length;
          this.groupServersByPlatform();
          this.loading = false;
        },
        error: () => {
          this.snackBar.open('Failed to load archived servers.', 'Close', { duration: 3000 });
          this.loading = false;
        }
      });
      return;
    }
    const combinedSearchArr = [this.searchHostname, this.searchInstance, this.searchIp].filter(s => s);
    const combinedSearch = combinedSearchArr.join(' ');
    this.serverService.getServers(combinedSearch, this.searchStatus, this.searchPlatform, this.searchServerType, this.pageIndex, this.pageSize).subscribe({
      next: (res: any) => {
        const content = res.content ?? (res._embedded ? res._embedded[Object.keys(res._embedded).filter(k => k !== '_links')[0]] : null) ?? (Array.isArray(res) ? res : []);
        const totalCount = res.totalElements ?? res.total_elements ?? (res.page ? res.page.totalElements : null) ?? (res.page ? res.page.total_elements : null);

        this.servers = content || [];
        this.totalElements = (totalCount !== null && totalCount !== undefined) ? totalCount : this.servers.length;
        this.groupServersByPlatform();
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load servers.', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  exportServerExcel(server: any) {
    if (!server?.id) return;
    this.serverService.exportServerExcel(server.id).subscribe({
      next: (blob) => {
        const fileName = `server_${server.hostname || server.id}.xlsx`;
        this.downloadBlob(blob, fileName);
        this.snackBar.open('Export Excel terminé.', 'Fermer', { duration: 2500 });
      },
      error: () => this.snackBar.open('Erreur export Excel.', 'Fermer', { duration: 3000 })
    });
  }

  importServerExcel(server: any) {
    if (!server?.id) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      this.serverService.importServerExcel(server.id, file).subscribe({
        next: (result: any) => {
          if (result?.errors && result.errors > 0) {
            const details = (result?.errorMessages || []).join(' | ');
            this.snackBar.open(`Import partiel: ${details}`, 'Fermer', { duration: 6000 });
          } else {
            this.snackBar.open('Import Excel terminé.', 'Fermer', { duration: 3000 });
          }
          this.loadServers();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Erreur import Excel.', 'Fermer', { duration: 4000 });
        }
      });
    };
    input.click();
  }

  exportAllServersExcel() {
    this.serverService.exportAllServersExcel().subscribe({
      next: (blob) => {
        this.downloadBlob(blob, 'inventaire_complet_serveurs.xlsx');
        this.snackBar.open('Export global Excel terminé.', 'Fermer', { duration: 2500 });
      },
      error: () => this.snackBar.open('Erreur export global.', 'Fermer', { duration: 3000 })
    });
  }

  importAllServersExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      this.serverService.importServersExcel(file).subscribe({
        next: (res: any) => {
          const msg = `Import terminé: ${res.created} créés, ${res.updated} mis à jour.`;
          this.snackBar.open(msg, 'Fermer', { duration: 5000 });
          if (res.errors > 0) {
             console.error('Erreurs import:', res.errorMessages);
          }
          this.loadServers();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Erreur import global.', 'Fermer', { duration: 4000 });
        }
      });
    };
    input.click();
  }

  toggleArchived() {
    this.showArchived = !this.showArchived;
    this.pageIndex = 0;
    this.loadServers();
  }

  onSearch() {
    this.pageIndex = 0;
    this.loadServers();
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadServers();
  }

  deleteServer(id: number) {
    if (!confirm('Are you sure you want to archive this server?')) return;
    this.serverService.deleteServer(id).subscribe({
      next: () => {
        this.snackBar.open('Server archived.', 'Close', { duration: 2500 });
        this.loadServers();
      },
      error: () => this.snackBar.open('Failed to archive server.', 'Close', { duration: 3000 })
    });
  }

  hardDeleteServer(id: number) {
    if (!confirm('Are you sure you want to delete this server permanently? This cannot be undone!')) return;
    this.serverService.hardDeleteServer(id).subscribe({
      next: () => {
        this.snackBar.open('Server deleted permanently.', 'Close', { duration: 2500 });
        this.loadServers();
      },
      error: () => this.snackBar.open('Failed to delete server.', 'Close', { duration: 3000 })
    });
  }

  restoreServer(id: number) {
    this.serverService.restoreServer(id).subscribe({
      next: () => {
        this.snackBar.open('Server restored.', 'Close', { duration: 2500 });
        this.loadServers();
      },
      error: () => this.snackBar.open('Failed to restore server.', 'Close', { duration: 3000 })
    });
  }

  private downloadBlob(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  isHighUsage(server: any): boolean {
    if (!server) return false;
    if (server.cpuUsage >= 80) return true;
    if (this.getRamPercent(server) >= 80) return true;
    if (server.disks && server.disks.some((d: any) => this.getDiskPercent(d) >= 80)) return true;
    if (server.tableSpaces && server.tableSpaces.some((ts: any) => ts.usedPercent >= 80)) return true;
    return false;
  }

  hasServerIssue(server: any): boolean {
    if (!server) return false;
    if (this.isHighUsage(server)) return true;
    if (this.getErrorNames(server).length > 0) return true;
    if (Array.isArray(server?.alerts) && server.alerts.length > 0) return true;
    return false;
  }

  getHighUsageItems(server: any): string[] {
    const alerts: string[] = [];
    if (server.cpuUsage >= 80) alerts.push(`CPU (${server.cpuUsage}%)`);
    if (this.getRamPercent(server) >= 80) alerts.push(`RAM (${this.getRamPercent(server)}%)`);
    if (server.disks) {
      server.disks
        .filter((d: any) => this.getDiskPercent(d) >= 80)
        .forEach((d: any) => alerts.push(`Disk ${d.name} (${this.getDiskPercent(d)}%)`));
    }
    if (server.tableSpaces) {
      server.tableSpaces.filter((ts: any) => ts.usedPercent >= 80).forEach((ts: any) => alerts.push(`TS ${ts.name} (${ts.usedPercent}%)`));
    }
    return alerts;
  }

  getErrorNames(server: any): string[] {
    if (!server?.serverErrors?.length) return [];
    return server.serverErrors
      .map((errorItem: any) => errorItem.errorName)
      .filter((name: string) => !!name);
  }
}
