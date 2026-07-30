import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { App } from './app/app';
import { AppModule } from './app/app.module';

bootstrapApplication(App, {
  providers: [importProvidersFrom(AppModule)]
}).catch(err => console.error(err));
