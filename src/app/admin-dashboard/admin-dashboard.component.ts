import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule } from '@angular/material/paginator';
import { AdminService } from '../core/admin.service';
import { AuthService } from '../core/auth.service';
import { AuditTrailComponent } from './audit-trail.component';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatCardModule, MatButtonModule, MatIconModule,
        MatInputModule, MatFormFieldModule, MatSelectModule, MatTableModule,
        MatDialogModule, MatSnackBarModule, MatTabsModule,
        MatProgressSpinnerModule,
        MatPaginatorModule,
        AuditTrailComponent
    ],
    templateUrl: './admin-dashboard.component.html',
    styles: [`
    .page-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }
    .page-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #6366f1;
    }
    .page-header h2 {
      margin: 0 0 4px;
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
    }
    .subtitle { margin: 0; color: #64748b; font-size: 14px; }

    .admin-tabs {
      border-radius: 12px;
    }

    .tab-content {
      padding: 24px 0;
    }

    .form-card, .table-card {
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important;
    }
    .card-icon {
      background: #ede9fe;
      color: #6366f1;
      border-radius: 8px;
      padding: 4px;
    }

    .inline-form {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .flex-1 { flex: 1; min-width: 160px; }
    .flex-2 { flex: 2; min-width: 200px; }

    .w-100 { width: 100%; }
    .search-field { margin-bottom: 8px; }

    .spinner-center {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    .empty-hint {
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      padding: 24px;
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
    adminService = inject(AdminService);
    authService = inject(AuthService);
    snackBar = inject(MatSnackBar);

    userRole: string | null = null;

    // --- OS state ---
    operatingSystems: any[] = [];
    osSearch = '';
    osColumns = ['name', 'version', 'actions'];
    loadingOS = false;
    editingOS: any = null;
    osForm: any = { name: '', version: '' };

    // --- Server Types state ---
    serverTypes: any[] = [];
    stSearch = '';
    stColumns = ['name', 'description', 'actions'];
    loadingST = false;
    editingST: any = null;
    stForm: any = { name: '', description: '' };

    // --- Platforms state ---
    platforms: any[] = [];
    platformSearch = '';
    platformColumns = ['name', 'description', 'actions'];
    loadingPlatform = false;
    editingPlatform: any = null;
    platformForm: any = { name: '', description: '' };
    platformPageIndex = 0;
    platformPageSize = 10;

    // --- Clusters state ---
    clusters: any[] = [];
    clusterSearch = '';
    clusterColumns = ['name', 'platform', 'description', 'actions'];
    loadingCluster = false;
    editingCluster: any = null;
    clusterForm: any = { name: '', description: '', platformId: null };
    clusterPageIndex = 0;
    clusterPageSize = 10;

    // --- SGBD state ---
    sgbds: any[] = [];
    sgbdSearch = '';
    sgbdColumns = ['name', 'actions'];
    loadingSgbd = false;
    editingSgbd: any = null;
    sgbdForm: any = { name: '', releaseName: '' };

    // --- SGBD Releases state ---
    sgbdReleases: any[] = [];
    sgbdReleaseSearch = '';
    sgbdReleaseColumns = ['name', 'actions'];
    loadingSgbdRelease = false;
    editingSgbdRelease: any = null;
    sgbdReleaseForm: any = { sgbdId: null, name: '' };
    sgbdReleaseFilterId: number | null = null;

    // --- Environments state ---
    environments: any[] = [];
    environmentSearch = '';
    environmentColumns = ['name', 'description', 'actions'];
    loadingEnvironment = false;
    editingEnvironment: any = null;
    environmentForm: any = { name: '', description: '' };


    get filteredOperatingSystems(): any[] {
      const query = this.osSearch.trim().toLowerCase();
      if (!query) return this.operatingSystems;
      return this.operatingSystems.filter(os =>
        (os.name || '').toLowerCase().includes(query) ||
        (os.version || '').toLowerCase().includes(query)
      );
    }

    get filteredServerTypes(): any[] {
      const query = this.stSearch.trim().toLowerCase();
      if (!query) return this.serverTypes;
      return this.serverTypes.filter(st =>
        (st.name || '').toLowerCase().includes(query) ||
        (st.description || '').toLowerCase().includes(query)
      );
    }

    get filteredPlatforms(): any[] {
      const query = this.platformSearch.trim().toLowerCase();
      let list = this.platforms;
      if (query) {
        list = list.filter(p =>
          (p.name || '').toLowerCase().includes(query) ||
          (p.description || '').toLowerCase().includes(query)
        );
      }
      return list;
    }

    get filteredClusters(): any[] {
      const query = this.clusterSearch.trim().toLowerCase();
      let list = this.clusters;
      if (query) {
        list = list.filter(c =>
          (c.name || '').toLowerCase().includes(query) ||
          (c.platformName || '').toLowerCase().includes(query) ||
          (c.description || '').toLowerCase().includes(query)
        );
      }
      return list;
    }

    get paginatedClusters(): any[] {
        const start = this.clusterPageIndex * this.clusterPageSize;
        return this.filteredClusters.slice(start, start + this.clusterPageSize);
    }

    get paginatedPlatforms(): any[] {
        const start = this.platformPageIndex * this.platformPageSize;
        return this.filteredPlatforms.slice(start, start + this.platformPageSize);
    }

        get filteredSgbds(): any[] {
            const query = this.sgbdSearch.trim().toLowerCase();
            if (!query) return this.sgbds;
            return this.sgbds.filter(s =>
                (s.name || '').toLowerCase().includes(query)
            );
        }

        get filteredSgbdReleases(): any[] {
            const query = this.sgbdReleaseSearch.trim().toLowerCase();
            if (!query) return this.sgbdReleases;
            return this.sgbdReleases.filter(r =>
                (r.name || '').toLowerCase().includes(query)
            );
        }

        get filteredEnvironments(): any[] {
            const query = this.environmentSearch.trim().toLowerCase();
            if (!query) return this.environments;
            return this.environments.filter(e =>
                (e.name || '').toLowerCase().includes(query) ||
                (e.description || '').toLowerCase().includes(query)
            );
        }
    
    onPlatformPage(event: any) {
        this.platformPageIndex = event.pageIndex;
        this.platformPageSize = event.pageSize;
    }

    onPlatformSearchChange() {
        this.platformPageIndex = 0;
    }

    onClusterPage(event: any) {
        this.clusterPageIndex = event.pageIndex;
        this.clusterPageSize = event.pageSize;
    }

    onClusterSearchChange() {
        this.clusterPageIndex = 0;
    }

    ngOnInit() {
        this.userRole = this.authService.getRoleFromToken();
        this.loadOS();
        this.loadST();
        this.loadPlatforms();
        this.loadClusters();
        this.loadSgbds();
        this.loadEnvironments();
    }

    isAdmin(): boolean {
        return this.userRole === 'ADMIN';
    }

    isDBA(): boolean {
        return this.userRole === 'DBA';
    }

    // ===== OS Methods =====
    loadOS() {
        this.loadingOS = true;
        this.adminService.getOperatingSystems().subscribe({
            next: d => { this.operatingSystems = d; this.loadingOS = false; },
            error: () => { this.snackBar.open('Failed to load OS list.', 'Close', { duration: 3000 }); this.loadingOS = false; }
        });
    }

    editOS(os: any) {
        this.editingOS = os;
        this.osForm = { name: os.name, version: os.version || '' };
    }

    cancelOSEdit() {
        this.editingOS = null;
        this.osForm = { name: '', version: '' };
    }

    saveOS() {
        if (!this.osForm.name) {
            this.snackBar.open('Veuillez renseigner le nom de l\'OS.', 'Fermer', { duration: 3000 });
            return;
        }
        const req = this.editingOS
            ? this.adminService.updateOperatingSystem(this.editingOS.id, this.osForm)
            : this.adminService.createOperatingSystem(this.osForm);

        req.subscribe({
            next: () => {
                this.snackBar.open(this.editingOS ? 'OS mis à jour !' : 'OS créé !', 'Fermer', { duration: 2500 });
                this.cancelOSEdit();
                this.loadOS();
            },
            error: () => this.snackBar.open('L\'opération a échoué.', 'Fermer', { duration: 3000 })
        });
    }

    deleteOS(id: number) {
        if (!confirm('Delete this OS? It may affect existing servers.')) return;
        this.adminService.deleteOperatingSystem(id).subscribe({
            next: () => { this.snackBar.open('OS deleted.', 'Close', { duration: 2500 }); this.loadOS(); },
            error: () => this.snackBar.open('Cannot delete — OS is in use.', 'Close', { duration: 3000 })
        });
    }

    // ===== Server Type Methods =====
    loadST() {
        this.loadingST = true;
        this.adminService.getServerTypes().subscribe({
            next: d => { this.serverTypes = d; this.loadingST = false; },
            error: () => { this.snackBar.open('Failed to load server types.', 'Close', { duration: 3000 }); this.loadingST = false; }
        });
    }

    editST(st: any) {
        this.editingST = st;
        this.stForm = { name: st.name, description: st.description || '' };
    }

    cancelSTEdit() {
        this.editingST = null;
        this.stForm = { name: '', description: '' };
    }

    saveST() {
        if (!this.stForm.name) return;
        const req = this.editingST
            ? this.adminService.updateServerType(this.editingST.id, this.stForm)
            : this.adminService.createServerType(this.stForm);

        req.subscribe({
            next: () => {
                this.snackBar.open(this.editingST ? 'Server type updated!' : 'Server type created!', 'Close', { duration: 2500 });
                this.cancelSTEdit();
                this.loadST();
            },
            error: () => this.snackBar.open('Operation failed.', 'Close', { duration: 3000 })
        });
    }

    deleteST(id: number) {
        if (!confirm('Delete this server type? It may affect existing servers.')) return;
        this.adminService.deleteServerType(id).subscribe({
            next: () => { this.snackBar.open('Server type deleted.', 'Close', { duration: 2500 }); this.loadST(); },
            error: () => this.snackBar.open('Cannot delete — type is in use.', 'Close', { duration: 3000 })
        });
    }

    // ===== Platform Methods =====
    loadPlatforms() {
        this.loadingPlatform = true;
        this.adminService.getPlatforms().subscribe({
            next: d => { this.platforms = d; this.loadingPlatform = false; },
            error: () => { this.snackBar.open('Failed to load platforms.', 'Close', { duration: 3000 }); this.loadingPlatform = false; }
        });
    }

    editPlatform(p: any) {
        this.editingPlatform = p;
        this.platformForm = { name: p.name, description: p.description || '' };
    }

    cancelPlatformEdit() {
        this.editingPlatform = null;
        this.platformForm = { name: '', description: '' };
    }

    savePlatform() {
        if (!this.platformForm.name) return;
        const req = this.editingPlatform
            ? this.adminService.updatePlatform(this.editingPlatform.id, this.platformForm)
            : this.adminService.createPlatform(this.platformForm);

        req.subscribe({
            next: () => {
                this.snackBar.open(this.editingPlatform ? 'Platform updated!' : 'Platform created!', 'Close', { duration: 2500 });
                this.cancelPlatformEdit();
                this.loadPlatforms();
            },
            error: (err: any) => {
                const msg = err?.error?.message || 'Operation failed.';
                this.snackBar.open(msg, 'Close', { duration: 3000 });
            }
        });
    }

    deletePlatform(id: number) {
        if (!confirm('Delete this platform? It may affect existing servers.')) return;
        this.adminService.deletePlatform(id).subscribe({
            next: () => { this.snackBar.open('Platform deleted.', 'Close', { duration: 2500 }); this.loadPlatforms(); },
            error: () => this.snackBar.open('Cannot delete — platform is in use.', 'Close', { duration: 3000 })
        });
    }

    // ===== Cluster Methods =====
    loadClusters() {
        this.loadingCluster = true;
        this.adminService.getClusters().subscribe({
            next: d => { this.clusters = d; this.loadingCluster = false; },
            error: () => { this.snackBar.open('Failed to load clusters.', 'Close', { duration: 3000 }); this.loadingCluster = false; }
        });
    }

    editCluster(c: any) {
        this.editingCluster = c;
        this.clusterForm = { name: c.name, description: c.description || '', platformId: c.platformId };
    }

    cancelClusterEdit() {
        this.editingCluster = null;
        this.clusterForm = { name: '', description: '', platformId: null };
    }

    saveCluster() {
        if (!this.clusterForm.name || !this.clusterForm.platformId) {
            this.snackBar.open('Note: Saisir nom et plateforme.', 'Fermer', { duration: 3000 });
            return;
        }
        const req = this.editingCluster
            ? this.adminService.updateCluster(this.editingCluster.id, this.clusterForm)
            : this.adminService.createCluster(this.clusterForm);

        req.subscribe({
            next: () => {
                this.snackBar.open(this.editingCluster ? 'Cluster mis à jour!' : 'Cluster créé!', 'Fermer', { duration: 2500 });
                this.cancelClusterEdit();
                this.loadClusters();
            },
            error: (err: any) => {
                const msg = err?.error?.message || 'L\'opération a échoué.';
                this.snackBar.open(msg, 'Fermer', { duration: 3000 });
            }
        });
    }

    deleteCluster(id: number) {
        if (!confirm('Voulez-vous supprimer ce cluster ?')) return;
        this.adminService.deleteCluster(id).subscribe({
            next: () => { this.snackBar.open('Cluster supprimé.', 'Fermer', { duration: 2500 }); this.loadClusters(); },
            error: () => this.snackBar.open('Impossible de supprimer — Cluster utilisé.', 'Fermer', { duration: 3000 })
        });
    }

    // ===== SGBD Methods =====
    loadSgbds() {
        this.loadingSgbd = true;
        this.adminService.getSgbds().subscribe({
            next: d => {
                this.sgbds = d;
                this.loadingSgbd = false;
                if (this.sgbdReleaseFilterId == null && this.sgbds.length > 0) {
                    this.sgbdReleaseFilterId = this.sgbds[0].id;
                    this.loadSgbdReleases(this.sgbdReleaseFilterId);
                }
            },
            error: () => { this.snackBar.open('Failed to load SGBD list.', 'Close', { duration: 3000 }); this.loadingSgbd = false; }
        });
    }

    editSgbd(s: any) {
        this.editingSgbd = s;
        this.sgbdForm = { name: s.name, releaseName: '' };
    }

    cancelSgbdEdit() {
        this.editingSgbd = null;
        this.sgbdForm = { name: '', releaseName: '' };
    }

    saveSgbd() {
        if (!this.sgbdForm.name) return;
        const req = this.editingSgbd
            ? this.adminService.updateSgbd(this.editingSgbd.id, this.sgbdForm)
            : this.adminService.createSgbd(this.sgbdForm);

        req.subscribe({
            next: (res) => {
                this.snackBar.open(this.editingSgbd ? 'SGBD mis a jour !' : 'SGBD cree !', 'Fermer', { duration: 2500 });
                const releaseName = (this.sgbdForm.releaseName || '').trim();
                const sgbdId = this.editingSgbd ? this.editingSgbd.id : res?.id;
                if (releaseName && sgbdId) {
                    this.adminService.createSgbdRelease(sgbdId, { name: releaseName }).subscribe({
                        next: () => {
                            this.loadSgbdReleases(this.sgbdReleaseFilterId || sgbdId);
                        },
                        error: () => {
                            this.snackBar.open('Release non cree.', 'Fermer', { duration: 3000 });
                        }
                    });
                }
                this.cancelSgbdEdit();
                this.loadSgbds();
            },
            error: () => this.snackBar.open('Operation echouee.', 'Fermer', { duration: 3000 })
        });
    }

    deleteSgbd(id: number) {
        if (!confirm('Supprimer ce SGBD ?')) return;
        this.adminService.deleteSgbd(id).subscribe({
            next: () => { this.snackBar.open('SGBD supprime.', 'Fermer', { duration: 2500 }); this.loadSgbds(); },
            error: () => this.snackBar.open('Impossible de supprimer — SGBD utilise.', 'Fermer', { duration: 3000 })
        });
    }

    // ===== SGBD Release Methods =====
    onSgbdReleaseFilterChange() {
        this.loadSgbdReleases(this.sgbdReleaseFilterId);
    }

    loadSgbdReleases(sgbdId: number | null) {
        if (!sgbdId) {
            this.sgbdReleases = [];
            return;
        }
        this.loadingSgbdRelease = true;
        this.adminService.getSgbdReleases(sgbdId).subscribe({
            next: d => { this.sgbdReleases = d; this.loadingSgbdRelease = false; },
            error: () => { this.snackBar.open('Failed to load SGBD releases.', 'Close', { duration: 3000 }); this.loadingSgbdRelease = false; }
        });
    }

    editSgbdRelease(r: any) {
        this.editingSgbdRelease = r;
        this.sgbdReleaseForm = { sgbdId: r.sgbdId, name: r.name };
    }

    cancelSgbdReleaseEdit() {
        this.editingSgbdRelease = null;
        this.sgbdReleaseForm = { sgbdId: null, name: '' };
    }

    saveSgbdRelease() {
        if (!this.sgbdReleaseForm.sgbdId || !this.sgbdReleaseForm.name) return;
        const req = this.editingSgbdRelease
            ? this.adminService.updateSgbdRelease(this.editingSgbdRelease.id, this.sgbdReleaseForm)
            : this.adminService.createSgbdRelease(this.sgbdReleaseForm.sgbdId, this.sgbdReleaseForm);

        req.subscribe({
            next: () => {
                this.snackBar.open(this.editingSgbdRelease ? 'Release mis a jour !' : 'Release cree !', 'Fermer', { duration: 2500 });
                this.sgbdReleaseFilterId = this.sgbdReleaseForm.sgbdId;
                this.cancelSgbdReleaseEdit();
                this.loadSgbdReleases(this.sgbdReleaseFilterId);
            },
            error: () => this.snackBar.open('Operation echouee.', 'Fermer', { duration: 3000 })
        });
    }

    deleteSgbdRelease(id: number) {
        if (!confirm('Supprimer ce release ?')) return;
        this.adminService.deleteSgbdRelease(id).subscribe({
            next: () => { this.snackBar.open('Release supprime.', 'Fermer', { duration: 2500 }); this.loadSgbdReleases(this.sgbdReleaseFilterId); },
            error: () => this.snackBar.open('Impossible de supprimer — Release utilise.', 'Fermer', { duration: 3000 })
        });
    }

    // ===== Environment Methods =====
    loadEnvironments() {
        this.loadingEnvironment = true;
        this.adminService.getEnvironments().subscribe({
            next: d => { this.environments = d; this.loadingEnvironment = false; },
            error: () => { this.snackBar.open('Failed to load environments.', 'Close', { duration: 3000 }); this.loadingEnvironment = false; }
        });
    }

    editEnvironment(e: any) {
        this.editingEnvironment = e;
        this.environmentForm = { name: e.name, description: e.description || '' };
    }

    cancelEnvironmentEdit() {
        this.editingEnvironment = null;
        this.environmentForm = { name: '', description: '' };
    }

    saveEnvironment() {
        if (!this.environmentForm.name) return;
        const req = this.editingEnvironment
            ? this.adminService.updateEnvironment(this.editingEnvironment.id, this.environmentForm)
            : this.adminService.createEnvironment(this.environmentForm);

        req.subscribe({
            next: () => {
                this.snackBar.open(this.editingEnvironment ? 'Environment updated!' : 'Environment created!', 'Close', { duration: 2500 });
                this.cancelEnvironmentEdit();
                this.loadEnvironments();
            },
            error: () => this.snackBar.open('Operation failed.', 'Close', { duration: 3000 })
        });
    }

    deleteEnvironment(id: number) {
        if (!confirm('Delete this environment?')) return;
        this.adminService.deleteEnvironment(id).subscribe({
            next: () => { this.snackBar.open('Environment deleted.', 'Close', { duration: 2500 }); this.loadEnvironments(); },
            error: () => this.snackBar.open('Cannot delete — environment is in use.', 'Close', { duration: 3000 })
        });
    }

}
