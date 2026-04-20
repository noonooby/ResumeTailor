
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { AppComponent } from './src/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideServiceWorker('ngsw-worker.js', {
        enabled: false, // Service Worker disabled to prevent origin mismatch errors in this environment
        registrationStrategy: 'registerWhenStable:30000'
    })
  ]
}).catch((err) => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.
