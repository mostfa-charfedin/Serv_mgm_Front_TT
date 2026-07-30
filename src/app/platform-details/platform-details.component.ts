import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import { ServerService } from '../core/server.service';
import { AdminService } from '../core/admin.service';

Chart.register(...registerables);

@Component({
  selector: 'app-platform-details',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatCardModule, MatButtonModule, 
    MatIconModule, MatChipsModule, MatProgressSpinnerModule, 
    MatTableModule, MatPaginatorModule, MatDialogModule, MatFormFieldModule, 
    MatInputModule, MatSelectModule, MatTabsModule, MatTooltipModule, FormsModule,
    BaseChartDirective
  ],
  templateUrl: './platform-details.component.html',
  styleUrls: ['./platform-details.component.css']
})
export class PlatformDetailsComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  locationUrl = inject(Location);
  serverService = inject(ServerService);
  adminService = inject(AdminService);

  platformId: number | null = null;
  platform: any = null;
  servers: any[] = [];
  loading = true;
  sgbdFilter = '';
  releaseFilter = '';
  statusFilter: 'UP' | 'DOWN' | 'MAINTENANCE' | '' = '';

  columns = ['hostname', 'status', 'ips', 'backup', 'alert'];
  clusterColumns = ['hostname', 'status', 'ips'];
  serverTypeFilter = '';
  instanceFilter = '';
  serverTypes: any[] = [];
  
  totalServers = 0;
  upCount = 0;
  downCount = 0;
  maintCount = 0;

  totalCpu = 0;
  totalRamTotal = 0;
  totalRamUsed = 0;
  totalDiskMax = 0;
  totalDiskUsed = 0;

  platformStatusChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  platformOsChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  platformEnvChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  platformSgbdChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  platformPieOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16 } }
    }
  };

  // Cluster Creation State
  showClusterForm = false;
  newClusterName = '';
  newClusterDesc = '';

  // Pagination
  pageIndex = 0;
  pageSize = 5;

  private filteredServersCache = new WeakMap<any[], { key: string; result: any[] }>();
  private environmentGroupsCache = new WeakMap<any[], Array<{ label: string; servers: any[] }>>();
  private sgbdGroupsCache = new WeakMap<any[], Array<{ label: string; servers: any[]; releases: Array<{ label: string; servers: any[] }> }>>();

  standaloneEnvironmentTabs: Array<{ label: string; servers: any[]; sgbdGroups: Array<{ label: string; servers: any[]; releases: Array<{ label: string; servers: any[] }> }> }> = [];
  clusterViews: Array<{ cluster: any; filteredCount: number; envTabs: Array<{ label: string; servers: any[]; sgbdGroups: Array<{ label: string; servers: any[]; releases: Array<{ label: string; servers: any[] }> }> }> }> = [];

  get paginatedServers(): any[] {
    const start = this.pageIndex * this.pageSize;
    return this.servers.slice(start, start + this.pageSize);
  }

  onPageChange(event: any) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  getServerTypeName(server: any): string {
    return server?.serverTypeName || server?.serverType?.name || '';
  }

  getInstanceNames(server: any): string[] {
    return (server?.instances || [])
      .map((inst: any) => inst?.name)
      .filter((name: string) => !!name);
  }

  filterPlatformServers(servers: any[]): any[] {
    const source = (servers || []) as any[];
    const typeQuery = this.serverTypeFilter.trim().toLowerCase();
    const instanceQuery = this.instanceFilter.trim().toLowerCase();
    const sgbdQuery = this.sgbdFilter.trim().toLowerCase();
    const releaseQuery = this.releaseFilter.trim().toLowerCase();
    const statusQuery = this.statusFilter;
    const cacheKey = `${typeQuery}|${instanceQuery}|${sgbdQuery}|${releaseQuery}|${statusQuery}`;

    const cached = this.filteredServersCache.get(source);
    if (cached && cached.key === cacheKey) {
      return cached.result;
    }

    const result = source.filter(server => {
      const typeMatch = !typeQuery || this.getServerTypeName(server).toLowerCase().includes(typeQuery);
      const instanceMatch = !instanceQuery || this.getInstanceNames(server).some(name => name.toLowerCase().includes(instanceQuery));
      const sgbdMatch = !sgbdQuery || (server?.sgbdName || '').toLowerCase().trim() === sgbdQuery;
      const releaseMatch = !releaseQuery || (server?.sgbdReleaseName || '').toLowerCase().trim() === releaseQuery;
      const statusMatch = !statusQuery || server?.status === statusQuery;
      return typeMatch && instanceMatch && sgbdMatch && releaseMatch && statusMatch;
    });

    this.filteredServersCache.set(source, { key: cacheKey, result });
    return result;
  }

  getSgbdGroups(servers: any[]): Array<{ label: string; servers: any[]; releases: Array<{ label: string; servers: any[] }> }> {
    const source = (servers || []) as any[];
    const cached = this.sgbdGroupsCache.get(source) as any;
    if (cached) {
      return cached;
    }

    const groups = new Map<string, any[]>();
    source.forEach((server: any) => {
      const rawName = (server?.sgbdName || '').toString().trim();
      const label = rawName ? rawName : 'SGBD non renseigne';
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(server);
    });

    const result = Array.from(groups.entries())
      .map(([label, list]) => {
        // Build releases for this SGBD
        const relMap = new Map<string, any[]>();
        list.forEach(s => {
          const rName = (s?.sgbdReleaseName || '').toString().trim() || 'Pas de release';
          if (!relMap.has(rName)) relMap.set(rName, []);
          relMap.get(rName)!.push(s);
        });
        const releases = Array.from(relMap.entries())
          .map(([rLabel, rList]) => ({ label: rLabel, servers: rList }))
          .sort((a, b) => a.label.localeCompare(b.label));

        return { label, servers: list, releases };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    this.sgbdGroupsCache.set(source, result);
    return result;
  }

  getEnvironmentGroups(servers: any[]): Array<{ label: string; servers: any[] }> {
    const source = (servers || []) as any[];
    const cached = this.environmentGroupsCache.get(source);
    if (cached) {
      return cached;
    }

    const groups = new Map<string, any[]>();
    source.forEach((server: any) => {
      const rawName = (server?.environmentName || server?.environment || '').toString().trim();
      const label = rawName ? rawName : 'Non renseigne';
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(server);
    });

    const result = Array.from(groups.entries())
      .map(([label, list]) => ({ label, servers: list }))
      .sort((a, b) => a.label.localeCompare(b.label));

    this.environmentGroupsCache.set(source, result);
    return result;
  }

  onServerFiltersChange() {
    this.clearGroupingCaches();
    this.rebuildServerViews();
  }

  ngOnInit() {
    this.adminService.getServerTypes().subscribe({
      next: (data) => this.serverTypes = data,
      error: () => {}
    });

    this.route.queryParamMap.subscribe(params => {
      this.sgbdFilter = params.get('sgbd') || '';
      const rawStatus = (params.get('status') || '').toUpperCase().trim();
      this.statusFilter = (rawStatus === 'UP' || rawStatus === 'DOWN' || rawStatus === 'MAINTENANCE')
        ? (rawStatus as 'UP' | 'DOWN' | 'MAINTENANCE')
        : '';
      this.clearGroupingCaches();
      if (this.platform) {
        this.calculateStats();
        this.rebuildServerViews();
      }
    });

    this.route.paramMap.subscribe(params => {
      this.platformId = Number(params.get('id'));
      if (this.platformId) {
        this.fetchData();
      } else {
        this.loading = false;
      }
    });
  }

  fetchData() {
    this.loading = true;
    this.adminService.getPlatformById(this.platformId!).subscribe({
        next: (platform) => {
            this.platform = platform;
          this.clearGroupingCaches();
            this.calculateStats();
            this.rebuildServerViews();
            this.loading = false;
        },
        error: () => {
            this.loading = false;
            this.platform = null;
        }
    });
  }

  private clearGroupingCaches() {
      this.filteredServersCache = new WeakMap<any[], { key: string; result: any[] }>();
      this.environmentGroupsCache = new WeakMap<any[], Array<{ label: string; servers: any[] }>>();
      this.sgbdGroupsCache = new WeakMap<any[], Array<{ label: string; servers: any[]; releases: Array<{ label: string; servers: any[] }> }>>();
  }

  private rebuildServerViews() {
      if (!this.platform) return;
      
      const standalone = this.filterPlatformServers(this.platform.servers || []);
      this.standaloneEnvironmentTabs = this.buildEnvironmentTabs(standalone);

      this.clusterViews = (this.platform.clusters || []).map((cluster: any) => {
          const filtered = this.filterPlatformServers(cluster.servers || []);
          return {
              cluster,
              filteredCount: filtered.length,
              envTabs: this.buildEnvironmentTabs(filtered)
          };
      });
  }

  private buildEnvironmentTabs(servers: any[]): Array<{ label: string; servers: any[]; sgbdGroups: Array<{ label: string; servers: any[]; releases: Array<{ label: string; servers: any[] }> }> }> {
      return this.getEnvironmentGroups(servers).map(envGroup => ({
          ...envGroup,
          sgbdGroups: this.getSgbdGroups(envGroup.servers)
      }));
  }

  setStatusFilter(status: 'UP' | 'DOWN' | 'MAINTENANCE' | '') {
    this.statusFilter = this.statusFilter === status ? '' : status;
    this.onServerFiltersChange();
  }

  calculateStats() {
      if (!this.platform) return;
      
      const allServers: any[] = [];
      if (this.platform.servers) allServers.push(...this.platform.servers);
      if (this.platform.clusters) {
          this.platform.clusters.forEach((c: any) => {
              if (c.servers) allServers.push(...c.servers);
          });
      }

      const sgbdQuery = this.sgbdFilter.trim().toLowerCase();
      const statusQuery = this.statusFilter;
      const scopedServersBySgbd = !sgbdQuery
        ? allServers
        : allServers.filter(s => (s?.sgbdName || '').toLowerCase().trim() === sgbdQuery);

      const scopedServers = !statusQuery
        ? scopedServersBySgbd
        : scopedServersBySgbd.filter(s => s?.status === statusQuery);

      this.totalServers = scopedServers.length;
      this.upCount = scopedServers.filter(s => s.status === 'UP').length;
      this.downCount = scopedServers.filter(s => s.status === 'DOWN').length;
      this.maintCount = scopedServers.filter(s => s.status === 'MAINTENANCE').length;

      this.totalCpu = 0;
      this.totalRamTotal = 0;
      this.totalRamUsed = 0;
      this.totalDiskMax = 0;
      this.totalDiskUsed = 0;

      scopedServers.forEach(s => {
          this.totalCpu += (s.cpu || 0);
          this.totalRamTotal += (s.ramTotal || 0);
          this.totalRamUsed += (s.ramUsed || 0);
          
          if (s.disks && s.disks.length > 0) {
              s.disks.forEach((d: any) => {
                  this.totalDiskMax += (d.maxSize || 0);
                  const available = d.availableStorage || 0;
                  const max = d.maxSize || 0;
                  this.totalDiskUsed += Math.max(0, max - available);
              });
          }
      });

      this.platformStatusChartData = {
        labels: ['UP', 'DOWN', 'Maintenance'],
        datasets: [{
          data: [this.upCount, this.downCount, this.maintCount],
          backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
          hoverOffset: 8
        }]
      };

      this.platformOsChartData = this.buildOsChartData(scopedServers);
      this.platformEnvChartData = this.buildEnvChartData(scopedServers);
      this.platformSgbdChartData = this.buildSgbdChartData(scopedServers);
  }

  private buildEnvChartData(servers: any[]): ChartConfiguration<'doughnut'>['data'] {
    const counts: Record<string, number> = {};
    servers.forEach((s: any) => {
      const label = s.environmentName || s.environment || 'Non renseigne';
      counts[label] = (counts[label] || 0) + 1;
    });
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'],
        hoverOffset: 8
      }]
    };
  }

  private buildOsChartData(servers: any[]): ChartConfiguration<'doughnut'>['data'] {
    const counts: Record<string, number> = {};
    servers.forEach((s: any) => {
      const label = s.operatingSystemName || 'Inconnu';
      counts[label] = (counts[label] || 0) + 1;
    });
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'],
        hoverOffset: 8
      }]
    };
  }

  private buildSgbdChartData(servers: any[]): ChartConfiguration<'doughnut'>['data'] {
    const counts: Record<string, number> = {};
    servers.forEach((s: any) => {
      const label = s.sgbdName || 'SGBD non renseigne';
      counts[label] = (counts[label] || 0) + 1;
    });
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#0ea5e9', '#38bdf8', '#f59e0b', '#10b981', '#ef4444'],
        hoverOffset: 8
      }]
    };
  }

  goBack() {
    this.locationUrl.back();
  }

  hasServerIssue(server: any): boolean {
    if (!server) return false;
    if (server.status === 'DOWN') return true;
    if (server.cpuUsage >= 80) return true;
    if (server.ramUsage >= 80) return true;
    if (server.disks && server.disks.some((d: any) => d.usedPercent >= 80)) return true;
    return false;
  }

  formatStorage(gbValue: number): string {
    if (!gbValue || isNaN(gbValue)) return '0 GB';
    if (gbValue >= 1024) {
      return (gbValue / 1024).toFixed(2) + ' TB';
    }
    if (gbValue < 1 && gbValue > 0) {
      return (gbValue * 1024).toFixed(0) + ' MB';
    }
    return gbValue.toFixed(2) + ' GB';
  }

  getServerRowClass(server: any): string {
    return this.hasServerIssue(server) ? 'server-row-alert' : 'server-row-healthy';
  }

  buildServerDetailQueryParams(): Record<string, string | number> {
    const params: Record<string, string | number> = { 
      source: 'platform',
      platformId: this.platformId || ''
    };
    if (this.sgbdFilter) params['sgbd'] = this.sgbdFilter;
    if (this.statusFilter) params['status'] = this.statusFilter;
    return params;
  }

  createCluster() {
    if (!this.newClusterName || !this.platformId) return;
    this.adminService.createCluster({
      name: this.newClusterName,
      description: this.newClusterDesc,
      platformId: this.platformId
    }).subscribe({
      next: () => {
        this.newClusterName = '';
        this.newClusterDesc = '';
        this.showClusterForm = false;
        this.fetchData();
      },
      error: () => {}
    });
  }
}
