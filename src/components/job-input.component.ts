import { Component, output, signal, inject, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../services/gemini.service';

@Component({
  selector: 'app-job-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white shadow-sm rounded-xl p-6 sm:p-8 animate-fade-in border border-gray-200/80">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">1. Target Job</h2>
      <p class="text-gray-600 mb-6">Paste a link to the job description and click 'Fetch', or paste the text directly below.</p>

      <!-- URL Input -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
            <label for="job-url" class="block text-sm font-medium text-gray-700">Job Posting URL</label>
            <button (click)="pasteUrl()" class="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Paste
            </button>
        </div>
        <div class="flex gap-2">
          <input 
            id="job-url"
            type="url"
            [(ngModel)]="jobUrl"
            (keyup.enter)="fetchJobDescription()"
            [disabled]="isFetching()"
            class="flex-grow shadow-sm block w-full border-gray-300 rounded-lg p-3 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="e.g., https://www.linkedin.com/jobs/view/..."
          >
          <button 
            (click)="fetchJobDescription()" 
            [disabled]="!jobUrl().trim() || isFetching()" 
            class="inline-flex items-center justify-center px-5 py-3 border border-transparent shadow text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            @if (isFetching()) {
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            } @else {
              <span>Fetch</span>
            }
          </button>
        </div>

        <!-- Smart Fallback UI: If fetch fails due to security/JS, guide the user -->
        @if (fetchError()) {
          <div class="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
             <div class="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-orange-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                    <h3 class="text-sm font-bold text-orange-800">Assisted Manual Mode</h3>
                    <p class="text-sm text-orange-700 mt-1">
                        {{ fetchError() }}
                    </p>
                    <div class="mt-3 flex gap-3">
                        <a [href]="jobUrl()" target="_blank" class="inline-flex items-center px-3 py-2 border border-orange-300 shadow-sm text-sm leading-4 font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500">
                           Open Job Link 
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                           </svg>
                        </a>
                        <button (click)="clearError()" class="text-sm text-orange-600 hover:text-orange-800 underline">Dismiss</button>
                    </div>
                </div>
             </div>
          </div>
        }
      </div>

      <div class="text-center my-4">
        <span class="text-xs font-semibold text-gray-400 uppercase">OR</span>
      </div>

      <!-- Text Area Input -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
            <label for="job-desc" class="block text-sm font-medium text-gray-700">Paste Job Description</label>
            <button (click)="pasteText()" class="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Paste
            </button>
        </div>
        <textarea 
          id="job-desc"
          [(ngModel)]="text"
          class="w-full h-64 p-4 bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg shadow-inner focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none"
          placeholder="Paste job description text here..."
        ></textarea>
      </div>

      <div class="flex justify-end">
        <button 
          (click)="onNext()"
          [disabled]="!text().trim()"
          class="inline-flex items-center px-6 py-3 font-semibold rounded-lg text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow">
          Next: Your Resume
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  `
})
export class JobInputComponent {
  initialText = input<string>('');
  
  text = signal('');
  jobUrl = signal('');
  isFetching = signal(false);
  fetchError = signal<string | null>(null);

  submitJob = output<string>();

  private geminiService = inject(GeminiService);

  constructor() {
      // Setup effect to read from input signal
      effect(() => {
          const val = this.initialText();
          if (val) {
              this.text.set(val);
          }
      }, { allowSignalWrites: true });
  }

  async pasteUrl() {
      try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText) {
              this.jobUrl.set(clipboardText);
          }
      } catch (e) {
          console.error("Failed to read clipboard:", e);
      }
  }

  async pasteText() {
      try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText) {
              this.text.set(clipboardText);
          }
      } catch (e) {
          console.error("Failed to read clipboard:", e);
      }
  }

  onNext() {
    if (this.text().trim()) {
      this.submitJob.emit(this.text());
    }
  }

  clearError() {
      this.fetchError.set(null);
  }

  async fetchJobDescription() {
    if (!this.jobUrl().trim() || this.isFetching()) return;

    this.isFetching.set(true);
    this.fetchError.set(null);
    this.text.set(''); // Clear textarea while fetching

    try {
        // A simple, public CORS proxy. In a real app, you'd host your own.
        const proxyUrl = 'https://corsproxy.io/?';
        const targetUrl = this.jobUrl();
        
        const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
        
        if (!response.ok) {
            throw new Error(`Failed to fetch from URL. Server responded with status ${response.status}.`);
        }
        
        const html = await response.text();
        
        if (!html) {
            throw new Error('The URL returned empty content.');
        }

        this.text.set('AI is reading the page...');
        const extractedText = await this.geminiService.extractJobDescriptionFromHtml(html);
        
        // Handle the specific error signal from the AI
        if (extractedText === 'ERROR_JS_REQUIRED') {
            this.text.set('');
            throw new Error('This job posting is protected by JavaScript (e.g. Oracle, Workday, LinkedIn) and cannot be read automatically. Please click "Open Job Link" and copy the text manually.');
        } else if (!extractedText.trim()) {
            this.text.set('');
            throw new Error('AI could not identify a job description on the page. Please copy and paste manually.');
        }
        
        this.text.set(extractedText);
        
    } catch (e: any) {
        console.error('Job Description Fetch error:', e);
        this.text.set(''); // Clear the "Reading..." message
        this.fetchError.set(e.message || 'An unknown error occurred while fetching the job description.');
    } finally {
        this.isFetching.set(false);
    }
  }
}