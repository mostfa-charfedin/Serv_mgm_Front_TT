import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuditService } from '../core/audit.service';

@Component({
  selector: 'app-audit-trail',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
    FormsModule
  ],
  templateUrl: './audit-trail.component.html',
  styleUrls: ['./audit-trail.component.css']
})
export class AuditTrailComponent implements OnInit, OnDestroy {
  auditService = inject(AuditService);
  snackBar = inject(MatSnackBar);

  auditLogs: any[] = [];
  displayedColumns: string[] = ['actionDate', 'username', 'action', 'description'];

  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  loading = false;

  // Filters
  filterType: string = 'all';
  usernameFilter: string = '';

  selectedAction: string = '';
  startDate: Date | null = null;
  endDate: Date | null = null;

  actions = ['CREATE', 'UPDATE', 'DELETE'];

  // Debounce for text inputs
  private textFilterSubject = new Subject<string>();
  private subs = new Subscription();

  ngOnInit() {
    // Debounce text filters (400ms)
    this.subs.add(
      this.textFilterSubject.pipe(
        debounceTime(400),
        distinctUntilChanged()
      ).subscribe(() => {
        this.pageIndex = 0;
        this.loadAuditLogs();
      })
    );
    this.loadAuditLogs();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  loadAuditLogs() {
    this.loading = true;
    let request$;

    switch (this.filterType) {
      case 'user':
        if (!this.usernameFilter.trim()) {
          request$ = this.auditService.getAllAuditLogs(this.pageIndex, this.pageSize);
        } else {
          request$ = this.auditService.getAuditLogsByUser(this.usernameFilter.trim(), this.pageIndex, this.pageSize);
        }
        break;



      case 'action':
        if (!this.selectedAction) {
          request$ = this.auditService.getAllAuditLogs(this.pageIndex, this.pageSize);
        } else {
          request$ = this.auditService.getAuditLogsByAction(this.selectedAction, this.pageIndex, this.pageSize);
        }
        break;

      case 'dateRange':
        if (!this.startDate || !this.endDate) {
          this.loading = false;
          return;
        }
        const start = new Date(this.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(this.endDate);
        end.setHours(23, 59, 59, 999);

        if (end < start) {
          this.snackBar.open('La date de fin doit être après la date de début.', 'Fermer', { duration: 3000 });
          this.loading = false;
          return;
        }
        request$ = this.auditService.getAuditLogsByDateRange(start, end, this.pageIndex, this.pageSize);
        break;

      default:
        request$ = this.auditService.getAllAuditLogs(this.pageIndex, this.pageSize);
    }

      this.subs.add(
        request$.subscribe({
          next: (res: any) => {
            const content = res.content ?? (res._embedded ? res._embedded[Object.keys(res._embedded).filter(k => k !== '_links')[0]] : null) ?? (Array.isArray(res) ? res : []);
            const totalCount = res.totalElements ?? res.total_elements ?? (res.page ? res.page.totalElements : null) ?? (res.page ? res.page.total_elements : null);

            this.auditLogs = content || [];
            this.totalElements = (totalCount !== null && totalCount !== undefined) ? totalCount : this.auditLogs.length;
            this.loading = false;
          },
          error: (err: any) => {
          console.error('Erreur audit:', err);
          this.snackBar.open('Erreur lors du chargement des logs d\'audit.', 'Fermer', { duration: 3000 });
          this.loading = false;
        }
      })
    );
  }

  /** Called when filter type dropdown changes */
  onFilterTypeChange() {
    this.pageIndex = 0;
    this.usernameFilter = '';

    this.selectedAction = '';
    this.startDate = null;
    this.endDate = null;
    this.loadAuditLogs();
  }

  /** Called on text input (debounced) */
  onTextInput() {
    this.textFilterSubject.next(this.usernameFilter.trim().toLowerCase());
  }

  /** Called when action select changes */
  onActionChange() {
    this.pageIndex = 0;
    this.loadAuditLogs();
  }

  /** Called when date changes */
  onDateChange() {
    if (this.startDate && this.endDate) {
      this.pageIndex = 0;
      this.loadAuditLogs();
    }
  }

  /** Reset all filters */
  resetFilters() {
    this.filterType = 'all';
    this.usernameFilter = '';

    this.selectedAction = '';
    this.startDate = null;
    this.endDate = null;
    this.pageIndex = 0;
    this.loadAuditLogs();
  }

  /** Paginator */
  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadAuditLogs();
  }

  getActionIcon(action: string): string {
    switch (action?.toUpperCase()) {
      case 'CREATE': return 'add_circle';
      case 'UPDATE': return 'edit';
      case 'DELETE': return 'delete';
     
      default: return 'info';
    }
  }

  formatDate(date: string): string {
    if (!date) return '—';
    return new Date(date).toLocaleString('fr-FR');
  }

  showDetails(log: any) {
    if (log.entityDetails) {
      try {
        const parsed = JSON.parse(log.entityDetails);
        alert('Détails:\n' + JSON.stringify(parsed, null, 2));
      } catch {
        alert('Détails:\n' + log.entityDetails);
      }
    }
  }
}
