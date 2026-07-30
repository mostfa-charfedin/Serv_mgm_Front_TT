import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ServerService } from '../core/server.service';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AdminService } from '../core/admin.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatCardModule, MatIconModule, MatProgressSpinnerModule,
    MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  serverService = inject(ServerService);
  authService = inject(AuthService);
  adminService = inject(AdminService);
  router = inject(Router);

  loading = true;
  totalServers = 0;
  upCount = 0;
  downCount = 0;
  maintCount = 0;
  sgbdStats: Array<{ name: string; count: number }> = [];
  serverTypeStats: Array<{ name: string; count: number }> = [];
  selectedSgbd: string | null = null;
  selectedStatus: 'UP' | 'DOWN' | 'MAINTENANCE' | null = null;
  selectedServerType: string | null = null;

  // Optimized dynamic stats
  dynamicSgbdStats: any[] = [];
  dynamicServerTypeStats: any[] = [];
  dynamicStatusStats: any = { 'UP': 0, 'DOWN': 0, 'MAINTENANCE': 0 };
  countSgbdAndType = 0;
  countStatusAndType = 0;
  countStatusAndSgbd = 0;
  
  // Storage & RAM Metrics
  totalServersWithCpu = 0;
  totalCpu = 0;
  totalStorageUsed = 0;
  totalStorageCapacity = 0;
  totalRamUsed = 0;
  totalRamCapacity = 0;
  
  // Unit Selection
  storageUnit: 'B' | 'KB' | 'MB' | 'GB' | 'TB' = 'GB';
  ramUnit: 'B' | 'KB' | 'MB' | 'GB' | 'TB' = 'GB';
  
  serversCache: any[] = [];
  private platformStatsById: Record<number, { total: number; up: number; down: number; maint: number }> = {};

  get canAddServer() {
    return ['ADMIN', 'DBA'].includes(this.authService.getRoleFromToken() || '');
  }

  // Platforms State
  platforms: any[] = [];
  platformSearch = '';

  get totalPlatforms(): number {
    return this.platforms.length;
  }

  get filteredPlatformsCount(): number {
    return this.filteredPlatforms.length;
  }

  get currentSgbdStats() { return this.dynamicSgbdStats; }
  get currentServerTypeStats() { return this.dynamicServerTypeStats; }
  get currentStatusStats() { return this.dynamicStatusStats; }
  get countMatchingSgbdAndType() { return this.countSgbdAndType; }
  get countMatchingStatusAndType() { return this.countStatusAndType; }
  get countMatchingStatusAndSgbd() { return this.countStatusAndSgbd; }

  updateDynamicStats() {
    if (!this.serversCache.length) return;

    const sStatus = this.selectedStatus;
    const sSgbd = (this.selectedSgbd || '').toLowerCase().trim();
    const sType = (this.selectedServerType || '').toLowerCase().trim();

    // 1. DYNAMIC SGBD STATS (Filtered by Status & Type)
    const sgbdCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = { 'UP': 0, 'DOWN': 0, 'MAINTENANCE': 0 };
    
    let cSgbdAndType = 0;
    let cStatusAndType = 0;
    let cStatusAndSgbd = 0;

    for (const s of this.serversCache) {
      const sName = (s.sgbdName || '').toString().trim();
      const sSgbdLower = sName.toLowerCase();
      const sRawType = s.serverTypeName || s.serverType?.name || '';
      const sTypeLower = String(sRawType).toLowerCase().trim();
      const sStat = s.status;

      const matchStatus = !sStatus || sStat === sStatus;
      const matchSgbd = !sSgbd || sSgbdLower === sSgbd;
      const matchType = !sType || sTypeLower === sType;

      // Stats for SGBD dropdown
      if (matchStatus && matchType && sName) {
        sgbdCounts[sName] = (sgbdCounts[sName] || 0) + 1;
      }
      // Stats for Type dropdown
      if (matchStatus && matchSgbd) {
        const typeLabel = String(sRawType).trim() || 'Type non renseigne';
        typeCounts[typeLabel] = (typeCounts[typeLabel] || 0) + 1;
      }
      // Stats for Status dropdown
      if (matchSgbd && matchType && sStat) {
        if (statusCounts.hasOwnProperty(sStat)) statusCounts[sStat]++;
      }

      // "All" options counters
      if (matchSgbd && matchType) cSgbdAndType++;
      if (matchStatus && matchType) cStatusAndType++;
      if (matchStatus && matchSgbd) cStatusAndSgbd++;
    }

    this.dynamicSgbdStats = Object.entries(sgbdCounts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
    this.dynamicServerTypeStats = Object.entries(typeCounts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
    this.dynamicStatusStats = statusCounts;
    this.countSgbdAndType = cSgbdAndType;
    this.countStatusAndType = cStatusAndType;
    this.countStatusAndSgbd = cStatusAndSgbd;
  }

  get filteredPlatforms() {
    if (!this.platforms.length) return [];
    
    const q = this.platformSearch ? this.platformSearch.toLowerCase().trim() : '';
    const selectedSgbd = this.selectedSgbd ? this.selectedSgbd.toString().trim() : null;
    const selectedStatus = this.selectedStatus;
    const selectedType = this.selectedServerType ? this.selectedServerType.toString().trim() : null;

    return this.platforms.filter((p: any) => {
      // 1. Filtrage par nom de plateforme
      const nameMatches = !q || (p.name || '').toLowerCase().includes(q);
      if (!nameMatches) return false;

      // 2. Vérification des serveurs de cette plateforme UNIQUEMENT si des filtres sont actifs
      const hasActiveFilters = !!selectedSgbd || !!selectedStatus || !!selectedType;
      if (!hasActiveFilters) return true;

      // 3. Récupération des serveurs de cette plateforme
      const platformServers = this.getPlatformServers(p);

      // 4. Filtrage des serveurs selon les critères sélectionnés
      const hasMatchingServer = platformServers.some((s: any) => {
        const sgbdMatch = !selectedSgbd || (s.sgbdName || '').toString().trim() === selectedSgbd;
        const statusMatch = !selectedStatus || s.status === selectedStatus;
        
        const rawType = s.serverTypeName || s.serverType?.name || '';
        const typeMatch = !selectedType || String(rawType).trim() === selectedType;

        return sgbdMatch && statusMatch && typeMatch;
      });

      return hasMatchingServer;
    });
  }

  clearPlatformSearch() {
    this.platformSearch = '';
  }

  get storagePercentage(): number {
    if (this.totalStorageCapacity === 0) return 0;
    return Math.round((this.totalStorageUsed / this.totalStorageCapacity) * 100);
  }

  get ramPercentage(): number {
    if (this.totalRamCapacity === 0) return 0;
    return Math.round((this.totalRamUsed / this.totalRamCapacity) * 100);
  }

  private getUnitMultiplier(unit: string): number {
    // Base unit is GB from backend
    // Multiplier to convert FROM GB TO target unit
    const multipliers: Record<string, number> = {
      'B': 1073741824,      // 1 GB = 1,073,741,824 Bytes
      'KB': 1048576,        // 1 GB = 1,048,576 KB
      'MB': 1024,           // 1 GB = 1,024 MB
      'GB': 1,              // Base unit
      'TB': 1 / 1024        // 1 GB = 0.0009765625 TB
    };
    return multipliers[unit] || 1;
  }

  formatBytes(bytes: number, unit: string): string {
    if (bytes === 0) return '0 ' + unit;
    const multiplier = this.getUnitMultiplier(unit);
    const value = bytes * multiplier;
    return Math.round(value * 100) / 100 + ' ' + unit;
  }

  getStorageDisplay(): string {
    return this.formatBytes(this.totalStorageUsed, this.storageUnit) + ' / ' + 
           this.formatBytes(this.totalStorageCapacity, this.storageUnit);
  }

  getRamDisplay(): string {
    return this.formatBytes(this.totalRamUsed, this.ramUnit) + ' / ' + 
           this.formatBytes(this.totalRamCapacity, this.ramUnit);
  }

  getStoragePercentageColor(): string {
    const pct = this.storagePercentage;
    if (pct >= 80) return '#ef4444';
    if (pct >= 60) return '#f59e0b';
    return '#10b981';
  }

  getRamPercentageColor(): string {
    const pct = this.ramPercentage;
    if (pct >= 80) return '#ef4444';
    if (pct >= 60) return '#f59e0b';
    return '#10b981';
  }

  getServerCount(platform: any) {
    const id = Number(platform?.id);
    if (!Number.isNaN(id) && this.platformStatsById[id]) {
      if (!this.selectedSgbd && !this.selectedStatus && !this.selectedServerType) {
        return this.platformStatsById[id].total;
      }
    }
    const servers = this.getPlatformFilteredServers(platform);
    return servers ? servers.length : 0;
  }

  getPlatformServers(platform: any): any[] {
    const id = Number(platform?.id);
    if (Number.isNaN(id)) return [];
    return this.getServersForPlatformId(id);
  }

  // Get platform stats (UP, DOWN, MAINTENANCE count)
  getPlatformStats(platform: any) {
    const id = Number(platform?.id);
    const hasActiveFilters = !!this.selectedSgbd || !!this.selectedStatus || !!this.selectedServerType;

    if (!Number.isNaN(id) && this.platformStatsById[id] && !hasActiveFilters) {
      return this.platformStatsById[id];
    }

    const servers = this.getPlatformFilteredServers(platform) || [];
    
    return {
      total: servers.length,
      up: servers.filter(s => s.status === 'UP').length,
      down: servers.filter(s => s.status === 'DOWN').length,
      maint: servers.filter(s => s.status === 'MAINTENANCE').length
    };
  }

  ngOnInit() {
    this.loadPlatforms();
    this.loadDashboardMetrics();
  }

  private loadDashboardMetrics() {
    const pageSize = 200;
    const allServers: any[] = [];
    let page = 0;

    const fetchPage = () => {
      this.serverService.getServers('', '', null, null, page, pageSize).subscribe({
        next: (res: any) => {
          const content = Array.isArray(res?.content) ? res.content : [];
          allServers.push(...content);

          const totalPages = res?.totalPages ?? res?.page?.totalPages ?? 1;
          const isLast = res?.last === true || page >= totalPages - 1;

          if (isLast) {
            this.applyMetrics(allServers);
            this.loading = false;
            return;
          }

          page += 1;
          fetchPage();
        },
        error: () => {
          this.loading = false;
        }
      });
    };

    fetchPage();
  }

  private applyMetrics(servers: any[]) {
    const validServers = servers.filter((s: any) => s?.status !== 'UNKNOWN');
    this.serversCache = validServers;
    this.totalServers = validServers.length;
    this.upCount = validServers.filter((s: any) => s?.status === 'UP').length;
    this.downCount = validServers.filter((s: any) => s?.status === 'DOWN').length;
    this.maintCount = validServers.filter((s: any) => s?.status === 'MAINTENANCE').length;
    this.sgbdStats = this.buildSgbdStats(validServers);
    this.serverTypeStats = this.buildServerTypeStats(validServers);
    this.calculateStorageAndRamMetrics(validServers);
    this.rebuildPlatformStats();
    this.updateDynamicStats();
  }

  private buildServerTypeStats(servers: any[]) {
    const counts: Record<string, number> = {};

    servers.forEach((server: any) => {
      const rawName = server?.serverTypeName || server?.serverType?.name || '';
      const name = String(rawName).trim() || 'Type non renseigne';
      counts[name] = (counts[name] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  private buildSgbdStats(servers: any[]) {
    const counts: Record<string, number> = {};

    servers.forEach((server: any) => {
      const name = (server?.sgbdName || '').toString().trim();
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  private calculateStorageAndRamMetrics(servers: any[]): void {
    this.totalStorageUsed = 0;
    this.totalStorageCapacity = 0;
    this.totalRamUsed = 0;
    this.totalRamCapacity = 0;
    this.totalCpu = 0;
    this.totalServersWithCpu = 0;

    servers.forEach((server: any) => {
      // CPU Metrics
      if (server?.cpu != null && !isNaN(server.cpu)) {
        this.totalCpu += Number(server.cpu);
        this.totalServersWithCpu++;
      }
      // RAM Metrics
      if (server?.ramUsed && !isNaN(server.ramUsed)) {
        this.totalRamUsed += server.ramUsed;
      }
      if (server?.ramTotal && !isNaN(server.ramTotal)) {
        this.totalRamCapacity += server.ramTotal;
      }

      // Storage Metrics (sum all disks)
      if (Array.isArray(server?.disks)) {
        server.disks.forEach((disk: any) => {
          // maxSize est la taille totale du disque
          if (disk?.maxSize && !isNaN(disk.maxSize)) {
            this.totalStorageCapacity += disk.maxSize;
            
            // Calculer l'espace utilisé à partir du pourcentage
            if (disk?.usedPercentage && !isNaN(disk.usedPercentage)) {
              const usedAmount = (disk.maxSize * disk.usedPercentage) / 100;
              this.totalStorageUsed += usedAmount;
            }
          }
        });
      }
    });
  }

  loadPlatforms() {
    this.adminService.getPlatforms().subscribe({
      next: (data) => {
        this.platforms = data;
        this.rebuildPlatformStats();
      },
      error: () => {}
    });
  }

  private rebuildPlatformStats() {
    const stats: Record<number, { total: number; up: number; down: number; maint: number }> = {};

    this.serversCache.forEach((server: any) => {
      const platformIds = Array.isArray(server?.platformIds)
        ? server.platformIds
        : (server?.platformId ? [server.platformId] : []);

      platformIds.forEach((pid: any) => {
        const platformId = Number(pid);
        if (Number.isNaN(platformId)) return;
        if (!stats[platformId]) {
          stats[platformId] = { total: 0, up: 0, down: 0, maint: 0 };
        }

        stats[platformId].total += 1;
        if (server?.status === 'UP') stats[platformId].up += 1;
        if (server?.status === 'DOWN') stats[platformId].down += 1;
        if (server?.status === 'MAINTENANCE') stats[platformId].maint += 1;
      });
    });

    this.platformStatsById = stats;
  }

  openPlatformServers(platform: any) {
    const queryParams: any = {};
    if (this.selectedSgbd) queryParams.sgbd = this.selectedSgbd;
    if (this.selectedStatus) queryParams.status = this.selectedStatus;
    this.router.navigate(['/platforms', platform.id], { queryParams });
  }

  setStatusFilter(status: 'UP' | 'DOWN' | 'MAINTENANCE' | null) {
    this.selectedStatus = status;
    this.updateDynamicStats();
  }

  clearAllDashboardFilters() {
    this.selectedStatus = null;
    this.selectedSgbd = null;
    this.selectedServerType = null;
    this.platformSearch = '';
    this.updateDynamicStats();
  }

  toggleSgbdFilter(name: string | null) {
    this.selectedSgbd = name;
    this.updateDynamicStats();
  }

  clearSgbdFilter() {
    this.selectedSgbd = null;
    this.updateDynamicStats();
  }

  toggleServerTypeFilter(name: string | null) {
    this.selectedServerType = name;
    this.updateDynamicStats();
  }

  clearServerTypeFilter() {
    this.selectedServerType = null;
    this.updateDynamicStats();
  }

  getPlatformServersByStatus(platform: any, statusOverride?: 'UP' | 'DOWN' | 'MAINTENANCE' | null): any[] {
    const status = statusOverride ?? this.selectedStatus;
    const servers = this.getPlatformServers(platform);
    if (!status) return servers;
    return servers.filter((server: any) => server?.status === status);
  }

  getPlatformFilteredServers(
    platform: any,
    overrides?: {
      sgbdOverride?: string;
      statusOverride?: 'UP' | 'DOWN' | 'MAINTENANCE' | null;
      serverTypeOverride?: string;
    }
  ): any[] {
    const sgbd = (overrides?.sgbdOverride ?? this.selectedSgbd ?? '').toLowerCase().trim();
    const status = overrides?.statusOverride ?? this.selectedStatus;
    const serverType = (overrides?.serverTypeOverride ?? this.selectedServerType ?? '').toLowerCase().trim();
    const servers = this.getPlatformServers(platform);

    return servers.filter((server: any) => {
      const sgbdMatch = !sgbd || (server?.sgbdName || '').toLowerCase().trim() === sgbd;
      const statusMatch = !status || server?.status === status;
      const rawType = server?.serverTypeName || server?.serverType?.name || '';
      const typeMatch = !serverType || String(rawType).toLowerCase().trim() === serverType;
      return sgbdMatch && statusMatch && typeMatch;
    });
  }

  getPlatformServersBySgbd(platform: any, sgbdOverride?: string): any[] {
    const sgbd = (sgbdOverride || this.selectedSgbd || '').toLowerCase().trim();
    const servers = this.getPlatformServers(platform);
    if (!sgbd) return servers;
    return servers.filter((server: any) =>
      (server?.sgbdName || '').toLowerCase().trim() === sgbd
    );
  }

  private getServersForPlatformId(platformId: number): any[] {
    if (!platformId) return [];
    return this.serversCache.filter((server: any) => {
      const ids = Array.isArray(server?.platformIds)
        ? server.platformIds
        : (server?.platformId ? [server.platformId] : []);
      return ids.some((id: any) => Number(id) === platformId);
    });
  }

  getServerDisplayName(server: any): string {
    return server?.hostname || server?.name || server?.instanceName || `Server ${server?.id ?? ''}`.trim();
  }
}
