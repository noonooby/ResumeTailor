import { Component, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from './services/gemini.service';
import { HistoryService } from './services/history.service';
import { DocProcessorService } from './services/doc-processor.service';
import { AuthService } from './services/auth.service';
import { AppStep, OptimizationResult, CompanyConfig, HistoryItem } from './types';
import { JobInputComponent } from './components/job-input.component';
import { ResumeInputComponent } from './components/resume-input.component';
import { PreviewComponent } from './components/preview.component';
import { HistoryComponent } from './components/history.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, JobInputComponent, ResumeInputComponent, PreviewComponent, HistoryComponent],
  template: `
<div class="min-h-screen flex flex-col bg-gray-50/50">
  <!-- Header -->
  <header class="bg-white/80 backdrop-blur-lg border-b border-gray-200/80 shadow-sm z-30 print:hidden sticky top-0">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-2 cursor-pointer" (click)="reset()">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="font-bold text-xl text-gray-900">Resume<span class="text-blue-500">Tailor</span></span>
      </div>
      
      <!-- Navigation -->
      <nav class="hidden md:flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
        <button 
          (click)="scrollToSection('input-job')"
          [class.bg-white]="step() === 'input-job'"
          [class.shadow-sm]="step() === 'input-job'"
          [class.text-blue-600]="step() === 'input-job'"
          class="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-600 hover:text-gray-900 transition-all">
          1. Job
        </button>
        <button 
          (click)="scrollToSection('input-resume')"
          [class.bg-white]="step() === 'input-resume'"
          [class.shadow-sm]="step() === 'input-resume'"
          [class.text-blue-600]="step() === 'input-resume'"
          class="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-600 hover:text-gray-900 transition-all">
          2. Resume
        </button>
        <button 
          (click)="scrollToSection('review')"
          [disabled]="!optimizationResult()"
          [class.bg-white]="step() === 'review'"
          [class.shadow-sm]="step() === 'review'"
          [class.text-blue-600]="step() === 'review'"
          class="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-600 hover:text-gray-900 transition-all disabled:opacity-50">
          3. Review
        </button>
      </nav>

      <div class="flex items-center gap-4">
        @if (auth.user()) {
            <span class="text-xs text-gray-500 hidden sm:block truncate max-w-[120px]">{{ auth.user()?.email }}</span>
            <button (click)="logout()" class="text-sm text-gray-500 hover:text-gray-700 font-medium">Logout</button>
        } @else {
            <button (click)="login()" class="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium transition-colors">Sign In</button>
        }

        <button (click)="toggleHistory()" class="text-sm font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ step() === 'history' ? 'Close' : 'History' }}
        </button>

        <button (click)="reset()" class="text-sm text-blue-500 hover:text-blue-600 font-semibold">
          Start Over
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-grow">
    <div class="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-12">
      
      <!-- Step 1: Job Input -->
      <section id="input-job" class="scroll-mt-24 transition-all duration-500" [class.opacity-50]="step() !== 'input-job' && step() !== 'history'">
        <app-job-input [initialText]="jobDescription()" (submitJob)="handleJobSubmit($event)"></app-job-input>
      </section>

      <!-- Step 2: Resume Input -->
      <section id="input-resume" class="scroll-mt-24 transition-all duration-500" [class.opacity-50]="step() !== 'input-resume' && step() !== 'history'">
        <app-resume-input 
            (submitResume)="handleResumeSubmit($event)" 
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
      <app-preview 
        [data]="optimizationResult()!"
        [jobDescription]="jobDescription()" 
        [isLoading]="isLoading()"
        [versions]="versions()"
        [currentVersionIndex]="currentVersionIndex()"
        (reoptimize)="handleReoptimize($event)"
        (versionChange)="handleVersionChange($event)">
      </app-preview>

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

    </div>
  </main>

  <footer class="bg-white border-t border-gray-200 mt-auto py-6 print:hidden">
    <div class="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
      <p></p>
    </div>
  </footer>
</div>
  `,
})
export class AppComponent {
  step = signal<AppStep>('input-job');
  jobDescription = signal<string>('');
  resumeText = signal<string>('');
  
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

  optimizationResult = signal<OptimizationResult | null>(null);
  versions = signal<OptimizationResult[]>([]);
  currentVersionIndex = signal<number>(-1);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  private geminiService = inject(GeminiService);
  private historyService = inject(HistoryService);
  private docService = inject(DocProcessorService);
  public auth = inject(AuthService);

  constructor() {
      // Load saved instructions
      const saved = localStorage.getItem('custom_ai_instructions');
      if (saved) {
          this.customInstructions.set(saved);
      }
      const savedCL = localStorage.getItem('custom_cl_instructions');
      if (savedCL) {
          this.coverLetterInstructions.set(savedCL);
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

      // Auto-save state
      effect(() => {
          const state = {
              step: this.step(),
              jobDescription: this.jobDescription(),
              resumeText: this.resumeText(),
              companyConfigs: this.companyConfigs(),
              integrateSkills: this.integrateSkills(),
              customInstructions: this.customInstructions(),
              coverLetterInstructions: this.coverLetterInstructions(),
              optimizationResult: this.optimizationResult(),
              versions: this.versions(),
              currentVersionIndex: this.currentVersionIndex()
          };
          localStorage.setItem('resume_tailor_state_v1', JSON.stringify(state));
      });
      
      // Auto-sync from cloud on auth state change
      effect(() => {
          const user = this.auth.user();
          if (user) {
              this.docService.syncTemplateFromCloud();
          }
      });
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

  handleJobSubmit(text: string) {
    this.jobDescription.set(text);
    this.scrollToSection('input-resume');
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

  handleVersionChange(index: number) {
    this.currentVersionIndex.set(index);
    this.optimizationResult.set(this.versions()[index]);
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
