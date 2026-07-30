import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
        router.navigate(['/login']);
        return false;
    }

    const expectedRoles = route.data['roles'] as Array<string>;
    if (expectedRoles && expectedRoles.length > 0) {
        const role = authService.getRoleFromToken();
        if (!role || !expectedRoles.includes(role)) {
            router.navigate(['/dashboard']);
            return false;
        }
    }

    return true;
};
