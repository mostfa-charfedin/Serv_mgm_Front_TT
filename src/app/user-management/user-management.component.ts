import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { UserService } from '../core/user.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  userService = inject(UserService);
  authService = inject(AuthService);
  snackBar = inject(MatSnackBar);

  activeUsers: any[] = [];
  archivedUsers: any[] = [];
  loading = false;
  activeTab = 0;
  displayedColumns: string[] = ['username', 'role', 'actions'];

  // User session
  currentUsername: string | null = null;

  // Form State
  editingUser: any = null;
  newUser = { username: '' };
  userForm = { password: '', role: 'DBA' };

  ngOnInit() {
    this.currentUsername = this.authService.getUsernameFromToken();
    this.loadUsers();
  }

  isCurrentUser(username: string): boolean {
    return this.currentUsername === username;
  }

  loadUsers() {
    this.loading = true;
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.activeUsers = users;
        this.loadArchivedUsers();
      },
      error: () => {
        this.snackBar.open('Failed to load users.', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadArchivedUsers() {
    this.userService.getArchivedUsers().subscribe({
      next: (users) => {
        this.archivedUsers = users;
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load archived users.', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  editUser(user: any) {
    this.editingUser = user;
    this.userForm = { password: '', role: user.role };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.editingUser = null;
    this.newUser = { username: '' };
    this.userForm = { password: '', role: 'DBA' };
  }

  saveUser() {
    if (this.editingUser) {
      // Update
      const payload: any = { role: this.userForm.role };
      if (this.userForm.password) payload.password = this.userForm.password;

      this.userService.updateUser(this.editingUser.id, payload).subscribe({
        next: () => {
          this.snackBar.open('User updated successfully.', 'Close', { duration: 3000 });
          this.cancelEdit();
          this.loadUsers();
        },
        error: () => this.snackBar.open('Failed to update user.', 'Close', { duration: 3000 })
      });
    } else {
      // Create
      const payload = { 
        username: this.newUser.username,
        password: this.userForm.password,
        role: this.userForm.role
      };

      this.userService.createUser(payload).subscribe({
        next: () => {
          this.snackBar.open('User created successfully.', 'Close', { duration: 3000 });
          this.cancelEdit();
          this.loadUsers();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Failed to create user.';
          this.snackBar.open(msg, 'Close', { duration: 3000 });
        }
      });
    }
  }

  archiveUser(userId: number, username: string) {
    if (!confirm(`Are you sure you want to archive user "${username}"? They can be restored later.`)) {
      return;
    }
    this.userService.archiveUser(userId).subscribe({
      next: () => {
        this.snackBar.open(`User "${username}" archived successfully.`, 'Close', { duration: 3000 });
        this.loadUsers();
      },
      error: () => {
        this.snackBar.open('Failed to archive user.', 'Close', { duration: 3000 });
      }
    });
  }

  restoreUser(userId: number, username: string) {
    if (!confirm(`Are you sure you want to restore user "${username}"?`)) {
      return;
    }
    this.userService.restoreUser(userId).subscribe({
      next: () => {
        this.snackBar.open(`User "${username}" restored successfully.`, 'Close', { duration: 3000 });
        this.loadUsers();
      },
      error: () => {
        this.snackBar.open('Failed to restore user.', 'Close', { duration: 3000 });
      }
    });
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'ADMIN': return 'role-admin';
      case 'DBA': return 'role-dba';
      case 'VIEWER': return 'role-viewer';
      default: return 'role-default';
    }
  }
}
