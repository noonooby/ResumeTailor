import { Component, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" (click)="close.emit()"></div>

      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-gray-200">
          
          <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                <h3 class="text-base font-semibold leading-6 text-gray-900" id="modal-title">Configure Gemini API</h3>
                <div class="mt-2">
                  <p class="text-sm text-gray-500 mb-4">
                    To use ResumeTailor, you need a free Google Gemini API key. Your key is stored locally in your browser and never sent to our servers.
                  </p>
                  
                  <div class="mb-4">
                    <label for="api-key" class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <input 
                      type="password" 
                      id="api-key" 
                      [(ngModel)]="apiKey"
                      (keyup.enter)="save()"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-gray-50" 
                      placeholder="Paste your key here (starts with AIza...)"
                    >
                  </div>

                  <div class="bg-blue-50 p-3 rounded-md border border-blue-100">
                    <p class="text-xs text-blue-700 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" class="font-bold underline hover:text-blue-900">Get one here for free</a>.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button 
                type="button" 
                (click)="save()"
                [disabled]="!apiKey().trim()"
                class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed">
                Save & Continue
            </button>
            <button type="button" (click)="close.emit()" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsModalComponent implements OnInit {
  apiKey = signal('');
  close = output<void>();

  ngOnInit() {
      const stored = localStorage.getItem('gemini_api_key');
      if (stored) {
          this.apiKey.set(stored);
      }
  }

  save() {
      if (this.apiKey().trim()) {
          localStorage.setItem('gemini_api_key', this.apiKey().trim());
          this.close.emit();
          window.location.reload(); // Reload to ensure services pick up the new key fresh
      }
  }
}