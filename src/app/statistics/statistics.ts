import { Component, OnInit, inject } from '@angular/core';
import { ServerService } from '../core/server.service';
import { AuthService } from '../core/auth.service';
import { AdminService } from '../core/admin.service';
import { Router } from '@angular/router';
import { Chart, registerables, ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-statistics',
  standalone: false,
  templateUrl: './statistics.html',
  styleUrls: ['./statistics.css']
})
export class StatisticsComponent implements OnInit {
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
  
  envChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  envChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { padding: 16 } } }
  };
  osChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  sgbdChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  sgbdReleaseCharts: Map<string, ChartConfiguration<'doughnut'>['data']> = new Map();
  serversCache: any[] = [];

  get canAddServer() {
    return ['ADMIN', 'DBA'].includes(this.authService.getRoleFromToken() || '');
  }

  get sgbdReleaseChartKeys(): string[] {
    return Array.from(this.sgbdReleaseCharts.keys());
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
    const multipliers: Record<string, number> = {
      'B': 1073741824,
      'KB': 1048576,
      'MB': 1024,
      'GB': 1,
      'TB': 1 / 1024
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

  ngOnInit() {
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
    this.envChartData = this.buildEnvChartData(validServers);
    this.osChartData = this.buildOsChartData(validServers);
    this.sgbdChartData = this.buildSgbdChartData(validServers);
    this.buildSgbdReleaseCharts(validServers);
    this.calculateStorageAndRamMetrics(validServers);
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

  private buildEnvChartData(servers: any[]): ChartConfiguration<'doughnut'>['data'] {
    const counts: Record<string, number> = {};
    servers.forEach((server: any) => {
      const envRaw = server?.environmentName || server?.environment || 'Non renseigne';
      const envLabel = String(envRaw).trim() || 'Non renseigne';
      counts[envLabel] = (counts[envLabel] || 0) + 1;
    });
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'],
        hoverOffset: 8
      }]
    };
  }

  private buildOsChartData(servers: any[]): ChartConfiguration<'doughnut'>['data'] {
    const counts: Record<string, number> = {};
    servers.forEach((server: any) => {
      const osNameRaw = server?.operatingSystemName || server?.operatingSystem?.name || 'Inconnu';
      const osVersionRaw = server?.operatingSystemVersion || server?.operatingSystem?.version || '';
      const osName = String(osNameRaw).trim();
      const osVersion = String(osVersionRaw).trim();
      const osLabel = osVersion ? `${osName} ${osVersion}` : osName;
      counts[osLabel] = (counts[osLabel] || 0) + 1;
    });
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6'],
        hoverOffset: 8
      }]
    };
  }

  private buildSgbdChartData(servers: any[]): ChartConfiguration<'doughnut'>['data'] {
    const counts: Record<string, number> = {};
    servers.forEach((server: any) => {
      const rawName = (server?.sgbdName || '').toString().trim();
      const label = rawName ? rawName : 'SGBD non renseigne';
      counts[label] = (counts[label] || 0) + 1;
    });
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#0ea5e9', '#38bdf8', '#f59e0b', '#10b981', '#ef4444', '#6366f1'],
        hoverOffset: 8
      }]
    };
  }

  private buildSgbdReleaseCharts(servers: any[]): void {
    this.sgbdReleaseCharts.clear();
    const colorPalette = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    const sgbdGroups: Record<string, any[]> = {};
    servers.forEach((server: any) => {
      const sgbdName = (server?.sgbdName || '').toString().trim() || 'SGBD non renseigne';
      if (!sgbdGroups[sgbdName]) sgbdGroups[sgbdName] = [];
      sgbdGroups[sgbdName].push(server);
    });
    Object.entries(sgbdGroups).forEach(([sgbdName, sgbdServers]) => {
      const releaseCounts: Record<string, number> = {};
      sgbdServers.forEach((server: any) => {
        const releaseName = (server?.sgbdReleaseName || '').toString().trim() || 'Release non renseignée';
        releaseCounts[releaseName] = (releaseCounts[releaseName] || 0) + 1;
      });
      this.sgbdReleaseCharts.set(sgbdName, {
        labels: Object.keys(releaseCounts),
        datasets: [{ data: Object.values(releaseCounts), backgroundColor: colorPalette, hoverOffset: 8 }]
      });
    });
  }

  private calculateStorageAndRamMetrics(servers: any[]): void {
    this.totalStorageUsed = 0; this.totalStorageCapacity = 0;
    this.totalRamUsed = 0; this.totalRamCapacity = 0;
    this.totalCpu = 0; this.totalServersWithCpu = 0;
    servers.forEach((server: any) => {
      if (server?.cpu != null && !isNaN(server.cpu)) { this.totalCpu += Number(server.cpu); this.totalServersWithCpu++; }
      if (server?.ramUsed && !isNaN(server.ramUsed)) this.totalRamUsed += server.ramUsed;
      if (server?.ramTotal && !isNaN(server.ramTotal)) this.totalRamCapacity += server.ramTotal;
      if (Array.isArray(server?.disks)) {
        server.disks.forEach((disk: any) => {
          if (disk?.maxSize && !isNaN(disk.maxSize)) {
            this.totalStorageCapacity += disk.maxSize;
            if (disk?.usedPercentage && !isNaN(disk.usedPercentage)) this.totalStorageUsed += (disk.maxSize * disk.usedPercentage) / 100;
          }
        });
      }
    });
  }

  setStatusFilter(status: 'UP' | 'DOWN' | 'MAINTENANCE') {
    this.selectedStatus = this.selectedStatus === status ? null : status;
  }

  clearAllDashboardFilters() {
    this.selectedStatus = null; this.selectedSgbd = null; this.selectedServerType = null;
  }

  toggleSgbdFilter(name: string) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    this.selectedSgbd = this.selectedSgbd === trimmed ? null : trimmed;
  }

  clearSgbdFilter() { this.selectedSgbd = null; }

  toggleServerTypeFilter(name: string) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    this.selectedServerType = this.selectedServerType === trimmed ? null : trimmed;
    if (this.selectedServerType) this.selectedStatus = null;
  }

  clearServerTypeFilter() { this.selectedServerType = null; }
}
