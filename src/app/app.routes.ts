import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { StatisticsComponent } from './statistics/statistics';
import { ServerListComponent } from './server-list/server-list.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { ServerFormComponent } from './server-form/server-form.component';
import { ServerDetailComponent } from './server/server-detail/server-detail.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { PlatformDetailsComponent } from './platform-details/platform-details.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
    { path: 'statistics', component: StatisticsComponent, canActivate: [authGuard] },
    { path: 'servers', component: ServerListComponent, canActivate: [authGuard], data: { roles: ['ADMIN', 'DBA', 'VIEWER'] } },
    { path: 'servers/new', component: ServerFormComponent, canActivate: [authGuard], data: { roles: ['ADMIN', 'DBA'] } },
    { path: 'servers/:id', component: ServerDetailComponent, canActivate: [authGuard], data: { roles: ['ADMIN', 'DBA', 'VIEWER'] } },
    { path: 'servers/edit/:id', component: ServerFormComponent, canActivate: [authGuard], data: { roles: ['ADMIN', 'DBA'] } },
    { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard], data: { roles: ['ADMIN', 'DBA'] } },
    { path: 'admin/users', component: UserManagementComponent, canActivate: [authGuard], data: { roles: ['ADMIN'] } },
    { path: 'platforms/:id', component: PlatformDetailsComponent, canActivate: [authGuard], data: { roles: ['ADMIN', 'DBA', 'VIEWER'] } },
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
    { path: '**', redirectTo: '/dashboard' }
];
