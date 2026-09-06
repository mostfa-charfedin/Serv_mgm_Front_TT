import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize, Subscription } from 'rxjs';
import {
    FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ServerService } from '../core/server.service';
import { AdminService } from '../core/admin.service';

@Component({
    selector: 'app-server-form',
    standalone: false,
    templateUrl: './server-form.component.html',
    styleUrls: ['./server-form.component.css']
})
export class ServerFormComponent implements OnInit {
    fb = inject(FormBuilder);
    serverService = inject(ServerService);
    adminService = inject(AdminService);
    route = inject(ActivatedRoute);
    router = inject(Router);
    snackBar = inject(MatSnackBar);

    form!: FormGroup;
    isEdit = false;
    isCloneMode = false;
    serverId: number | null = null;
    loading = false;
    saving = false;
    serverTypes: any[] = [];
    operatingSystems: any[] = [];
    sgbds: any[] = [];
    sgbdReleases: any[] = [];
    environments: any[] = [];
    platforms: any[] = [];
    clusters: any[] = [];
    platformSearchText = '';
    instanceOptions: { id: number | null; name: string }[] = [];
    private instanceNameSubscriptions: Subscription[] = [];
    source: 'platform' | 'servers' = 'servers';
    sourcePlatformId: number | null = null;
    sourceSgbd = '';
    sourceStatus = '';

    // Inline ServerType Creation
    showSTForm = false;
    newSTName = '';
    newSTDesc = '';

    // Inline OperatingSystem Creation
    showOSForm = false;
    newOSName = '';
    newOSVersion = '';

    // Inline Environment Creation
    showEnvironmentForm = false;
    newEnvironmentName = '';
    newEnvironmentDesc = '';

    // Inline SGBD Creation
    showSgbdForm = false;
    newSgbdName = '';

    // Inline SGBD Release Creation
    showSgbdReleaseForm = false;
    newSgbdReleaseName = '';

    // Inline Cluster Creation
    showClusterForm = false;
    newClusterName = '';
    newClusterDesc = '';

    // Inline Platform Creation
    showPlatformForm = false;
    newPlatformName = '';
    newPlatformDesc = '';

    get filteredPlatformOptions(): any[] {
        const q = this.platformSearchText.trim().toLowerCase();
        if (!q) return this.platforms;
        return this.platforms.filter(p =>
            (p.name || '').toLowerCase().includes(q)
            || String(p.id || '').includes(q)
        );
    }

    get selectedPlatformIds(): number[] {
        const value = this.form?.get('platformIds')?.value;
        return Array.isArray(value) ? value : [];
    }

    get selectedPlatforms(): any[] {
        const ids = new Set(this.selectedPlatformIds);
        return this.platforms.filter(p => ids.has(p.id));
    }

    get selectedPlatformNames(): string[] {
        return this.selectedPlatforms.map(p => p.name || `Platform ${p.id}`);
    }

    backupTypeSuggestions = [
        { value: 'FULL', label: 'Full' },
        { value: 'INC', label: 'Incrémental' },
        { value: 'DIFF_INC', label: 'Différentiel Incrémental' },
        { value: 'TRANSACTION_LOG', label: 'Transaction Log' },
        { value: 'CUSTOM', label: 'Personnalisé' }
    ];

    dayOptions = [
        { value: 'MON', label: 'Lundi' },
        { value: 'TUE', label: 'Mardi' },
        { value: 'WED', label: 'Mercredi' },
        { value: 'THU', label: 'Jeudi' },
        { value: 'FRI', label: 'Vendredi' },
        { value: 'SAT', label: 'Samedi' },
        { value: 'SUN', label: 'Dimanche' },
        { value: 'EVERYDAY', label: 'Chaque Jour' }
    ];

    maxDateTimeLocal = this.toDateTimeLocalValue(new Date());

    ngOnInit() {
        this.resolveNavigationContext();
        this.buildForm();
        this.loadDropdowns();

        this.form.get('platformIds')?.valueChanges.subscribe((platformIds: number[] | null) => {
            const primaryPlatformId = this.getPrimaryPlatformId(platformIds);
            if (primaryPlatformId) {
                this.adminService.getClustersByPlatform(primaryPlatformId).subscribe({ next: d => this.clusters = d });
            } else {
                this.clusters = [];
                this.form.get('clusterId')?.setValue(null);
            }
        });

        this.form.get('backupPolicy.policyName')?.valueChanges.subscribe(() => {
            const control = this.form.get('backupPolicy.policyName');
            if (control?.hasError('backendUnique')) {
                const errors = { ...(control.errors || {}) };
                delete errors['backendUnique'];
                control.setErrors(Object.keys(errors).length ? errors : null);
            }
        });

        this.form.get('serverTypeId')?.valueChanges.subscribe(typeId => {
            // OS is now independent
        });

        this.form.get('sgbdId')?.valueChanges.subscribe(sgbdId => {
            this.loadSgbdReleases(sgbdId || null);
            this.form.get('sgbdReleaseId')?.setValue(null);
            this.syncSgbdVersionFromSelection(sgbdId);
            this.showSgbdReleaseForm = false;
        });

        this.form.get('sgbdReleaseId')?.valueChanges.subscribe(releaseId => {
            this.syncSgbdReleaseSelection(releaseId);
        });

        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEdit = true;
            this.serverId = +id;
            this.loadServer(this.serverId);
            return;
        }

        const cloneId = this.route.snapshot.queryParamMap.get('cloneId');
        if (cloneId) {
            this.isEdit = false;
            this.isCloneMode = true;
            this.loadServer(+cloneId, true);
        }
    }

    updateBackupValidators(enabled: boolean) {
        const policyName = this.form.get('backupPolicy')?.get('policyName');
        const backupAddress = this.form.get('backupPolicy')?.get('backupAddress');

        if (enabled) {
            backupAddress?.setValidators([Validators.required]);
        } else {
            policyName?.clearValidators();
            backupAddress?.clearValidators();
        }

        policyName?.updateValueAndValidity();
        backupAddress?.updateValueAndValidity();
    }

    buildForm() {
        this.form = this.fb.group({
            hostname: ['', Validators.required],
            ipAddress: ['', Validators.required],
            environmentId: [null, Validators.required],
            status: ['UP', Validators.required],
            serverMode: ['VIRTUAL', Validators.required],
            serverTypeId: [null, Validators.required],
            operatingSystemId: [null, Validators.required],
            sgbdId: [null],
            sgbdReleaseId: [null],
            platformIds: [[]],
            clusterId: [null],
            clusterRole: [null],
            sgbdVersion: [''],
            cpu: [0, [Validators.min(0)]],
            cpuUsage: [0],
            ramUsed: [0],
            ramTotal: [0],
            ramPercentage: [0],
            availabilityGroupEnabled: [false],
            comment: [''],
            instances: this.fb.array([], this.uniqueInstanceNamesValidator.bind(this)),
            disks: this.fb.array([], this.uniqueDiskNamesValidator.bind(this)),
            tableSpaces: this.fb.array([], this.uniqueTableSpaceNamesValidator.bind(this)),
            serverErrors: this.fb.array([]),
            availabilityGroups: this.fb.array([], this.uniqueAvailabilityGroupNamesValidator.bind(this)),
            backupPolicy: this.fb.group({
                id: [null],
                policyName: [''],
                backupAddress: [''],
                generalComment: ['']
            })
        }, { validators: [this.ramUsageValidator.bind(this)] });
    }

    ramUsageValidator(control: AbstractControl): ValidationErrors | null {
        const used = control.get('ramUsed')?.value;
        const total = control.get('ramTotal')?.value;
        if (used == null || total == null) return null;
        if (total === '' || used === '') return null;
        const usedNum = Number(used);
        const totalNum = Number(total);
        if (Number.isNaN(usedNum) || Number.isNaN(totalNum)) return null;
        return totalNum >= usedNum ? null : { ramUsedExceedsTotal: true };
    }

    uniqueDiskNamesValidator(control: AbstractControl): ValidationErrors | null {
        const arr = control as FormArray;
        const names = arr.controls
            .map(c => this.normalizeForUnique(c.get('name')?.value))
            .filter(n => !!n);
        const uniqueNames = new Set(names);
        if (uniqueNames.size !== names.length) return { duplicateDiskNames: true };
        return null;
    }

    uniqueInstanceNamesValidator(control: AbstractControl): ValidationErrors | null {
        const arr = control as FormArray;
        const names = arr.controls
            .map(c => this.normalizeForUnique(c.get('name')?.value))
            .filter(n => !!n);
        const uniqueNames = new Set(names);
        if (uniqueNames.size !== names.length) return { duplicateInstanceNames: true };
        return null;
    }

    uniqueTableSpaceNamesValidator(control: AbstractControl): ValidationErrors | null {
        const arr = control as FormArray;
        const namesByInstance = new Map<string, string[]>();
        arr.controls.forEach(c => {
            const instance = this.normalizeForUnique(c.get('instanceName')?.value);
            const name = this.normalizeForUnique(c.get('name')?.value);
            if (!instance || !name) return;
            const names = namesByInstance.get(instance) || [];
            names.push(name);
            namesByInstance.set(instance, names);
        });
        if ([...namesByInstance.values()].some(names => new Set(names).size !== names.length)) {
            return { duplicateTableSpaceNames: true };
        }
        return null;
    }

    uniqueAvailabilityGroupNamesValidator(control: AbstractControl): ValidationErrors | null {
        const arr = control as FormArray;
        const names = arr.controls
            .map(c => this.normalizeForUnique(c.get('groupName')?.value))
            .filter(n => !!n);
        const uniqueNames = new Set(names);
        if (uniqueNames.size !== names.length) return { duplicateAvailabilityGroupNames: true };
        return null;
    }

    notFutureDateTimeValidator(control: AbstractControl): ValidationErrors | null {
        const value = control.value;
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return { invalidDateTime: true };
        return parsed.getTime() <= Date.now() ? null : { futureDateTime: true };
    }

    loadDropdowns() {
        this.adminService.getServerTypes().subscribe({ next: d => this.serverTypes = d, error: () => { } });
        this.adminService.getAllOperatingSystems().subscribe({ next: d => this.operatingSystems = d, error: () => { } });
        this.adminService.getSgbds().subscribe({ next: d => this.sgbds = d, error: () => { } });
        this.adminService.getEnvironments().subscribe({
            next: d => {
                this.environments = d;
                if (!this.isEdit && !this.isCloneMode) {
                    const current = this.form?.get('environmentId')?.value;
                    const exists = this.environments.some(env => env.id === current);
                    if (!exists && this.environments.length > 0) {
                        this.form?.patchValue({ environmentId: this.environments[0].id });
                    }
                }
            },
            error: () => { }
        });
        this.adminService.getPlatforms().subscribe({ next: d => this.platforms = d, error: () => { } });
    }

    loadServer(id: number, asClone = false) {
        this.loading = true;
        this.serverService.getServer(id)
            .pipe(finalize(() => { this.loading = false; }))
            .subscribe({
                next: (server: any) => {
                    try {
                        this.clearInstanceNameSubscriptions();
                        this.diskArray.clear();
                        this.instanceArray.clear();
                        this.tableSpaceArray.clear();
                        this.serverErrorArray.clear();

                        const platformIdsToSet: number[] = Array.isArray(server.platformIds)
                            ? server.platformIds
                            : (server.platformId ? [server.platformId] : []);
                        const primaryPlatformId = this.getPrimaryPlatformId(platformIdsToSet);
                        if (primaryPlatformId) {
                            this.adminService.getClustersByPlatform(primaryPlatformId).subscribe({ next: d => {
                                this.clusters = d;
                                this.form.patchValue({ clusterId: server.clusterId || null });
                            }});
                        }

                        this.form.patchValue({
                            hostname: asClone ? `${server.hostname}-copy` : server.hostname,
                            ipAddress: server.ipAddress,
                            environmentId: server.environmentId || this.resolveEnvironmentIdFromName(server.environmentName || server.environment),
                            status: server.status,
                            serverMode: server.serverMode,
                            serverTypeId: server.serverTypeId,
                            operatingSystemId: server.operatingSystemId,
                            sgbdId: server.sgbdId || null,
                            sgbdReleaseId: server.sgbdReleaseId || null,
                            platformIds: platformIdsToSet,
                            clusterRole: server.clusterRole,
                            sgbdVersion: server.sgbdVersion,
                            cpu: server.cpu != null ? server.cpu : 0,
                            cpuUsage: server.cpuUsage || 0,
                            ramUsed: server.ramUsed || 0,
                            ramTotal: server.ramTotal || 0,
                            ramPercentage: server.ramPercentage || 0,
                            comment: server.comment || '',
                        });

                        this.form.patchValue({
                            backupPolicy: {
                                id: server.backupPolicy?.id || null,
                                policyName: server.backupPolicy?.policyName || '',
                                backupAddress: server.backupPolicy?.backupAddress || '',
                                generalComment: server.backupPolicy?.generalComment || ''
                            }
                        });
                        (server.instances || []).forEach((inst: any) => this.addInstance(
                            inst.name, inst.isSynchronized, inst.id, inst.files || [], inst.backupTypes || []
                        ));
                        (server.disks || []).forEach((d: any) => this.addDisk(d.name, d.maxSize, d.usedPercentage, d.availableStorage, d.id));
                        (server.tableSpaces || []).forEach((ts: any) =>
                            this.addTableSpace(ts.name, ts.capacity, ts.usedPercent, ts.id, ts.instanceName || '')
                        );
                        (server.serverErrors || []).forEach((se: any) => this.addServerError(
                            se.errorName,
                            se.description,
                            this.toDateTimeLocalValue(se.appearanceDate),
                            se.id
                        ));
                        if (server.availabilityGroup) {
                            const ag = server.availabilityGroup;
                            this.addAvailabilityGroup(ag.groupName, ag.groupStatus, ag.id);
                        }
                        if (server.availabilityGroup) {
                            this.form.patchValue({ availabilityGroupEnabled: true });
                        }

                        if (asClone) {
                            this.form.patchValue({
                                clusterId: null,
                                clusterRole: null
                            });
                            this.form.markAsDirty();
                        }

                        if (server.sgbdId) {
                            this.loadSgbdReleases(server.sgbdId);
                        }
                        this.refreshInstanceOptions();
                    } catch (err) {
                        console.error('loadServer failed', err);
                        this.snackBar.open('Erreur lors du chargement des donnees.', 'Fermer', { duration: 3000 });
                    }
                },
                error: () => {
                    this.snackBar.open('Erreur lors du chargement des donnees.', 'Fermer', { duration: 3000 });
                }
            });
    }

    get instanceArray(): FormArray { return this.form.get('instances') as FormArray; }
    get diskArray(): FormArray { return this.form.get('disks') as FormArray; }
    get tableSpaceArray(): FormArray { return this.form.get('tableSpaces') as FormArray; }
    get serverErrorArray(): FormArray { return this.form.get('serverErrors') as FormArray; }
    get availabilityGroupArray(): FormArray { return this.form.get('availabilityGroups') as FormArray; }
    getInstanceBackupTypesArray(instanceIndex: number): FormArray {
        return this.instanceArray.at(instanceIndex).get('backupTypes') as FormArray;
    }

    addInstance(name = '', isSynchronized = false, id = null, files: any[] = [], backupTypes: any[] = []) {
        const group = this.fb.group({
            id: [id],
            name: [name, Validators.required],
            isSynchronized: [isSynchronized],
            files: this.fb.array([]),
            backupTypes: this.fb.array([])
        });
        this.instanceArray.push(group);

        const instanceIndex = this.instanceArray.length - 1;
        if (files && files.length > 0) {
            files.forEach(f => this.addInstanceFile(instanceIndex, f.fileName, f.size, f.autoExtensible, f.comment, f.id));
        }
        (backupTypes || []).forEach((bt: any) =>
            this.addBackupType(instanceIndex, bt.typeBackup, bt.storagePath, bt.selectedDays, bt.scheduleStartTime, bt.id, bt)
        );

        const sub = group.get('name')?.valueChanges.subscribe(() => {
            this.refreshInstanceOptions();
        });
        if (sub) {
            this.instanceNameSubscriptions.push(sub);
        }

        this.refreshInstanceOptions();
    }
    removeInstance(i: number) {
        const sub = this.instanceNameSubscriptions[i];
        if (sub) {
            sub.unsubscribe();
            this.instanceNameSubscriptions.splice(i, 1);
        }
        this.instanceArray.removeAt(i);
        this.refreshInstanceOptions();
    }

    getInstanceFileArray(instanceIndex: number): FormArray {
        return this.instanceArray.at(instanceIndex).get('files') as FormArray;
    }

    addInstanceFile(instanceIndex: number, fileName = '', size = null, autoExtensible = false, comment = '', id = null) {
        this.getInstanceFileArray(instanceIndex).push(this.fb.group({
            id: [id],
            fileName: [fileName, Validators.required],
            size: [size],
            autoExtensible: [autoExtensible],
            comment: [comment]
        }));
    }

    removeInstanceFile(instanceIndex: number, fileIndex: number) {
        this.getInstanceFileArray(instanceIndex).removeAt(fileIndex);
    }

    addDisk(name = '', maxSize = null, usedPercentage = null, availableStorage = null, id = null) {
        this.diskArray.push(this.fb.group({
            id: [id], name: [name, Validators.required], maxSize: [maxSize],
            usedPercentage: [usedPercentage, [Validators.min(0), Validators.max(100)]], availableStorage: [availableStorage]
        }));
    }
    removeDisk(i: number) { this.diskArray.removeAt(i); }

    addTableSpace(name = '', capacity = null, usedPercent = null, id = null, instanceName = '') {
        const defaultInstanceName = instanceName || this.instanceOptions[0]?.name || '';
        this.tableSpaceArray.push(this.fb.group({
            id: [id], name: [name, Validators.required],
            instanceName: [defaultInstanceName, Validators.required],
            capacity: [capacity], usedPercent: [usedPercent, [Validators.min(0), Validators.max(100)]]
        }));
    }
    removeTableSpace(i: number) { this.tableSpaceArray.removeAt(i); }

    addServerError(errorName = '', description = '', appearanceDateStr: string | null = null, id = null) {
        let dateVal = '';
        let timeVal = '00:00';
        if (appearanceDateStr) {
            const d = new Date(appearanceDateStr);
            if (!Number.isNaN(d.getTime())) {
                dateVal = d.toISOString().slice(0, 10);
                timeVal = d.toTimeString().slice(0, 5);
            }
        } else {
            const now = new Date();
            dateVal = now.toISOString().slice(0, 10);
            timeVal = now.toTimeString().slice(0, 5);
        }

        this.serverErrorArray.push(this.fb.group({
            id: [id],
            errorName: [errorName, Validators.required],
            description: [description],
            appearanceDateOnly: [dateVal, Validators.required],
            appearanceTimeOnly: [timeVal, Validators.required]
        }, { validators: [this.errorDateTimeValidator.bind(this)] }));
    }

    errorDateTimeValidator(group: AbstractControl): ValidationErrors | null {
        const date = group.get('appearanceDateOnly')?.value;
        const time = group.get('appearanceTimeOnly')?.value;
        if (!date || !time) return null;

        const combined = new Date(`${date}T${time}`);
        if (combined.getTime() > Date.now()) {
            return { futureDateTime: true };
        }
        return null;
    }
    removeServerError(i: number) { this.serverErrorArray.removeAt(i); }

    addBackupType(instanceIndex: number, typeBackup = 'FULL', storagePath = '', selectedDays: string | string[] = '', scheduleStartTime = '', id = null, source: any = {}) {
        const knownType = this.backupTypeSuggestions.some(option => option.value === typeBackup);
        let daysArr: string[] = [];
        if (selectedDays) {
            daysArr = Array.isArray(selectedDays) ? selectedDays : selectedDays.split(',');
        }
        this.getInstanceBackupTypesArray(instanceIndex).push(this.fb.group({
            id: [id], typeBackup: [knownType ? typeBackup : 'CUSTOM', Validators.required],
            customType: [knownType ? '' : typeBackup],
            storagePath: [storagePath],
            selectedDays: [daysArr],
            scheduleStartTime: [scheduleStartTime],
            scheduleType: [source.scheduleType || 'RECURRING'],
            enabled: [source.enabled !== false],
            oneTimeDate: [source.oneTimeDate || ''],
            oneTimeTime: [source.oneTimeTime || ''],
            dailyFrequencyMode: [source.dailyFrequencyMode === 'ONCE'
                ? 'DAILY'
                : (source.dailyFrequencyMode || (source.scheduleType === 'ONE_TIME' ? 'ONE_TIME' : 'DAILY'))],
            intervalHours: [source.intervalHours || source.recurrenceInterval || 1, [Validators.min(1)]],
            dailyStartTime: [source.dailyStartTime || scheduleStartTime],
            dailyEndTime: [source.dailyEndTime || '']
        }));
    }
    removeBackupType(instanceIndex: number, typeIndex: number) {
        const types = this.getInstanceBackupTypesArray(instanceIndex);
        const type = types.at(typeIndex);
        const typeName = type.get('customType')?.value || type.get('typeBackup')?.value || 'ce type';
        const existingId = type.get('id')?.value;
        if (existingId && !confirm(`Supprimer définitivement « ${typeName} » de la base de données ?`)) {
            return;
        }
        types.removeAt(typeIndex);
        this.form.markAsDirty();
    }

    addAvailabilityGroup(groupName = '', groupStatus = 'PRIMARY', id = null) {
        this.availabilityGroupArray.push(this.fb.group({
            id: [id],
            groupName: [groupName, Validators.required],
            groupStatus: [groupStatus, Validators.required]
        }));
    }
    removeAvailabilityGroup(i: number) { this.availabilityGroupArray.removeAt(i); }

    onSubmit() {
        if (this.form.invalid) {
            this.showValidationErrors();
            return;
        }

        const validationMessage = this.validateBeforeSave();
        if (validationMessage) {
            this.snackBar.open(validationMessage, 'Close', { duration: 4000 });
            return;
        }

        const message = this.isEdit
            ? 'Voulez-vous vraiment mettre à jour ce serveur ?'
            : (this.isCloneMode ? 'Voulez-vous vraiment créer une copie de ce serveur ?' : 'Voulez-vous vraiment créer ce serveur ?');

        if (!confirm(message)) return;

        this.saving = true;
        const payload = { ...this.form.value };
        if (!Array.isArray(payload.platformIds)) {
            payload.platformIds = payload.platformIds ? [payload.platformIds] : [];
        }
        payload.platformId = payload.platformIds.length > 0 ? payload.platformIds[0] : null;

        const rawCpu = payload.cpu;
        payload.cpu = (rawCpu === null || rawCpu === undefined || rawCpu === '') ? 0 : Number(rawCpu);
        if (Number.isNaN(payload.cpu)) payload.cpu = 0;

        console.log('Submit server payload CPU:', {
            serverId: this.serverId,
            hostname: payload.hostname,
            formCpu: this.form.get('cpu')?.value,
            payloadCpu: payload.cpu
        });

        const formatDateTime = (dateValue: any) => {
            if (!dateValue) return null;
            const d = new Date(dateValue);
            const offset = d.getTimezoneOffset();
            const adjustedDate = new Date(d.getTime() - (offset * 60 * 1000));
            // Output format for Backend: yyyy-MM-dd'T'HH:mm
            return adjustedDate.toISOString().slice(0, 16);
        };

        payload.instances = (payload.instances || []).map((instance: any) => ({
            ...instance,
            backupTypes: (instance.backupTypes || []).map((bt: any) => ({
                        ...bt,
                        typeBackup: bt.typeBackup === 'CUSTOM' ? bt.customType : bt.typeBackup,
                        selectedDays: Array.isArray(bt.selectedDays) ? bt.selectedDays.join(',') : bt.selectedDays
                    }))
        }));
        const hasInstanceBackupTypes = (payload.instances || []).some((instance: any) => instance.backupTypes?.length);
        if (payload.backupPolicy && (!payload.backupPolicy.policyName || !payload.backupPolicy.backupAddress) && !hasInstanceBackupTypes) {
            payload.backupPolicy = null;
        } else if (payload.backupPolicy) {
            payload.backupPolicy = {
                ...payload.backupPolicy,
                backupTypes: undefined
            };
        }

        if (payload.serverErrors) {
             payload.serverErrors = payload.serverErrors.map((se: any) => {
                 const combined = `${se.appearanceDateOnly}T${se.appearanceTimeOnly}`;
                 return {
                     id: se.id,
                     errorName: se.errorName,
                     description: se.description,
                     appearanceDate: combined
                 };
             });
        }

        if (!payload.clusterId) {
             payload.clusterRole = null;
        }

        if (!payload.availabilityGroupEnabled) {
             payload.availabilityGroups = [];
        }

        if (!this.isEdit) {
            this.preparePayloadForCreate(payload);
        }

        const req = this.isEdit && this.serverId
            ? this.serverService.updateServer(this.serverId, payload)
            : this.serverService.createServer(payload);

        req.subscribe({
            next: (res) => {
                this.snackBar.open(
                    this.isEdit ? 'Mise à jour réussie' : (this.isCloneMode ? 'Copie créée avec succès' : 'Création réussie'),
                    'Fermer',
                    { duration: 3000 }
                );
                this.navigateToSource(res);
            },
            error: (err) => {
                const msg = err?.error?.message || 'Erreur du serveur HTTP.';
                this.handleBackendError(msg);
                this.snackBar.open(msg, 'Fermer', { duration: 5000 });
                this.saving = false;
            }
        });
    }

    private resolveNavigationContext(): void {
        const sourceRaw = (this.route.snapshot.queryParamMap.get('source') || '').trim().toLowerCase();
        this.source = sourceRaw === 'platform' ? 'platform' : 'servers';

        const platformIdRaw = this.route.snapshot.queryParamMap.get('platformId');
        const parsedId = platformIdRaw ? Number(platformIdRaw) : NaN;

        // Use provided platformId or fallback to the server's platform
        this.sourcePlatformId = !Number.isNaN(parsedId) ? parsedId : null;

        this.sourceSgbd = (this.route.snapshot.queryParamMap.get('sgbd') || '').trim();
        this.sourceStatus = (this.route.snapshot.queryParamMap.get('status') || '').trim().toUpperCase();
    }

    private navigateToSource(server?: any): void {
        // If we have a server and no sourcePlatformId, try to use server's platform
        let targetPlatformId = this.sourcePlatformId;
        if (!targetPlatformId && server) {
            targetPlatformId = server.platformId || server.platform?.id;
        }

        if (this.source === 'platform' && targetPlatformId) {
            const queryParams: Record<string, string> = {};
            if (this.sourceSgbd) queryParams['sgbd'] = this.sourceSgbd;
            if (this.sourceStatus) queryParams['status'] = this.sourceStatus;
            this.router.navigate(['/platforms', targetPlatformId], { queryParams });
            return;
        }

        this.router.navigate(['/servers']);
    }

    handleBackendError(message: string) {
        const msg = (message || '').toLowerCase();
        if (msg.includes('hostname')) { this.form.get('hostname')?.setErrors({ backendUnique: true }); this.form.get('hostname')?.markAsTouched(); }
        if (msg.includes('ip address') || msg.includes('ipaddress') || msg.includes('adresse ip')) { this.form.get('ipAddress')?.setErrors({ backendUnique: true }); this.form.get('ipAddress')?.markAllAsTouched(); }
        if ((msg.includes('policy') || msg.includes('politique')) && msg.includes('existe')) {
            this.form.get('backupPolicy')?.get('policyName')?.setErrors({ backendUnique: true });
            this.form.get('backupPolicy')?.get('policyName')?.markAsTouched();
        }
    }

    validateBeforeSave(): string | null {
        if (this.form.get('clusterId')?.value && !this.form.get('clusterRole')?.value) {
            return 'Rôle requis (PRIMARY/SECONDARY) si associé à un cluster.';
        }
        const clusterId = this.form.get('clusterId')?.value;
        const platformIds = this.form.get('platformIds')?.value as number[] | null;
        if (clusterId && Array.isArray(platformIds) && platformIds.length > 1) {
            return 'Impossible d\'assigner plusieurs plateformes: ce serveur est sous cluster/réplication.';
        }
        return null;
    }

    showValidationErrors() {
        this.snackBar.open('Formulaire invalide.', 'Fermer', { duration: 5000 });
    }

    goBack() { this.navigateToSource(); }

    createST() {
        if (!this.newSTName.trim()) return;
        const payload = { name: this.newSTName.trim(), description: this.newSTDesc };
        this.adminService.createServerType(payload).subscribe({
            next: (res) => {
                this.snackBar.open('Type de serveur créé !', 'Fermer', { duration: 3000 });
                this.showSTForm = false;
                this.newSTName = '';
                this.newSTDesc = '';
                this.loadDropdowns(); // Refresh the list
                this.form.patchValue({ serverTypeId: res.id }); // Select the new type
            },
            error: (err) => {
                this.snackBar.open(err?.error?.message || 'Erreur lors de la création du type.', 'Fermer', { duration: 5000 });
            }
        });
    }

    createOS() {
        if (!this.newOSName.trim()) return;
        const payload = { name: this.newOSName.trim(), version: this.newOSVersion.trim() };
        this.adminService.createOperatingSystem(payload).subscribe({
            next: (res) => {
                this.snackBar.open('OS créé !', 'Fermer', { duration: 3000 });
                this.showOSForm = false;
                this.newOSName = '';
                this.newOSVersion = '';
                this.loadDropdowns(); // Refresh the list
                this.form.patchValue({ operatingSystemId: res.id }); // Select the new OS
            },
            error: (err) => {
                this.snackBar.open(err?.error?.message || 'Erreur lors de la création de l\'OS.', 'Fermer', { duration: 5000 });
            }
        });
    }

    createEnvironment() {
        if (!this.newEnvironmentName.trim()) return;
        const payload = { name: this.newEnvironmentName.trim(), description: this.newEnvironmentDesc.trim() };
        this.adminService.createEnvironment(payload).subscribe({
            next: (res) => {
                this.snackBar.open('Environnement cree !', 'Fermer', { duration: 3000 });
                this.showEnvironmentForm = false;
                this.newEnvironmentName = '';
                this.newEnvironmentDesc = '';
                this.adminService.getEnvironments().subscribe({ next: d => {
                    this.environments = d;
                    this.form.patchValue({ environmentId: res.id });
                }});
            },
            error: (err) => {
                this.snackBar.open(err?.error?.message || 'Erreur lors de la creation de l\'environnement.', 'Fermer', { duration: 5000 });
            }
        });
    }

    createSgbd() {
        if (!this.newSgbdName.trim()) return;
        const payload = {
            name: this.newSgbdName.trim()
        };
        this.adminService.createSgbd(payload).subscribe({
            next: (res) => {
                this.snackBar.open('SGBD cree !', 'Fermer', { duration: 3000 });
                this.showSgbdForm = false;
                this.newSgbdName = '';
                this.adminService.getSgbds().subscribe({ next: d => {
                    this.sgbds = d;
                    this.form.patchValue({ sgbdId: res.id });
                    this.syncSgbdVersionFromSelection(res.id);
                    this.loadSgbdReleases(res.id);
                }});
            },
            error: (err) => {
                this.snackBar.open(err?.error?.message || 'Erreur lors de la creation du SGBD.', 'Fermer', { duration: 5000 });
            }
        });
    }

    createSgbdRelease() {
        const sgbdId = this.form.get('sgbdId')?.value as number | null;
        if (!sgbdId || !this.newSgbdReleaseName.trim()) return;
        const payload = {
            name: this.newSgbdReleaseName.trim()
        };
        this.adminService.createSgbdRelease(sgbdId, payload).subscribe({
            next: (res) => {
                this.snackBar.open('Release SGBD cree !', 'Fermer', { duration: 3000 });
                this.showSgbdReleaseForm = false;
                this.newSgbdReleaseName = '';
                this.adminService.getSgbdReleases(sgbdId).subscribe({ next: d => {
                    this.sgbdReleases = d;
                    this.form.patchValue({ sgbdReleaseId: res.id });
                    this.syncSgbdReleaseSelection(res.id);
                }});
            },
            error: (err) => {
                this.snackBar.open(err?.error?.message || 'Erreur lors de la creation du release SGBD.', 'Fermer', { duration: 5000 });
            }
        });
    }

    createCluster() {
        const platId = this.getPrimaryPlatformId(this.form.get('platformIds')?.value);
        if (!platId) {
            this.snackBar.open('Sélectionnez d\'abord une plateforme.', 'Fermer', { duration: 3000 });
            return;
        }
        if (!this.newClusterName.trim()) return;
        const payload = { name: this.newClusterName.trim(), description: this.newClusterDesc, platformId: platId };
        this.adminService.createCluster(payload).subscribe({
            next: (res) => {
                this.snackBar.open('Cluster créé !', 'Fermer', { duration: 3000 });
                this.showClusterForm = false;
                this.newClusterName = '';
                this.newClusterDesc = '';
                // Refresh clusters for this platform
                this.adminService.getClustersByPlatform(platId).subscribe({ next: d => {
                    this.clusters = d;
                    this.form.patchValue({ clusterId: res.id });
                }});
            },
            error: (err) => {
                this.snackBar.open(err?.error?.message || 'Erreur lors de la création du cluster.', 'Fermer', { duration: 5000 });
            }
        });
    }

    createPlatform() {
        if (!this.newPlatformName.trim()) return;

        const payload = {
            name: this.newPlatformName.trim(),
            description: this.newPlatformDesc?.trim() || ''
        };

        this.adminService.createPlatform(payload).subscribe({
            next: (res) => {
                this.snackBar.open('Plateforme créée !', 'Fermer', { duration: 3000 });
                this.showPlatformForm = false;
                this.newPlatformName = '';
                this.newPlatformDesc = '';

                this.adminService.getPlatforms().subscribe({
                    next: (platforms) => {
                        this.platforms = platforms;
                        const current = this.form.get('platformIds')?.value;
                        const currentIds = Array.isArray(current) ? current : [];
                        if (!currentIds.includes(res.id)) {
                            this.form.get('platformIds')?.setValue([...currentIds, res.id]);
                        }
                    }
                });
            },
            error: (err) => {
                this.snackBar.open(err?.error?.message || 'Erreur lors de la création de la plateforme.', 'Fermer', { duration: 5000 });
            }
        });
    }

    setErrorDateNow(index: number) {
        const group = this.serverErrorArray.at(index);
        const now = new Date();
        group?.patchValue({
            appearanceDateOnly: now.toISOString().slice(0, 10),
            appearanceTimeOnly: now.toTimeString().slice(0, 5)
        });
        group?.markAsDirty();
    }

    private normalizeForUnique(value: unknown): string {
        return (value ?? '').toString().trim().toLowerCase();
    }

    private resolveEnvironmentIdFromName(name: string | null | undefined): number | null {
        const normalized = (name || '').toString().trim().toLowerCase();
        if (!normalized) return null;
        const env = this.environments.find(e => (e?.name || '').toString().trim().toLowerCase() === normalized);
        return env?.id ?? null;
    }

    private toDateTimeLocalValue(value: unknown): string {
        if (!value) return '';
        const d = value instanceof Date ? value : new Date(value as string);
        if (Number.isNaN(d.getTime())) return '';
        const offsetMs = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
    }

    isPlatformSelected(platformId: number): boolean {
        return this.selectedPlatformIds.includes(platformId);
    }

    removePlatformSelection(platformId: number, event?: Event): void {
        event?.stopPropagation();
        const next = this.selectedPlatformIds.filter(id => id !== platformId);
        this.form.get('platformIds')?.setValue(next);
    }

    selectAllFilteredPlatforms(event?: Event): void {
        event?.stopPropagation();
        const merged = new Set<number>(this.selectedPlatformIds);
        this.filteredPlatformOptions.forEach(p => {
            if (p?.id != null) merged.add(p.id);
        });
        this.form.get('platformIds')?.setValue(Array.from(merged));
    }

    clearPlatformSelection(event?: Event): void {
        event?.stopPropagation();
        this.form.get('platformIds')?.setValue([]);
    }

    clearPlatformSearch(event?: Event): void {
        event?.stopPropagation();
        this.platformSearchText = '';
    }

    private preparePayloadForCreate(payload: any): void {
        payload.id = null;
        payload.instances = (payload.instances || []).map((i: any) => ({
            ...i,
            id: null,
            files: (i.files || []).map((file: any) => ({ ...file, id: null })),
            backupTypes: (i.backupTypes || []).map((bt: any) => ({ ...bt, id: null }))
        }));
        payload.disks = (payload.disks || []).map((d: any) => ({ ...d, id: null }));
        payload.tableSpaces = (payload.tableSpaces || []).map((ts: any) => ({ ...ts, id: null }));
        payload.serverErrors = (payload.serverErrors || []).map((e: any) => ({ ...e, id: null }));
        payload.availabilityGroups = (payload.availabilityGroups || []).map((ag: any) => ({ ...ag, id: null }));
    }

    private getPrimaryPlatformId(platformIds: number[] | null | undefined): number | null {
        if (!Array.isArray(platformIds) || platformIds.length === 0) {
            return null;
        }
        return platformIds[0] ?? null;
    }

    private syncSgbdVersionFromSelection(sgbdId: number | null | undefined): void {
        if (!sgbdId) {
            this.form.get('sgbdVersion')?.setValue('');
            return;
        }
        const selected = this.sgbds.find(s => s.id === sgbdId);
        const version = selected && typeof selected.version === 'string' ? selected.version : '';
        this.form.get('sgbdVersion')?.setValue(version);
    }

    private syncSgbdReleaseSelection(releaseId: number | null | undefined): void {
        if (!releaseId) {
            const sgbdId = this.form.get('sgbdId')?.value as number | null;
            this.syncSgbdVersionFromSelection(sgbdId || null);
            return;
        }
        const selected = this.sgbdReleases.find(r => r.id === releaseId);
        if (selected && selected.sgbdId && this.form.get('sgbdId')?.value !== selected.sgbdId) {
            this.form.patchValue({ sgbdId: selected.sgbdId });
        }
        if (selected && typeof selected.name === 'string') {
            this.form.get('sgbdVersion')?.setValue(selected.name);
        }
    }

    private loadSgbdReleases(sgbdId: number | null): void {
        if (!sgbdId) {
            this.sgbdReleases = [];
            return;
        }
        this.adminService.getSgbdReleases(sgbdId).subscribe({
            next: d => this.sgbdReleases = d,
            error: () => { this.sgbdReleases = []; }
        });
    }

    private refreshInstanceOptions(): void {
        if (!this.form) {
            this.instanceOptions = [];
            return;
        }

        const unique = new Set<string>();
        this.instanceOptions = this.instanceArray.controls
            .map(c => ({
                id: c.get('id')?.value ?? null,
                name: (c.get('name')?.value || '').trim()
            }))
            .filter(i => {
                if (!i.name) return false;
                const key = i.name.toLowerCase();
                if (unique.has(key)) return false;
                unique.add(key);
                return true;
            });
    }

    private clearInstanceNameSubscriptions(): void {
        this.instanceNameSubscriptions.forEach(sub => sub.unsubscribe());
        this.instanceNameSubscriptions = [];
    }
}
