import { Component, signal, inject, output, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../services/gemini.service';

interface JobPosting {
  title: string;
  company: string;
  location: string;
  url: string;
  summary: string;
}

@Component({
  selector: 'app-job-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 animate-fade-in relative">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Find Your Next Role</h2>
      <p class="text-sm text-gray-500 mb-8">AI-powered job search designed to find the top 0.1% most relevant roles for you.</p>

      <form (submit)="onSearch($event)" class="space-y-6">
        <!-- Main Search Query -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">What are you looking for?</label>
          <input 
            type="text" 
            [(ngModel)]="searchQuery" 
            (ngModelChange)="emitState()"
            name="query" 
            placeholder="e.g. Senior Frontend Engineer in New York or Remote..." 
            class="w-full text-gray-900 rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg py-3 px-4"
          >
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Green Flags -->
          <div class="bg-green-50/50 p-4 rounded-xl border border-green-100">
            <label class="block text-sm font-semibold text-green-800 mb-2 whitespace-nowrap overflow-hidden text-ellipsis flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              Green Flags (Must Have)
            </label>
            <textarea 
              [(ngModel)]="greenFlags" 
              (ngModelChange)="emitState()"
              name="greenFlags" 
              rows="2"
              placeholder="e.g. Remote, 4 Day Work Week, Vue.js..." 
              class="w-full text-sm rounded-lg border-green-200 focus:border-green-500 focus:ring-green-500 bg-white"
            ></textarea>
            <p class="text-[10px] text-green-600 mt-1 mt-1">Comma separated.</p>
          </div>

          <!-- Red Flags -->
          <div class="bg-red-50/50 p-4 rounded-xl border border-red-100">
            <label class="block text-sm font-semibold text-red-800 mb-2 whitespace-nowrap overflow-hidden text-ellipsis flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
              </svg>
              Red Flags (Must Avoid)
            </label>
            <textarea 
              [(ngModel)]="redFlags" 
              (ngModelChange)="emitState()"
              name="redFlags" 
              rows="2"
              placeholder="e.g. Contract, Angularjs, Web3..." 
              class="w-full text-sm rounded-lg border-red-200 focus:border-red-500 focus:ring-red-500 bg-white"
            ></textarea>
            <p class="text-[10px] text-red-600 mt-1 mt-1">Comma separated.</p>
          </div>
        </div>

        <button 
          type="submit" 
          [disabled]="isSearching() || !searchQuery.trim()"
          class="w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center">
          @if (isSearching()) {
            <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ loadingMessage() }}
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
            </svg>
            Search Open Roles
          }
        </button>
        
        @if (error()) {
            <div class="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                {{ error() }}
            </div>
        }
      </form>

      <!-- Results Section -->
      @if (jobs().length > 0 && !isSearching()) {
        <div class="mt-12">
          <h3 class="text-xl font-bold text-gray-900 border-b border-gray-100 pb-4 mb-6">Top Matches</h3>
          <div class="space-y-6">
            @for (job of jobs(); track job.url + $index) {
              <div class="p-6 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                  <div>
                    <h4 class="text-lg font-bold text-gray-900">{{ job.title }}</h4>
                    <p class="text-sm font-medium text-blue-600 mt-1">{{ job.company }} <span class="text-gray-400 mx-1">&bull;</span> <span class="text-gray-600">{{ job.location }}</span></p>
                  </div>
                  <div class="flex gap-2">
                    <a [href]="job.url" target="_blank" class="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-100 transition-colors flex items-center truncate max-w-[200px]">
                       <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {{ job.url | slice:0:30 }}...
                    </a>
                  </div>
                </div>
                <p class="text-gray-700 text-sm leading-relaxed mb-6">{{ job.summary }}</p>
                <div class="pt-4 border-t border-gray-100 flex flex-wrap gap-3">
                  <button (click)="copyUrl(job.url)" class="text-xs font-semibold flex items-center transition-colors" [class.text-green-600]="copiedUrl() === job.url" [class.text-gray-500]="copiedUrl() !== job.url" [class.hover:text-gray-900]="copiedUrl() !== job.url">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {{ copiedUrl() === job.url ? 'Copied!' : 'Copy Link' }}
                  </button>
                  <button (click)="sendToResume(job)" class="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-3 py-1.5 rounded-md transition-colors ml-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Tailor Resume for this Job
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class JobSearchComponent implements OnDestroy {
  @Input() set initialQuery(val: string) { this.searchQuery = val || ''; }
  @Input() set initialGreenFlags(val: string) { this.greenFlags = val || ''; }
  @Input() set initialRedFlags(val: string) { this.redFlags = val || ''; }
  @Input() set initialJobs(val: JobPosting[]) { this.jobs.set(val || []); }

  searchQuery = '';
  greenFlags = '';
  redFlags = '';
  
  isSearching = signal(false);
  jobs = signal<JobPosting[]>([]);
  error = signal<string | null>(null);
  loadingMessage = signal<string>('Searching...');
  copiedUrl = signal<string | null>(null);
  private copyTimeout: any = null;

  useJobDescription = output<string>();
  stateChange = output<{query: string, greenFlags: string, redFlags: string, jobs: JobPosting[]}>();

  private geminiService = inject(GeminiService);
  private loadingInterval: any;
  private messageIndex = 0;

  emitState() {
      this.stateChange.emit({
          query: this.searchQuery,
          greenFlags: this.greenFlags,
          redFlags: this.redFlags,
          jobs: this.jobs()
      });
  }

  ngOnDestroy() {
      if (this.loadingInterval) clearInterval(this.loadingInterval);
  }

  async onSearch(e: Event) {
      e.preventDefault();
      if (!this.searchQuery.trim()) return;

      this.isSearching.set(true);
      this.error.set(null);
      this.emitState(); // Save current inputs
      
      const greens = this.greenFlags.split(',').map(s => s.trim()).filter(s => s);
      const reds = this.redFlags.split(',').map(s => s.trim()).filter(s => s);

      const messages = [
          'Scanning top job boards...',
          'Filtering out red flags...',
          'Curating the top 0.1% matches...',
          'Verifying active links...',
          'Just a few more seconds...'
      ];
      this.messageIndex = 0;
      this.loadingMessage.set(messages[0]);
      
      this.loadingInterval = setInterval(() => {
          this.messageIndex = (this.messageIndex + 1) % messages.length;
          this.loadingMessage.set(messages[this.messageIndex]);
      }, 3500);

      try {
          const results = await this.geminiService.searchJobs(this.searchQuery, greens, reds);
          if (results.length === 0) {
              this.error.set("No relevant jobs found that matched your strict green/red flags or had active URLs. Try broadening your search or removing some flags.");
          }
          this.jobs.set(results);
          this.emitState(); // Save results
      } catch(err: any) {
          this.error.set(err.message || 'An error occurred during search. Please ensure your query is detailed enough or try again later.');
      } finally {
          this.isSearching.set(false);
          if (this.loadingInterval) clearInterval(this.loadingInterval);
      }
  }

  copyUrl(url: string) {
      const markCopied = () => {
          this.copiedUrl.set(url);
          if (this.copyTimeout) clearTimeout(this.copyTimeout);
          this.copyTimeout = setTimeout(() => this.copiedUrl.set(null), 2500);
      };

      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(url)
              .then(() => markCopied())
              .catch(() => {
                  this.fallbackCopy(url);
                  markCopied();
              });
      } else {
          this.fallbackCopy(url);
          markCopied();
      }
  }

  private fallbackCopy(text: string) {
      if (typeof document === 'undefined') return;
      try {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
      } catch {
          // Ignore
      }
  }

  sendToResume(job: JobPosting) {
      const simulatedJd = `Role: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\n\n${job.summary}\n\nLink: ${job.url}`;
      this.useJobDescription.emit(simulatedJd);
  }
}
