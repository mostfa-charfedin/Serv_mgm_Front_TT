import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { ServerService } from '../../core/server.service';
import { AuthService } from '../../core/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

class DdMmYyyyDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    const raw = String(value).trim();
    const dmyDash = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
    const dmySlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
    const ymdDash = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

    if (dmyDash) {
      return new Date(Number(dmyDash[3]), Number(dmyDash[2]) - 1, Number(dmyDash[1]));
    }
    if (dmySlash) {
      return new Date(Number(dmySlash[3]), Number(dmySlash[2]) - 1, Number(dmySlash[1]));
    }
    if (ymdDash) {
      return new Date(Number(ymdDash[1]), Number(ymdDash[2]) - 1, Number(ymdDash[3]));
    }

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  override format(date: Date): string {
    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
}

const DD_MM_YYYY_FORMATS = {
  parse: {
    dateInput: 'input'
  },
  display: {
    dateInput: 'input',
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' }
  }
};

@Component({
  selector: 'app-server-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatCardModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatDividerModule, MatChipsModule,
    MatTabsModule, MatPaginatorModule, MatSnackBarModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    BaseChartDirective
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: DateAdapter, useClass: DdMmYyyyDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: DD_MM_YYYY_FORMATS }
  ],
  templateUrl: './server-detail.component.html',
  styleUrls: ['./server-detail.component.css']
})
export class ServerDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serverService = inject(ServerService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  server: any;
  loading = true;

  get isAdmin(): boolean {
    const role = this.authService.getRoleFromToken();
    return role === 'ADMIN' || role === 'DBA';
  }

  cpuChartData: any;
  ramChartData: any;
  chartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '70%',
    plugins: { legend: { display: false } }
  };

  // Backup History State per type
  historyData: { [key: string]: any[] } = {};
  historyTotals: { [key: string]: number } = {};
  historyPages: { [key: string]: number } = {};
  historyPageSizes: { [key: string]: number } = {};

  // Error filters/sort
  errorNameFilter = '';
  errorDateFrom: Date | null = null;
  errorDateTo: Date | null = null;
  errorSortDirection: 'asc' | 'desc' = 'desc';
  source: 'platform' | 'servers' = 'servers';
  sourcePlatformId: number | null = null;
  sourceSgbd = '';
  sourceStatus = '';

  ngOnInit() {
    this.resolveNavigationContext();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.serverService.getServer(+id).subscribe({
        next: (data) => {
          this.server = data;
          this.initCharts();
          this.loading = false;
          
          if (this.server.backupEnabled && this.server.backupPolicy) {
            this.server.backupPolicy.backupTypes?.forEach((bt: any) => {
               this.loadHistory(bt.typeBackup, 0, 5);
            });
          }
        },
        error: () => this.loading = false
      });
    }
  }

  private resolveNavigationContext() {
    const sourceRaw = (this.route.snapshot.queryParamMap.get('source') || '').trim().toLowerCase();
    this.source = sourceRaw === 'platform' ? 'platform' : 'servers';

    const platformIdRaw = this.route.snapshot.queryParamMap.get('platformId');
    const parsed = platformIdRaw ? Number(platformIdRaw) : NaN;
    this.sourcePlatformId = Number.isNaN(parsed) ? null : parsed;

    this.sourceSgbd = (this.route.snapshot.queryParamMap.get('sgbd') || '').trim();
    this.sourceStatus = (this.route.snapshot.queryParamMap.get('status') || '').trim().toUpperCase();
  }

  goBackToSource() {
    if (this.source === 'platform' && this.sourcePlatformId) {
      const queryParams: Record<string, string> = {};
      if (this.sourceSgbd) queryParams['sgbd'] = this.sourceSgbd;
      if (this.sourceStatus) queryParams['status'] = this.sourceStatus;
      this.router.navigate(['/platforms', this.sourcePlatformId], { queryParams });
      return;
    }

    this.router.navigate(['/servers']);
  }

  getEditQueryParams(): Record<string, string | number> {
    const params: Record<string, string | number> = { source: this.source };
    if (this.sourcePlatformId) params['platformId'] = this.sourcePlatformId;
    if (this.sourceSgbd) params['sgbd'] = this.sourceSgbd;
    if (this.sourceStatus) params['status'] = this.sourceStatus;
    return params;
  }

  getCloneQueryParams(): Record<string, string | number> {
    const params = this.getEditQueryParams();
    params['cloneId'] = this.server?.id;
    return params;
  }

  exportServerExcel() {
    if (!this.server?.id) return;
    this.serverService.exportServerExcel(this.server.id).subscribe({
      next: (blob) => {
        const fileName = `server_${this.server.hostname || this.server.id}.xlsx`;
        this.downloadBlob(blob, fileName);
        this.snackBar.open('Export Excel termine.', 'Fermer', { duration: 2500 });
      },
      error: () => this.snackBar.open('Erreur export Excel.', 'Fermer', { duration: 3000 })
    });
  }

  importServerExcel() {
    if (!this.server?.id) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      this.serverService.importServerExcel(this.server.id, file).subscribe({
        next: (result: any) => {
          if (result?.errors && result.errors > 0) {
            const details = (result?.errorMessages || []).join(' | ');
            this.snackBar.open(`Import partiel: ${details || 'voir logs'}`, 'Fermer', { duration: 6000 });
            return;
          }

          this.snackBar.open('Import Excel termine.', 'Fermer', { duration: 3000 });
          this.serverService.getServer(this.server.id).subscribe({
            next: (data) => {
              this.server = data;
              this.initCharts();
            }
          });
        },
        error: () => this.snackBar.open('Erreur import Excel.', 'Fermer', { duration: 4000 })
      });
    };
    input.click();
  }

  private downloadBlob(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  initCharts() {
    const cpuDanger = (this.server.cpuUsage || 0) >= 80;
    const ramUsagePercent = this.getRamPercent();
    const ramDanger = ramUsagePercent >= 80;

    this.cpuChartData = {
      labels: ['Used', 'Free'],
      datasets: [{
        data: [this.server.cpuUsage || 0, 100 - (this.server.cpuUsage || 0)],
        backgroundColor: [cpuDanger ? '#ef4444' : '#6366f1', '#f1f5f9'],
        borderWidth: 0
      }]
    };
    
    this.ramChartData = {
      labels: ['Used', 'Free'],
      datasets: [{
        data: [ramUsagePercent, 100 - ramUsagePercent],
        backgroundColor: [ramDanger ? '#ef4444' : '#0ea5e9', '#f1f5f9'],
        borderWidth: 0
      }]
    };
  }

  getRamPercent(): number {
    const percent = this.server?.ramPercentage;
    if (typeof percent === 'number' && percent > 0) {
      return Math.max(0, Math.min(100, Math.round(percent)));
    }
    const total = this.server?.ramTotal || 0;
    const used = this.server?.ramUsed || 0;
    if (!total) return 0;
    if (used > total) {
      return Math.max(0, Math.min(100, Math.round((total / used) * 100)));
    }
    return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
  }

  getRamFreePercent(): number {
    const used = this.getRamPercent();
    return Math.max(0, Math.min(100, 100 - used));
  }

  getRamAvailable(): number | null {
    const total = this.server?.ramTotal;
    const used = this.server?.ramUsed;
    if (typeof total !== 'number' || typeof used !== 'number') return null;
    return Math.max(0, total - used);
  }

  getRamUsedDisplay(): number | null {
    const total = this.server?.ramTotal;
    const used = this.server?.ramUsed;
    if (typeof used !== 'number') return null;
    if (typeof total !== 'number' || total <= 0) return used;
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

  getDiskUsed(disk: any): number | null {
    if (!disk) return null;
    const maxSize = disk.maxSize;
    const available = disk.availableStorage;
    if (typeof maxSize !== 'number' || typeof available !== 'number') return null;
    return Math.max(0, maxSize - available);
  }

  formatStorage(gbValue: number | null | undefined): string {
    if (gbValue === null || gbValue === undefined || isNaN(gbValue)) return '—';
    if (gbValue >= 1024) {
      return (gbValue / 1024).toFixed(2) + ' TB';
    }
    if (gbValue < 1 && gbValue > 0) {
      return (gbValue * 1024).toFixed(2) + ' MB';
    }
    return gbValue.toFixed(2) + ' GB';
  }

  getBackupTypes() {
    return this.server?.backupPolicy?.backupTypes || [];
  }

  formatDays(daysStr: string): string {
    if (!daysStr) return '—';
    if (daysStr === 'EVERYDAY') return 'Chaque Jour';
    
    const dayMap: { [key: string]: string } = {
        'MON': 'Lundi', 'TUE': 'Mardi', 'WED': 'Mercredi',
        'THU': 'Jeudi', 'FRI': 'Vendredi', 'SAT': 'Samedi', 'SUN': 'Dimanche'
    };

    return daysStr.split(',')
                  .map(d => dayMap[d] || d)
                  .join(', ');
  }

  loadHistory(typeBackup: string, page: number, size: number) {
    const url = `${environment.apiUrl}/servers/${this.server.id}/backup-history?backupType=${typeBackup}&page=${page}&size=${size}&sort=scheduledDate,desc`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.historyData[typeBackup] = (res.content || res.data || []).map((h: any) => ({ ...h, isEditing: false, editComment: h.userComment }));
        const totalCount = res.totalElements ?? res.total_elements ?? (res.page ? res.page.totalElements : null) ?? (res.page ? res.page.total_elements : null);
        this.historyTotals[typeBackup] = (totalCount !== null && totalCount !== undefined) ? totalCount : (this.historyData[typeBackup]?.length || 0);
        this.historyPages[typeBackup] = page;
        this.historyPageSizes[typeBackup] = size;
      }
    });
  }

  getHistoryForCurrentTab(typeBackup: string) {
    return this.historyData[typeBackup] || [];
  }

  onHistoryPageChange(typeBackup: string, event: any) {
    this.loadHistory(typeBackup, event.pageIndex, event.pageSize);
  }

  editHistory(historyItem: any) {
    historyItem.isEditing = true;
    historyItem.editComment = historyItem.userComment;
  }

  cancelEditHistory(historyItem: any) {
    historyItem.isEditing = false;
  }

  saveHistory(historyItem: any, passed: boolean) {
    const payload = {
      ...historyItem,
      passed: passed,
      userComment: historyItem.editComment
    };

    this.http.put(`${environment.apiUrl}/servers/backup-history/${historyItem.id}`, payload).subscribe({
      next: (res: any) => {
        historyItem.passed = res.passed;
        historyItem.userComment = res.userComment;
        historyItem.isEditing = false;
        this.snackBar.open('Historique mis à jour', 'Fermer', { duration: 3000 });
      },
      error: () => this.snackBar.open('Erreur lors de la mise à jour', 'Fermer', { duration: 3000 })
    });
  }

  isHighDisk(disk: any): boolean {
    return disk.usedPercentage >= 80;
  }

  isHighTS(ts: any): boolean {
    return ts.usedPercent >= 80;
  }

  private parseFlexibleDate(value: unknown, endOfDay = false): Date | null {
    if (!value) {
      return null;
    }

    let parsed: Date | null = null;

    if (value instanceof Date) {
      parsed = new Date(value.getTime());
    } else {
      const raw = String(value).trim();

      // Support typed formats: yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy.
      const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
      const dmySlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
      const dmyDash = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);

      if (ymd) {
        parsed = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      } else if (dmySlash) {
        parsed = new Date(Number(dmySlash[3]), Number(dmySlash[2]) - 1, Number(dmySlash[1]));
      } else if (dmyDash) {
        parsed = new Date(Number(dmyDash[3]), Number(dmyDash[2]) - 1, Number(dmyDash[1]));
      } else {
        const fallback = new Date(raw);
        parsed = Number.isNaN(fallback.getTime()) ? null : fallback;
      }
    }

    if (!parsed || Number.isNaN(parsed.getTime())) {
      return null;
    }

    if (endOfDay) {
      parsed.setHours(23, 59, 59, 999);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }

    return parsed;
  }

  getFilteredErrors(): any[] {
    const nameQuery = this.errorNameFilter.trim().toLowerCase();
    const fromDate = this.parseFlexibleDate(this.errorDateFrom, false);
    const toDate = this.parseFlexibleDate(this.errorDateTo, true);

    return [...(this.server?.serverErrors || [])]
      .filter((errorItem: any) => {
        const errorName = (errorItem?.errorName || '').toLowerCase();
        const appearanceDate = this.parseFlexibleDate(errorItem?.appearanceDate, false);
        const nameMatch = !nameQuery || errorName.includes(nameQuery);
        const fromMatch = !fromDate || !appearanceDate || appearanceDate >= fromDate;
        const toMatch = !toDate || !appearanceDate || appearanceDate <= toDate;
        return nameMatch && fromMatch && toMatch;
      })
      .sort((left, right) => {
        const leftDate = left?.appearanceDate ? new Date(left.appearanceDate).getTime() : 0;
        const rightDate = right?.appearanceDate ? new Date(right.appearanceDate).getTime() : 0;
        return this.errorSortDirection === 'asc' ? leftDate - rightDate : rightDate - leftDate;
      });
  }

  clearErrorFilters(): void {
    this.errorNameFilter = '';
    this.errorDateFrom = null;
    this.errorDateTo = null;
    this.errorSortDirection = 'desc';
  }

  getSynchronizedInstances(): any[] {
    return (this.server?.instances || []).filter((inst: any) => inst.isSynchronized);
  }

  getUnsynchronizedInstances(): any[] {
    return (this.server?.instances || []).filter((inst: any) => !inst.isSynchronized);
  }

  getTableSpaceGroups(): Array<{ instanceName: string; tableSpaces: any[] }> {
    const tableSpaces: any[] = this.server?.tableSpaces || [];
    const groups = new Map<string, any[]>();

    tableSpaces.forEach((ts: any) => {
      const instanceName = (ts?.instanceName || 'Sans instance').trim() || 'Sans instance';
      const current = groups.get(instanceName) || [];
      current.push(ts);
      groups.set(instanceName, current);
    });

    return Array.from(groups.entries())
      .map(([instanceName, groupedTableSpaces]) => ({
        instanceName,
        tableSpaces: groupedTableSpaces
      }))
      .sort((a, b) => a.instanceName.localeCompare(b.instanceName));
  }
}
