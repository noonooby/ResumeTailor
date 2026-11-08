import { Component, signal, inject, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from './services/gemini.service';
import { HistoryService } from './services/history.service';
import { DocProcessorService } from './services/doc-processor.service';
import { AuthService, db } from './services/auth.service';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AppStep, OptimizationResult, CompanyConfig, HistoryItem } from './types';
import { JobInputComponent } from './components/job-input.component';
import { ResumeInputComponent } from './components/resume-input.component';
import { PreviewComponent } from './components/preview.component';
import { HistoryComponent } from './components/history.component';
import { JobSearchComponent } from './components/job-search.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, JobInputComponent, ResumeInputComponent, PreviewComponent, HistoryComponent, JobSearchComponent],
  template: `
<div id="app-wrapper" class="min-h-screen flex flex-col bg-gray-50/50 transition-colors duration-300">
  <!-- Minimalistic Login Screen -->
  @if (!auth.user()) {
      <div class="flex-grow flex items-center justify-center p-4">
          <div class="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl max-w-sm w-full rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 transition-colors">
              <div class="p-8 flex flex-col items-center text-center">
                  <div class="w-16 h-16 bg-blue-50 dark:bg-blue-900/40 rounded-full flex items-center justify-center mb-6">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                  </div>
                  <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-sans tracking-tight">ResumeCreator</h1>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">Welcome back. Please sign in to securely sync your tailored resumes and store your customized templates.</p>
                  
                  <button (click)="login()" class="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 py-3 px-4 rounded-xl shadow-sm transition-all font-medium text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      Continue with Google
                  </button>
              </div>
              <div class="bg-gray-50/50 dark:bg-gray-800/30 p-4 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                  <button (click)="toggleDarkMode()" class="text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-2 transition-colors">
                      @if (isDarkMode()) {
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> Light Mode
                      } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg> Dark Mode
                      }
                  </button>
              </div>
          </div>
      </div>
  } @else {

  <!-- Header -->
  <header class="bg-white/80 backdrop-blur-lg border-b border-gray-200/80 shadow-sm z-30 print:hidden sticky top-0">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-2 cursor-pointer" (click)="activeModule.set('resume'); reset()">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="font-bold text-xl text-gray-900 hidden sm:inline">Resume<span class="text-blue-500">Creator</span></span>
      </div>
      
      <!-- Primary Navigation (Modules) -->
      <nav class="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button 
            (click)="activeModule.set('resume')"
            [class.bg-white]="activeModule() === 'resume'"
            [class.shadow-sm]="activeModule() === 'resume'"
            [class.text-blue-600]="activeModule() === 'resume'"
            class="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-600 hover:text-gray-900 transition-all flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span class="hidden sm:inline">Resume</span>
          </button>
          <button 
            (click)="activeModule.set('jobs')"
            [class.bg-white]="activeModule() === 'jobs'"
            [class.shadow-sm]="activeModule() === 'jobs'"
            [class.text-blue-600]="activeModule() === 'jobs'"
            class="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-600 hover:text-gray-900 transition-all flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <span class="hidden sm:inline">Job Search</span>
          </button>
      </nav>

      <div class="flex items-center gap-3">
        <!-- Sub-nav for Resume Mode ONLY -->
        @if (activeModule() === 'resume') {
            <button (click)="toggleHistory()" class="text-sm font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors hidden md:flex">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ step() === 'history' ? 'Close History' : 'History' }}
            </button>
            <div class="h-6 w-px bg-gray-200 hidden md:block"></div>
        }
        
        <!-- Dark Mode Toggle -->
        <button (click)="toggleDarkMode()" class="text-gray-500 hover:text-gray-900 transition-colors bg-gray-100 p-1.5 rounded-full" title="Toggle Dark Mode">
          @if (isDarkMode()) {
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          } @else {
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          }
        </button>

        <div class="h-6 w-px bg-gray-200"></div>

        <div class="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-3 py-1 shadow-sm hover:bg-gray-100 transition-colors">
            @if (auth.user()?.photoURL) {
                <img [src]="auth.user()?.photoURL" alt="Profile" class="h-7 w-7 rounded-full object-cover">
            } @else {
                <div class="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {{ auth.user()?.email?.charAt(0)?.toUpperCase() || 'U' }}
                </div>
            }
            <span class="text-xs text-gray-700 hidden sm:block truncate max-w-[120px] font-medium">{{ auth.user()?.email }}</span>
            <button (click)="logout()" class="text-xs text-red-500 hover:text-red-700 font-semibold ml-1" title="Sign Out">Logout</button>
        </div>
      </div>
    </div>
    
    <!-- Sub-Nav for Resume Builder Progress -->
    @if (activeModule() === 'resume') {
        <div class="mx-auto px-4 max-w-7xl flex items-center justify-center pb-2 bg-white/80 backdrop-blur-lg">
          <nav class="flex items-center gap-6 text-sm">
            <button (click)="scrollToSection('input-job')" [class.text-blue-600]="step() === 'input-job'" [class.font-bold]="step() === 'input-job'" class="text-gray-500 hover:text-gray-900 transition-colors">1. Job</button>
            <span class="text-gray-300">/</span>
            <button (click)="scrollToSection('input-resume')" [class.text-blue-600]="step() === 'input-resume'" [class.font-bold]="step() === 'input-resume'" class="text-gray-500 hover:text-gray-900 transition-colors">2. Resume Source</button>
            <span class="text-gray-300">/</span>
            <button (click)="scrollToSection('review')" [class.text-blue-600]="step() === 'review'" [class.font-bold]="step() === 'review'" class="text-gray-500 hover:text-gray-900 transition-colors">3. Review & Export</button>
          </nav>
        </div>
    }
  </header>

  <!-- Main Content -->
  <main class="flex-grow">
    <div class="max-w-5xl mx-auto py-8 md:py-12 px-4 sm:px-6 lg:px-8 space-y-12">
      
      <div class="mb-4 print:hidden">
        <button (click)="isSettingsExpanded.set(!isSettingsExpanded())" class="flex items-center text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 transition-transform" [class.rotate-90]="isSettingsExpanded()" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          Settings & API Key
        </button>
        
        <div class="grid transition-all duration-300 ease-in-out" [class.grid-rows-[1fr]]="isSettingsExpanded()" [class.opacity-100]="isSettingsExpanded()" [class.grid-rows-[0fr]]="!isSettingsExpanded()" [class.opacity-0]="!isSettingsExpanded()">
          <div class="overflow-hidden">
            <div class="mt-3 p-5 bg-indigo-50 border border-indigo-100 rounded-xl shadow-none">
              <h3 class="text-sm font-bold text-indigo-900 mb-2">Gemini AI Settings</h3>
               
                 <div class="mt-4 flex flex-col gap-2">
                    <label class="text-[11px] text-gray-600 font-semibold mb-1">Gemini Model:</label>
                    <select
                        [ngModel]="selectedModel()"
                        (ngModelChange)="onModelChange($event)"
                        class="w-full text-sm rounded-md border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500 p-2 shadow-sm bg-white"
                    >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended - Fastest)</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro (Advanced Reasoning)</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                    <p class="text-[10px] text-gray-500 mt-1">Select the AI model for resume analysis and job searching.</p>
                 </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Global Error Block -->
      @if (error()) {
        <div class="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 shadow-sm animate-fade-in relative transition-all" role="alert">
          <p class="font-bold text-sm">Action Required</p>
          <p class="text-xs mt-1">{{ error() }}</p>
          <button (click)="error.set(null)" class="absolute top-4 right-4 text-red-500 hover:text-red-700">
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      }

      <!-- Create New Resume Banner -->
      @if (activeModule() === 'resume') {
          @if (step() !== 'input-job' || (jobDescription() || '').trim() !== '') {
              <div class="flex justify-start animate-fade-in mb-4">
                  <button (click)="reset()" class="inline-flex items-center px-4 py-2 border border-blue-200 shadow-sm text-sm font-bold rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Create New Resume
                  </button>
              </div>
          }

          <!-- Step 1: Job Input -->
          <section id="input-job" class="scroll-mt-24 transition-all duration-300">
            <app-job-input [initialText]="jobDescription()" (submitJob)="handleJobSubmit($event)"></app-job-input>
          </section>

          <!-- Step 2: Resume Input -->
          <section id="input-resume" class="scroll-mt-24 transition-all duration-300">
            <app-resume-input 
                [initialCompanyConfigs]="companyConfigs()"
                [initialExtractedSections]="extractedSections()"
                [initialCustomInstructions]="customInstructions()"
                [initialCoverLetterInstructions]="coverLetterInstructions()"
                (submitResume)="handleResumeSubmit($event)" 
                (instructionsChange)="handleInstructionsChange($event)"
                (resetApp)="reset()"
                [error]="error()">
            </app-resume-input>
          </section>

          <!-- Step 3: Processing Overlay -->
          @if (step() === 'processing' && !optimizationResult()) {
            <div class="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center">
              <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-6"></div>
              <h2 class="text-2xl font-semibold text-gray-900 mb-2">Tailoring Your Resume...</h2>
              <p class="text-gray-500 max-w-md">Our AI is analyzing the job description and rewriting your experience to create the perfect fit.</p>
            </div>
          }

          <!-- Step 4: Preview/Result -->
          <section id="review" class="scroll-mt-24 transition-all duration-300">
            @if (optimizationResult()) {
              <app-preview 
                [data]="optimizationResult()!"
                [jobDescription]="jobDescription()" 
                [isLoading]="isLoading()"
                [versions]="versions()"
                [currentVersionIndex]="currentVersionIndex()"
                (reoptimize)="handleReoptimize($event)"
                (regenerateSection)="handleRegenerateSection($event)"
                (versionChange)="handleVersionChange($event)"
                (versionDelete)="handleVersionDelete($event)"
                (coverLetterUpdate)="handleCoverLetterUpdate($event)"
                (tabChange)="activeTab.set($event)">
              </app-preview>
            } @else {
              <div class="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
                <h2 class="text-2xl font-bold text-gray-900 mb-2">3. Review & Export</h2>
                <div class="mt-8 flex flex-col items-center justify-center text-center py-12">
                   <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                       <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                       </svg>
                   </div>
                   <h3 class="text-lg font-medium text-gray-900 mb-2">Ready to optimize</h3>
                   <p class="text-gray-500 max-w-md">Complete Step 1 (Job Input) and Step 2 (Resume Input) to generate your tailored resume here.</p>
                </div>
              </div>
            }
          </section>

          <!-- History View (Modal-like) -->
          @if (step() === 'history') {
            <div class="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center p-4">
              <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div class="p-4 border-b flex justify-between items-center bg-gray-50">
                  <h2 class="text-xl font-bold text-gray-900">Optimization History</h2>
                  <button (click)="toggleHistory()" class="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div class="flex-grow overflow-y-auto p-6">
                  <app-history (selectItem)="loadFromHistory($event)"></app-history>
                </div>
              </div>
            </div>
          }
      } @else if (activeModule() === 'jobs') {
          <app-job-search 
              [initialQuery]="jobSearchQuery()"
              [initialGreenFlags]="jobSearchGreenFlags()"
              [initialRedFlags]="jobSearchRedFlags()"
              [initialJobs]="jobSearchResults()"
              (stateChange)="handleJobSearchState($event)"
              (useJobDescription)="handleUseSearchedJob($event)">
          </app-job-search>
      }

    </div>
  </main>

  <footer class="bg-white border-t border-gray-200 mt-auto py-6 print:hidden">
    <div class="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
      <p></p>
    </div>
  </footer>
  }
</div>
  `,
})
export class AppComponent {
  activeModule = signal<'resume' | 'jobs'>('resume');
  step = signal<AppStep>('input-job');
  jobDescription = signal<string>('');
  resumeText = signal<string>('');
  
  // Job Search Settings
  jobSearchQuery = signal<string>('');
  jobSearchGreenFlags = signal<string>('');
  jobSearchRedFlags = signal<string>('');
  jobSearchResults = signal<any[]>([]);

  // Settings
  companyConfigs = signal<CompanyConfig[]>([]);
  integrateSkills = signal<boolean>(false);
  customInstructions = signal<string | undefined>(undefined);
  coverLetterInstructions = signal<string | undefined>(undefined);
  extractedSections = signal<{
      summary?: string, 
      certifications?: string[], 
      education?: string[], 
      workExperienceText?: string
  }>({});

  // BYOK Setting
  isSettingsExpanded = signal<boolean>(false);
  selectedModel = signal<string>('gemini-2.5-flash');

  optimizationResult = signal<OptimizationResult | null>(null);
  versions = signal<OptimizationResult[]>([]);
  currentVersionIndex = signal<number>(-1);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  isDarkMode = signal<boolean>(false);

  private geminiService = inject(GeminiService);
  private historyService = inject(HistoryService);
  private docService = inject(DocProcessorService);
  public auth = inject(AuthService);

  private isCloudStateRestored = false;

  private pendingCloudSave: any = null;

  constructor() {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        // Load saved instructions
        const saved = localStorage.getItem('custom_ai_instructions');
        if (saved) {
            this.customInstructions.set(saved);
        }
        const savedCL = localStorage.getItem('custom_cl_instructions');
        if (savedCL) {
            this.coverLetterInstructions.set(savedCL);
        }

        // Dark Mode setup
        const savedTheme = localStorage.getItem('resume_tailor_theme');
        if (savedTheme === 'dark') {
            this.isDarkMode.set(true);
            if (typeof document !== 'undefined') {
                document.documentElement.classList.add('dark');
            }
        }

        // Load persisted state
        try {
          const savedState = localStorage.getItem('resume_tailor_state_v1');
          if (savedState) {
              const state = JSON.parse(savedState);
              
              if (state.jobDescription) this.jobDescription.set(state.jobDescription);
              if (state.resumeText) this.resumeText.set(state.resumeText);
              if (state.companyConfigs) this.companyConfigs.set(state.companyConfigs);
              if (state.integrateSkills !== undefined) this.integrateSkills.set(state.integrateSkills);
              if (state.customInstructions) this.customInstructions.set(state.customInstructions);
              if (state.coverLetterInstructions) this.coverLetterInstructions.set(state.coverLetterInstructions);
              if (state.optimizationResult) this.optimizationResult.set(state.optimizationResult);
              if (state.versions) this.versions.set(state.versions);
              if (state.currentVersionIndex !== undefined) this.currentVersionIndex.set(state.currentVersionIndex);
              if (state.extractedSections) this.extractedSections.set(state.extractedSections);
              if (state.jobSearchQuery) this.jobSearchQuery.set(state.jobSearchQuery);
              if (state.jobSearchGreenFlags) this.jobSearchGreenFlags.set(state.jobSearchGreenFlags);
              if (state.jobSearchRedFlags) this.jobSearchRedFlags.set(state.jobSearchRedFlags);
              if (state.jobSearchResults) this.jobSearchResults.set(state.jobSearchResults);
              
              // Restore step last to ensure data is ready
              if (state.step) {
                  if (state.step === 'processing') {
                      this.step.set('input-resume');
                  } else {
                      this.step.set(state.step);
                  }
              }
          }
        } catch (e) {
            console.error('Failed to load state', e);
        }
      }

      // Auto-save state to local AND cloud
      effect(() => {
          const state = {
              step: this.step(),
              jobDescription: this.jobDescription(),
              resumeText: this.resumeText(),
              companyConfigs: this.companyConfigs(),
              integrateSkills: this.integrateSkills(),
              customInstructions: this.customInstructions(),
              coverLetterInstructions: this.coverLetterInstructions(),
              selectedModel: this.selectedModel(),
              optimizationResult: this.optimizationResult(),
              versions: this.versions(),
              currentVersionIndex: this.currentVersionIndex(),
              extractedSections: this.extractedSections(),
              activeModule: this.activeModule(),
              jobSearchQuery: this.jobSearchQuery(),
              jobSearchGreenFlags: this.jobSearchGreenFlags(),
              jobSearchRedFlags: this.jobSearchRedFlags(),
              jobSearchResults: this.jobSearchResults()
          };
          
          if (typeof localStorage !== 'undefined') {
              localStorage.setItem('resume_tailor_state_v1', JSON.stringify(state));
          }
          
          // Also persist to cloud if user is logged in
          const user = this.auth.user();
          if (user && this.isCloudStateRestored) {
              // Remove undefined fields which Firestore strictly forbids
              const cleanedState = JSON.parse(JSON.stringify(state));
              
              if (this.pendingCloudSave) clearTimeout(this.pendingCloudSave);
              this.pendingCloudSave = setTimeout(() => {
                  setDoc(doc(db, 'users', user.uid, 'documents', 'appState'), cleanedState).catch(e => {
                      console.error('Failed to sync state to cloud', e);
                  });
              }, 4000);
          }
      });
      
      // Auto-sync from cloud on auth state change
      effect(() => {
          const user = this.auth.user();
          if (user) {
              // Wrap in async immediately invoked function
              (async () => {
                  try {
                      await this.syncStateFromCloud();
                      await this.docService.syncTemplateFromCloud();
                  } catch (e) {
                      console.error('Initial sync failed', e);
                  }
              })();
          } else {
              this.isCloudStateRestored = false; 
          }
      });
  }

  handleUseSearchedJob(jd: string) {
      this.jobDescription.set(jd);
      this.activeModule.set('resume');
      this.step.set('input-resume');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  handleJobSearchState(state: {query: string, greenFlags: string, redFlags: string, jobs: any[]}) {
      this.jobSearchQuery.set(state.query);
      this.jobSearchGreenFlags.set(state.greenFlags);
      this.jobSearchRedFlags.set(state.redFlags);
      this.jobSearchResults.set(state.jobs);
  }

  async syncStateFromCloud() {
      const user = this.auth.user();
      if (!user) return;
      try {
          const snap = await getDoc(doc(db, 'users', user.uid, 'documents', 'appState'));
          if (snap.exists()) {
              const state = snap.data();
              // Prevent reactive interference when bulk-updating from cloud
              import('@angular/core').then(({ untracked }) => {
                  untracked(() => {
                      if (state['jobDescription']) this.jobDescription.set(state['jobDescription']);
                      if (state['resumeText']) this.resumeText.set(state['resumeText']);
                      if (state['companyConfigs']) this.companyConfigs.set(state['companyConfigs']);
                      if (state['integrateSkills'] !== undefined) this.integrateSkills.set(state['integrateSkills']);
                      if (state['customInstructions']) this.customInstructions.set(state['customInstructions']);
                      if (state['coverLetterInstructions']) this.coverLetterInstructions.set(state['coverLetterInstructions']);
                      if (state['selectedModel']) {
                          this.selectedModel.set(state['selectedModel']);
                          this.geminiService.setSelectedModel(state['selectedModel']);
                      }
                      if (state['optimizationResult']) this.optimizationResult.set(state['optimizationResult']);
                      if (state['versions']) this.versions.set(state['versions']);
                      if (state['extractedSections']) this.extractedSections.set(state['extractedSections']);
                      if (state['jobSearchQuery']) this.jobSearchQuery.set(state['jobSearchQuery']);
                      if (state['jobSearchGreenFlags']) this.jobSearchGreenFlags.set(state['jobSearchGreenFlags']);
                      if (state['jobSearchRedFlags']) this.jobSearchRedFlags.set(state['jobSearchRedFlags']);
                      if (state['jobSearchResults']) this.jobSearchResults.set(state['jobSearchResults']);
                      
                      if (state['step']) {
                          if (state['step'] === 'processing') {
                              this.step.set('input-resume');
                          } else {
                              this.step.set(state['step']);
                          }
                      }
                  });
              });
          }
      } catch (e) {
          console.error("Failed to sync app state from cloud", e);
      } finally {
          this.isCloudStateRestored = true;
      }
  }

  scrollToSection(sectionId: string) {
    this.step.set(sectionId as AppStep);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async login() {
    try {
        await this.auth.loginWithGoogle();
        // Sync templates and settings upon login
        await this.docService.syncTemplateFromCloud();
        await this.syncStateFromCloud();
    } catch (e) {
        console.error('Login failed', e);
    }
  }

  async logout() {
    try {
        await this.auth.logout();
        await this.docService.clearLocalTemplate();
        this.reset();
    } catch (e) {
        console.error('Logout failed', e);
    }
  }

  onModelChange(model: string) {
      if (!model) return;
      this.selectedModel.set(model);
      this.geminiService.setSelectedModel(model);
      
      const user = this.auth.user();
      if (user) {
          setDoc(doc(db, 'users', user.uid, 'documents', 'appState'), { selectedModel: model }, { merge: true }).catch(e => {
              console.error('Failed to sync model selection', e);
          });
      }
  }

  handleJobSubmit(text: string) {
    if (!this.auth.user()) {
        this.error.set("Authentication required. Please log in to proceed.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    this.error.set(null);
    this.jobDescription.set(text);
    this.scrollToSection('input-resume');
  }

  handleInstructionsChange(data: {customInstructions: string, coverLetterInstructions: string}) {
      this.customInstructions.set(data.customInstructions);
      this.coverLetterInstructions.set(data.coverLetterInstructions);
      // The effect in constructor will automatically sync this to appState in cloud
  }

  handleResumeSubmit(data: {
      text: string, 
      configs: CompanyConfig[], 
      integrateSkills: boolean, 
      customInstructions: string,
      coverLetterInstructions?: string,
      extractedSections?: {
          summary?: string, 
          certifications?: string[], 
          education?: string[], 
          workExperienceText?: string
      }
  }) {
    if (!this.auth.user()) {
        this.error.set("Authentication required. Please log in to proceed.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    this.error.set(null);
    this.resumeText.set(data.text);
    this.companyConfigs.set(data.configs);
    this.integrateSkills.set(data.integrateSkills);
    this.customInstructions.set(data.customInstructions);
    if (data.coverLetterInstructions) {
        this.coverLetterInstructions.set(data.coverLetterInstructions);
    }
    if (data.extractedSections) {
        this.extractedSections.set(data.extractedSections);
    }
    
    this.startOptimization();
  }

  handleReoptimize(feedback: string) {
    this.startOptimization(feedback);
  }

  async handleRegenerateSection(event: {type: 'summary' | 'experience' | 'whole', company?: string}) {
      if (event.type === 'whole') {
          this.startOptimization(); 
          return;
      }
      
      this.isLoading.set(true);
      try {
          const currentResult = this.optimizationResult();
          if (!currentResult) return;
          
          if (event.type === 'summary') {
              const newSummary = await this.geminiService.regenerateSummary(this.jobDescription(), this.resumeText(), currentResult.summary, this.customInstructions());
              if (newSummary) {
                  const updated = { ...currentResult, summary: newSummary };
                  this.optimizationResult.set(updated);
                  
                  // Update versions array with this new state
                  const currentVersions = this.versions();
                  currentVersions.push(updated);
                  this.versions.set([...currentVersions]);
                  this.currentVersionIndex.set(currentVersions.length - 1);
              }
          } else if (event.type === 'experience' && event.company) {
              const currentExp = currentResult.experience.find((e: any) => e.company === event.company);
              if (currentExp) {
                  const newExp = await this.geminiService.regenerateCompanyExperience(
                      this.jobDescription(), 
                      this.resumeText(), 
                      currentExp, 
                      this.companyConfigs(), 
                      this.integrateSkills(), 
                      this.customInstructions()
                  );
                  if (newExp) {
                      const updatedExp = currentResult.experience.map((e: any) => e.company === event.company ? newExp : e);
                      const updated = { ...currentResult, experience: updatedExp };
                      this.optimizationResult.set(updated);
                      
                      // Update versions array with this new state
                      const currentVersions = this.versions();
                      currentVersions.push(updated);
                      this.versions.set([...currentVersions]);
                      this.currentVersionIndex.set(currentVersions.length - 1);
                  }
              }
          }
      } catch (err: any) {
          console.error(err);
          this.error.set(err.message || 'Failed to regenerate section.');
      } finally {
          this.isLoading.set(false);
      }
  }

  async startOptimization(feedback?: string) {
    const previousStep = this.step();
    console.log('Starting optimization. Previous step:', previousStep);
    
    // Move to review immediately to show "real-time" filling
    this.step.set('review');
    this.isLoading.set(true);
    this.error.set(null);

    // If it's a new optimization (not re-optimize), clear previous result to show skeleton
    if (!feedback) {
      this.optimizationResult.set(null);
    }

    try {
      console.log('Calling geminiService.optimizeResume...');
      const result = await this.geminiService.optimizeResume(
        this.jobDescription(),
        this.resumeText(),
        this.companyConfigs(),
        this.integrateSkills(),
        feedback,
        this.customInstructions(),
        this.coverLetterInstructions(),
        (partial) => {
          // Update the UI with partial results
          // We cast to any because it's a Partial<OptimizationResult>
          this.optimizationResult.set(partial as any);
        }
      );
      console.log('Optimization successful.');
      this.optimizationResult.set(result);
      
      // Add to versions
      const currentVersions = this.versions();
      currentVersions.push(result);
      this.versions.set([...currentVersions]);
      this.currentVersionIndex.set(currentVersions.length - 1);
      
      await this.historyService.save(result, this.jobDescription());
      
      setTimeout(() => this.scrollToSection('review'), 100);
    } catch (err: any) {
      console.error('Optimization failed:', err);
      this.error.set(err.message || 'Failed to optimize resume. Please try again.');
      this.step.set(previousStep); 
      console.log('Shifted back to step:', previousStep);
    } finally {
      this.isLoading.set(false);
    }
  }

  async reset() {
    this.jobDescription.set('');
    this.resumeText.set('');
    this.optimizationResult.set(null);
    this.versions.set([]);
    this.currentVersionIndex.set(-1);
    this.error.set(null);
    this.step.set('input-job');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleDarkMode() {
      this.isDarkMode.update(v => !v);
      if (this.isDarkMode()) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('resume_tailor_theme', 'dark');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('resume_tailor_theme', 'light');
      }
  }

  handleVersionChange(index: number) {
    this.currentVersionIndex.set(index);
    this.optimizationResult.set(this.versions()[index]);
  }

  handleVersionDelete(index: number) {
      const currentVersions = [...this.versions()];
      if (currentVersions.length > 1) {
          currentVersions.splice(index, 1);
          this.versions.set(currentVersions);
          
          let newIndex = this.currentVersionIndex();
          if (newIndex >= currentVersions.length) {
              newIndex = currentVersions.length - 1;
          } else if (index < newIndex) {
              newIndex--;
          } else if (index === newIndex && newIndex > 0) {
              newIndex--;
          }
          this.currentVersionIndex.set(newIndex);
          this.optimizationResult.set(currentVersions[newIndex]);
          
          // Optionally save this state update to cloud back?
          if (this.auth.user()) {
             const result = currentVersions[newIndex];
             // history is auto-saved via effect, but deleting might require a cloud sync push
          }
      }
  }

  handleCoverLetterUpdate(cl: string) {
      const current = this.optimizationResult();
      if (current) {
          const updated = { ...current, coverLetter: cl };
          this.optimizationResult.set(updated);
          
          const currentVersions = [...this.versions()];
          if (this.currentVersionIndex() >= 0) {
              currentVersions[this.currentVersionIndex()] = updated;
              this.versions.set(currentVersions);
          }
      }
  }

  toggleHistory() {
    if (this.step() === 'history') {
      if (this.optimizationResult()) {
        this.step.set('review');
      } else {
        this.step.set('input-job');
      }
    } else {
      this.step.set('history');
    }
  }

  loadFromHistory(item: HistoryItem) {
    this.jobDescription.set(item.jobDescription || '');
    // Reset inputs since we are loading a specific past result
    this.resumeText.set('');
    // Ensure we don't accidentally save this as a NEW result unless user touches something
    this.optimizationResult.set(item.result);
    // Don't override versions so they don't get mixed, or we could set it to a 1 item array?
    this.versions.set([item.result]);
    this.currentVersionIndex.set(0);

    this.step.set('review');
    // Ensure we are out of history view visually as well
    // toggleHistory flips it, but we already set it to 'review', so just scroll
    setTimeout(() => this.scrollToSection('review'), 100);
  }
}
