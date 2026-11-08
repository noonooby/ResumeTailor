import { Component, output, signal, input, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocProcessorService } from '../services/doc-processor.service';
import { GeminiService, DEFAULT_INSTRUCTIONS, DEFAULT_COVER_LETTER_INSTRUCTIONS } from '../services/gemini.service';
import { AuthService } from '../services/auth.service';
import { CompanyConfig } from '../types';

const DEFAULT_RESUME_TEXT = `RITHUL RAPHEL
rithulraphel@gmail.com | (437) 971-9321 | linkedin.com/in/rithul/

SUMMARY

Senior Project Manager with 8+ years of experience delivering complex technology programs across regulated financial services and large-scale enterprise platforms. Proven track record leading end-to-end delivery for Wealth Management modernization, ERP transformations (SAP and Oracle), and high-volume digital platforms. Brings strong execution discipline across Agile and hybrid delivery models, with deep strength in stakeholder alignment, delivery governance, financial forecasting, risk management, and regulatory-sensitive initiatives.

CERTIFICATIONS

* Professional Scrum Product Owner™ II (PSPO-II) - 1078795
* Professional Scrum Product Owner™ I (PSPO-I) - 983518
* Professional Scrum Master™ II (PSM-II) - 1071176
* Professional Scrum Master™ I (PSM-I) - 951750
* Certified SAFe 6 Scrum Master (SSM) - 25015120-7901
* Certified Scrum Master® (CSM) - 1658122
* Project Management Professional (PMP®) - 3305820

WORK EXPERIENCE

Deloitte, Toronto | Project Manager | May 2023 - PRESENT

* Client Engagement & Delivery Leadership: Led delivery across multiple concurrent consulting engagements for enterprise clients, including regulated financial services and large-scale SAP and Oracle ERP transformation programs, owning scope, delivery commitments, and SOW alignment.
* Wealth Management Platform Modernization: Served as delivery lead for a Big 5 bank engagement focused on advisor platforms and portfolio workflows, overseeing platform modernization and supporting data migration of client, advisor, account, and portfolio information to ensure regulatory compliance, financial accuracy, and uninterrupted advisor operations.
* Data Migration & Regulatory Readiness: Partnered with business, compliance, architecture, QA, and data teams to define migration scope, validate data mappings and reconciliation outcomes, and manage migration readiness through dry runs, UAT, and production cutover in a regulated banking environment.
* Scrum Master Leadership: Served as Scrum Master for cross-functional engineering squads, driving sprint execution, delivery predictability, and disciplined Agile practices across complex client programs.
* Agile Execution: Established clear sprint goals, backlog readiness standards, and execution rhythms that improved delivery focus and reduced slippage across multi-dependency initiatives.
* Ceremony Facilitation: Facilitated all Agile ceremonies with emphasis on delivery accountability, dependency visibility, and actionable retrospectives aligned to client milestones.
* Budget & Forecasting Management: Managed project financials including resource forecasting, time approvals, invoice validation, and revenue tracking, ensuring alignment with contractual commitments and delivery progress.
* Risk & Impediment Management: Actively identified delivery, dependency, and regulatory risks, coordinating cross-team resolution to protect timelines and release integrity.
* Stakeholder Communication: Delivered structured status reporting and executive-level updates covering scope, schedule, financials, and delivery risks for client and internal leadership.
* Mentorship & Delivery Standards: Mentored team members and reinforced delivery best practices across planning, execution, and governance to strengthen overall engagement quality.

Reliance Jio, Mumbai | Project Manager | December 2016 - November 2021

* Large-Scale Digital Delivery: Led delivery of large-scale digital initiatives across high-traffic consumer platforms, supporting millions of users while managing complex dependencies across product, engineering, UX, analytics, and operations teams.
* Cross-Functional Program Execution: Coordinated parallel delivery streams across multiple squads and vendors, ensuring alignment on scope, sequencing, and release readiness for frequent production deployments.
* Agile Delivery Leadership: Drove disciplined Scrum execution, reinforcing estimation accuracy, sprint predictability, and backlog readiness to sustain high delivery velocity across fast-moving product environments.
* Impediment & Dependency Management: Identified and resolved systemic delivery blockers by working closely with architecture, QA, and infrastructure teams, stabilizing environments and improving release reliability.
* Backlog & Requirement Prioritization: Partnered with product leadership to translate customer insights and business priorities into actionable, prioritized backlogs, balancing feature delivery with platform stability and technical debt.
* Release Coordination: Managed end-to-end release coordination across multiple applications, validating deployment readiness, dependency clearance, and stakeholder alignment to enable seamless product launches at scale.

HDFC Bank, Mumbai | Business Analyst | December 2015 - December 2016

* Requirements Elicitation: Conducted in-depth analysis and gathered comprehensive business requirements for new financial product features and system enhancements, translating complex needs into actionable specifications.
* Stakeholder Communication: Facilitated effective communication between business units and technology teams, bridging technical and non-technical understanding to ensure unified project vision and objective alignment.
* Process Optimization: Mapped current-state business processes and identified key areas for efficiency gains, proposing and documenting optimized workflows that reduced manual overhead and accelerated operational cycles.
* Data Analysis: Performed detailed data analysis to support decision-making for project scope and feature prioritization, providing insights that guided product development in a highly regulated environment.
* Project Support: Provided critical analytical support to project managers and development teams, ensuring requirements traceability and contributing to the timely delivery of key project milestones.
* Documentation and Standards: Developed comprehensive functional specifications, use cases, and user stories, establishing clear documentation standards that enhanced project clarity and reduced rework.

EDUCATION

Northeastern University, Toronto
Masters Degree in Project Management, 2021-2023
* Relevant Coursework: Project Scope Management, Advanced Agile Fundamentals, Project Risk Management, Program and Portfolio Management, Project Scheduling and Cost Planning

VJTI Mumbai University
Masters Degree in Computer Applications, 2013-2016
* Relevant Coursework: Focused on software development, systems analysis, and enterprise-level application design
`;

@Component({
  selector: 'app-resume-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white shadow-sm rounded-xl p-6 sm:p-8 animate-fade-in border border-gray-200/80">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">2. Your Resume</h2>
      <p class="text-gray-600 mb-6">
        Upload your existing resume <strong>(.docx)</strong>. We will analyze its structure to let you customize the output.
      </p>

      @if (error() || localError()) {
        <div class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p class="text-sm text-red-700 flex-grow"><span class="font-bold">Error:</span> {{ error() || localError() }}</p>
          <button (click)="onResetApp()" class="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap border border-red-200 shadow-sm">
            Reset & Try Again
          </button>
        </div>
      }
      
      <!-- Template Status -->
      @if (savedTemplateName()) {
        <div class="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
               <div class="bg-green-100 p-2 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
               </div>
              <div>
                <p class="text-sm font-bold text-green-900">Default Template Loaded: {{ savedTemplateName() }}</p>
                <p class="text-xs text-green-700">Your resume content is ready for optimization.</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-3 mt-2 sm:mt-0 justify-end">
                <button (click)="downloadTemplate()" class="text-xs font-medium text-blue-600 hover:text-blue-800 underline">Download File</button>
                <button (click)="fileInput.click()" class="text-xs font-medium text-green-800 hover:text-green-900 underline">Change File</button>
                <button (click)="clearTemplate()" class="text-xs font-medium text-red-600 hover:text-red-800 underline">Remove Default</button>
            </div>
          </div>

          @if (isConfirmingClear()) {
              <div class="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p class="text-xs text-red-700 font-medium tracking-tight">Are you sure you want to remove the default template and clear settings?</p>
                  <div class="flex items-center gap-2">
                      <button (click)="cancelClearTemplate()" class="text-xs font-medium px-3 py-1.5 rounded bg-white text-gray-600 border border-gray-300 hover:bg-gray-50">Cancel</button>
                      <button (click)="confirmClearTemplate()" class="text-xs font-medium px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700">Confirm Remove</button>
                  </div>
              </div>
          }

          @if (masterStyle()) {
            <div class="bg-white/50 rounded-lg p-3 border border-green-100 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.172-1.172a4 4 0 115.656 5.656L11 18.657" />
                </svg>
                <span class="text-xs text-green-800 font-medium">
                  Style Extracted: {{ masterStyle().fontFamily }}, {{ masterStyle().fontSizePt }}pt
                </span>
              </div>
              <button (click)="resetMasterStyle()" class="text-[10px] uppercase tracking-wider font-bold text-gray-400 hover:text-red-500 transition-colors">
                Reset Style
              </button>
            </div>
          }
        </div>
      }

      <input #fileInput type="file" class="sr-only" accept=".docx" (change)="onFileSelected($event)">

      <!-- File Input -->
      @if (!auth.user()) {
        <div class="mb-6 p-6 border-2 border-dashed border-gray-300 rounded-lg text-center bg-gray-50">
           <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
           </svg>
           <h3 class="mt-2 text-sm font-medium text-gray-900">Authentication Required</h3>
           <p class="mt-1 text-sm text-gray-500">Please log in to upload and save custom template structures.</p>
        </div>
      } @else if (!savedTemplateName()) {
        <div class="mb-6">
          <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 transition-colors"
               [class.border-blue-500]="isDragging"
               (dragover)="onDragOver($event)"
               (dragleave)="onDragLeave($event)"
               (drop)="onDrop($event)">
            <div class="space-y-1 text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <div class="flex text-sm text-gray-600 justify-center">
                <button (click)="fileInput.click()" class="relative cursor-pointer bg-white rounded-md font-medium text-blue-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                  <span>Upload .docx</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Raw Format Details Toggle -->
       <div class="mb-6">
        <button (click)="toggleTextVisibility()" class="text-xs text-gray-500 hover:text-gray-900 underline mb-2">
            {{ showText() ? 'Hide Raw Format Details' : 'View Raw Format Details' }}
        </button>
        @if (showText()) {
            <div class="w-full h-64 p-4 bg-gray-50 text-gray-900 border border-gray-300 rounded-lg text-xs font-mono overflow-auto whitespace-pre-wrap">
              {{ rawFormatDetails() ? (rawFormatDetails() | json) : 'No format details extracted yet. Upload a .docx file.' }}
            </div>
        }
      </div>

      <!-- Analysis / Config Section -->
      @if (isAnalyzing()) {
         <div class="flex flex-col items-center justify-center py-8 animate-pulse">
             <div class="relative">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                   </svg>
                </div>
             </div>
             <span class="mt-4 text-sm font-medium text-gray-600">{{ analysisProgress() }}</span>
             <p class="text-xs text-gray-400 mt-1">This usually takes 3-5 seconds...</p>
         </div>
      } @else {
        <!-- Analyzed Sections (Collapsible) -->
        @if (extractedSections().summary || extractedSections().certifications?.length || extractedSections().education?.length || extractedSections().workExperienceText) {
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
            <h3 class="font-bold text-gray-800 mb-3">Analyzed Resume Sections</h3>
            <p class="text-xs text-gray-500 mb-4">We've extracted the following sections from your resume. These will be used for optimization.</p>

            <div class="space-y-2">
              @if (extractedSections().summary) {
                <details class="group bg-white rounded-lg border border-gray-200">
                  <summary class="flex cursor-pointer items-center justify-between p-3 font-medium text-sm text-gray-900">
                    <span>Professional Summary</span>
                    <span class="transition group-open:rotate-180">
                      <svg fill="none" height="20" shape-rendering="geometricPrecision" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div class="p-3 pt-0 text-xs text-gray-600 whitespace-pre-wrap border-t border-gray-100 mt-2">
                    {{ extractedSections().summary }}
                  </div>
                </details>
              }

              @if (extractedSections().certifications && extractedSections().certifications!.length > 0) {
                <details class="group bg-white rounded-lg border border-gray-200">
                  <summary class="flex cursor-pointer items-center justify-between p-3 font-medium text-sm text-gray-900">
                    <span>Certifications</span>
                    <span class="transition group-open:rotate-180">
                      <svg fill="none" height="20" shape-rendering="geometricPrecision" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div class="p-3 pt-0 text-xs text-gray-600 border-t border-gray-100 mt-2">
                    <ul class="list-disc pl-5 space-y-1">
                      @for (cert of extractedSections().certifications; track cert) {
                        <li>{{ cert }}</li>
                      }
                    </ul>
                  </div>
                </details>
              }

              @if (extractedSections().education && extractedSections().education!.length > 0) {
                <details class="group bg-white rounded-lg border border-gray-200">
                  <summary class="flex cursor-pointer items-center justify-between p-3 font-medium text-sm text-gray-900">
                    <span>Education</span>
                    <span class="transition group-open:rotate-180">
                      <svg fill="none" height="20" shape-rendering="geometricPrecision" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div class="p-3 pt-0 text-xs text-gray-600 border-t border-gray-100 mt-2">
                    <ul class="list-disc pl-5 space-y-1">
                      @for (edu of extractedSections().education; track edu) {
                        <li>{{ edu }}</li>
                      }
                    </ul>
                  </div>
                </details>
              }
              
              @if (extractedSections().workExperienceText) {
                <details class="group bg-white rounded-lg border border-gray-200">
                  <summary class="flex cursor-pointer items-center justify-between p-3 font-medium text-sm text-gray-900">
                    <span>Work Experience (Raw)</span>
                    <span class="transition group-open:rotate-180">
                      <svg fill="none" height="20" shape-rendering="geometricPrecision" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div class="p-3 pt-0 text-xs text-gray-600 whitespace-pre-wrap border-t border-gray-100 mt-2">
                    {{ extractedSections().workExperienceText }}
                  </div>
                </details>
              }
            </div>
          </div>
        }

        <div class="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
            <h3 class="font-bold text-gray-800 mb-3">Optimization Settings</h3>
            
            <div class="mb-4 bg-white p-3 rounded-lg border border-gray-200">
                <label class="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="integrateSkills" class="h-4 w-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500">
                    <div>
                      <span class="text-sm text-gray-800 font-medium">Integrate Skills into Bullets</span>
                      <p class="text-xs text-gray-500">Weaves technical skills from the job description into your experience.</p>
                    </div>
                </label>
            </div>

            <h4 class="text-xs font-bold uppercase text-gray-500 mb-2">Bullet Points per Company</h4>
            @if (companyConfigs().length > 0) {
                <div class="space-y-3">
                    @for (config of companyConfigs(); track config.name; let i = $index) {
                        <div class="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                            <span class="text-sm font-medium text-gray-900 truncate w-1/2" title="{{ config.name }}">{{ config.name }}</span>
                            <div class="flex items-center gap-3 w-1/2 justify-end">
                                <input 
                                    type="range" min="2" max="10" step="1" 
                                    [(ngModel)]="config.bulletCount" 
                                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                >
                                <span class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm border border-blue-200">
                                    {{ config.bulletCount }}
                                </span>
                            </div>
                        </div>
                    }
                </div>
            } @else {
                <div class="bg-white p-4 rounded-lg border border-gray-200 border-dashed text-center">
                    <p class="text-sm text-gray-500">Upload a resume or click "Analyze Resume" to extract companies.</p>
                </div>
            }
        </div>
      }
      
      <!-- Prompt Editor -->
      <div class="mb-6 border-t border-gray-200 pt-6">
         <button (click)="togglePromptEditor()" class="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 focus:outline-none">
            <span class="text-lg font-mono">{{ showPromptEditor() ? '[-]' : '[+]' }}</span>
            Advanced: Customize AI Instructions
         </button>
         
         @if (showPromptEditor()) {
            <div class="mt-3 animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Resume Prompt -->
                <div>
                    <h4 class="text-sm font-bold text-gray-700 mb-2">Resume Prompt instructions</h4>
                    <textarea 
                        [(ngModel)]="promptInstructions"
                        (blur)="savePrompt()"
                        class="w-full h-96 p-4 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner"
                        spellcheck="false"
                    ></textarea>
                    <div class="flex justify-between mt-1">
                        <span class="text-[10px] text-gray-400">Markdown supported.</span>
                        <button (click)="resetPrompt()" class="text-[10px] text-red-500 font-medium hover:text-red-700 underline">Reset to Defaults</button>
                    </div>
                </div>

                <!-- Cover Letter Prompt -->
                <div>
                    <h4 class="text-sm font-bold text-gray-700 mb-2">Cover letter prompt instructions</h4>
                    <textarea 
                        [(ngModel)]="clPromptInstructions"
                        (blur)="savePrompt()"
                        class="w-full h-96 p-4 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner"
                        spellcheck="false"
                    ></textarea>
                    <div class="flex justify-between mt-1">
                        <span class="text-[10px] text-gray-400">Markdown supported.</span>
                        <button (click)="resetCLPrompt()" class="text-[10px] text-red-500 font-medium hover:text-red-700 underline">Reset to Defaults</button>
                    </div>
                </div>
            </div>
         }
      </div>

      <!-- Main Actions -->
      <div class="flex justify-between items-center">
         <button 
             *ngIf="text().trim() && companyConfigs().length === 0"
             (click)="analyzeText()"
             class="text-blue-500 font-medium hover:underline text-sm"
         >
             Analyze Resume
         </button>

        <button 
          (click)="onNext()"
          [disabled]="!text().trim() || isAnalyzing()"
          class="ml-auto inline-flex items-center px-6 py-3 font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors shadow">
          Start Optimization
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      </div>
    </div>
  `
})
export class ResumeInputComponent implements OnInit {
  text = signal('');
  error = input<string | null>(null);
  localError = signal<string | null>(null); // Local error state
  submitResume = output<{
      text: string, 
      configs: CompanyConfig[], 
      integrateSkills: boolean, 
      customInstructions: string,
      coverLetterInstructions: string,
      extractedSections?: {
          summary?: string, 
          certifications?: string[], 
          education?: string[], 
          workExperienceText?: string
      }
  }>();
  instructionsChange = output<{customInstructions: string, coverLetterInstructions: string}>();
  resetApp = output<void>(); // Event to reset the app
  
  initialCompanyConfigs = input<CompanyConfig[]>([]);
  initialExtractedSections = input<{
      summary?: string, 
      certifications?: string[], 
      education?: string[], 
      workExperienceText?: string
  }>({});
  initialCustomInstructions = input<string | undefined>(undefined);
  initialCoverLetterInstructions = input<string | undefined>(undefined);

  savedTemplateName = signal<string | undefined>(undefined);
  masterStyle = signal<any | null>(null);
  showText = signal(false);
  rawFormatDetails = signal<any | null>(null);
  isDragging = false;
  
  // Prompt State
  showPromptEditor = signal(false);
  promptInstructions = signal(DEFAULT_INSTRUCTIONS);
  clPromptInstructions = signal(DEFAULT_COVER_LETTER_INSTRUCTIONS);
  
  // New States
  isAnalyzing = signal(false);
  analysisProgress = signal('');
  companyConfigs = signal<CompanyConfig[]>([]);
  integrateSkills = signal(true); // Default to true
  extractedSections = signal<{
      summary?: string, 
      certifications?: string[], 
      education?: string[], 
      workExperienceText?: string
  }>({});

  private lastAnalyzedText = '';

  public auth = inject(AuthService);
  private docService = inject(DocProcessorService);
  private geminiService = inject(GeminiService);

  constructor() {
    effect(() => {
        const configs = this.initialCompanyConfigs();
        if (configs && configs.length > 0) {
            this.companyConfigs.set(JSON.parse(JSON.stringify(configs)));
            // Avoid triggering another analysis
            this.lastAnalyzedText = this.text().trim();
        }
    }, { allowSignalWrites: true });

    effect(() => {
        const secs = this.initialExtractedSections();
        if (secs && Object.keys(secs).length > 0) {
            this.extractedSections.set(JSON.parse(JSON.stringify(secs)));
        }
    }, { allowSignalWrites: true });

    effect(() => {
        const custom = this.initialCustomInstructions();
        if (custom) this.promptInstructions.set(custom);
        const clCustom = this.initialCoverLetterInstructions();
        if (clCustom) this.clPromptInstructions.set(clCustom);
    }, { allowSignalWrites: true });

    effect(() => {
      // Listen to template changes
      const changeId = this.docService.templateChange();
      // Use untracked just in case, but since we are relying on the signal we want it tracked
      // We call async function inside
      this.loadTemplateData();
    });
  }

  async loadTemplateData() {
    const name = await this.docService.getTemplateName();

    if (name) {
        this.savedTemplateName.set(name);
        
        // Ensure style is recovered if missing
        const style = await this.docService.getMasterStyleAndEnsure();
        this.masterStyle.set(style);
        
        // Ensure raw format details are loaded
        const buffer = await this.docService.getTemplateBuffer();
        if (buffer) {
             const raw = this.docService.extractRawFormatDetails(buffer);
             this.rawFormatDetails.set(raw);
        }

        // Automatically extract text from saved template
        const savedText = await this.docService.getStoredTemplateText();
        if (savedText && savedText.trim()) {
            this.text.set(savedText);
            this.lastAnalyzedText = savedText;
            
            // Check if configs are already restored from parent/cloud
            if (this.companyConfigs().length > 0 || this.initialCompanyConfigs().length > 0) {
                // Give effect time to apply if it hasn't already
                if (this.companyConfigs().length === 0) {
                     this.companyConfigs.set(JSON.parse(JSON.stringify(this.initialCompanyConfigs())));
                }
                
                const secs = this.initialExtractedSections();
                if (secs && Object.keys(secs).length > 0 && Object.keys(this.extractedSections()).length === 0) {
                     this.extractedSections.set(JSON.parse(JSON.stringify(secs)));
                }

                // Assume analysis is perfectly restored 
                return;
            }

            // Fallback: Use a simple hash of the local text for caching
            const textHash = this.simpleHash(savedText);
            const cachedConfigs = localStorage.getItem(`configs_${textHash}`);
            if (cachedConfigs) {
                try {
                    this.companyConfigs.set(JSON.parse(cachedConfigs));
                } catch (e) {
                    await this.analyzeText();
                }
            } else {
                await this.analyzeText();
            }
        } else {
            // Fallback to default if stored text is empty
            this.text.set(DEFAULT_RESUME_TEXT);
            this.savedTemplateName.set(undefined);
            this.masterStyle.set(null);
            this.rawFormatDetails.set(null);
        }
    } else {
        // Load default resume if no custom template is present
        this.text.set(DEFAULT_RESUME_TEXT);
        this.savedTemplateName.set(undefined);
        this.masterStyle.set(null);
        this.rawFormatDetails.set(null);
    }
  }

  async downloadTemplate() {
    try {
        const buffer = await this.docService.getTemplateBuffer();
        if (buffer) {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = this.savedTemplateName() || 'resume_template.docx';
            link.click();
            window.URL.revokeObjectURL(url);
        }
    } catch (e) {
        console.error('Failed to download template', e);
    }
  }

  ngOnInit() {
    // Load persisted prompt instructions
    const savedInstructions = localStorage.getItem('custom_ai_instructions');
    if (savedInstructions) {
        this.promptInstructions.set(savedInstructions);
    }
    const savedCLInstructions = localStorage.getItem('custom_cl_instructions');
    if (savedCLInstructions) {
        this.clPromptInstructions.set(savedCLInstructions);
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  togglePromptEditor() {
      this.showPromptEditor.update(v => !v);
  }

  savePrompt() {
      localStorage.setItem('custom_ai_instructions', this.promptInstructions());
      localStorage.setItem('custom_cl_instructions', this.clPromptInstructions());
      this.instructionsChange.emit({
          customInstructions: this.promptInstructions(),
          coverLetterInstructions: this.clPromptInstructions()
      });
  }

  resetPrompt() {
      if(confirm('Are you sure you want to reset the Resume instructions to the original defaults? Your custom changes will be lost.')) {
        this.promptInstructions.set(DEFAULT_INSTRUCTIONS);
        localStorage.removeItem('custom_ai_instructions');
        this.instructionsChange.emit({
          customInstructions: DEFAULT_INSTRUCTIONS,
          coverLetterInstructions: this.clPromptInstructions()
        });
      }
  }

  resetCLPrompt() {
      if(confirm('Are you sure you want to reset the Cover Letter instructions to the original defaults? Your custom changes will be lost.')) {
        this.clPromptInstructions.set(DEFAULT_COVER_LETTER_INSTRUCTIONS);
        localStorage.removeItem('custom_cl_instructions');
        this.instructionsChange.emit({
          customInstructions: this.promptInstructions(),
          coverLetterInstructions: DEFAULT_COVER_LETTER_INSTRUCTIONS
        });
      }
  }

  onResetApp() {
      this.localError.set(null);
      this.resetApp.emit();
  }

  onNext() {
    if (this.text().trim()) {
      // Ensure we save current state before submitting
      this.savePrompt();
      
      this.submitResume.emit({ 
          text: this.text(), 
          configs: this.companyConfigs(), 
          integrateSkills: this.integrateSkills(),
          customInstructions: this.promptInstructions(),
          coverLetterInstructions: this.clPromptInstructions(),
          extractedSections: this.extractedSections()
      });
    }
  }

  toggleTextVisibility() {
      this.showText.update(v => !v);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  async processFile(file: File) {
    this.localError.set(null);
    if (!file.name.endsWith('.docx')) {
      this.localError.set('Please upload a .docx file.');
      return;
    }
    
    if (file.size > 700 * 1024) {
      this.localError.set('Warning: This template is larger than 700KB. It will work locally, but unfortunately cannot be synced to the cloud across devices due to size limits.');
      // Deliberately continue, so they can use it locally if they want
    }

    try {
      await this.docService.saveTemplate(file);
      this.savedTemplateName.set(file.name);
      
      const arrayBuffer = await file.arrayBuffer();
      this.masterStyle.set(this.docService.getMasterStyle());
      
      const rawDetails = this.docService.extractRawFormatDetails(arrayBuffer);
      this.rawFormatDetails.set(rawDetails);

      const extractedText = await this.docService.extractText(arrayBuffer);
      this.text.set(extractedText);
      
      // Auto-analyze
      await this.analyzeText();

    } catch (err: any) {
      console.error(err);
      this.localError.set(err.message || 'Failed to process file.');
    }
  }

  isConfirmingClear = signal<boolean>(false);

  async clearTemplate() {
    this.isConfirmingClear.set(true);
  }
  
  async confirmClearTemplate() {
    await this.docService.clearTemplate();
    this.savedTemplateName.set(undefined);
    this.text.set('');
    this.companyConfigs.set([]);
    this.extractedSections.set({});
    this.localError.set(null);
    this.isConfirmingClear.set(false);
  }
  
  cancelClearTemplate() {
    this.isConfirmingClear.set(false);
  }

  resetMasterStyle() {
    if (confirm('Are you sure you want to reset the default style? The next file you upload will become the new style source.')) {
        localStorage.removeItem('master_resume_style');
        this.masterStyle.set(null);
    }
  }

  async analyzeText() {
      const currentText = this.text().trim();
      if (!currentText) return;
      
      // Skip if already analyzed this exact text
      if (this.lastAnalyzedText === currentText && this.companyConfigs().length > 0) {
          return;
      }

      this.isAnalyzing.set(true);
      this.analysisProgress.set('Initializing AI scanner...');
      this.localError.set(null);
      
      try {
          this.analysisProgress.set('Extracting company history and sections...');
          const metadata = await this.geminiService.extractMetadata(currentText);
          
          if (metadata) {
              this.extractedSections.set({
                  summary: metadata.summary,
                  certifications: metadata.certifications,
                  education: metadata.education,
                  workExperienceText: metadata.workExperienceText
              });
          }
          
          this.analysisProgress.set('Configuring optimization settings...');
          // Apply bullet defaults: 8, 7, 6, then 4 for remaining
          const configs = (metadata?.companies || []).map((c, index) => {
              let count = 4;
              if (index === 0) count = 8;
              else if (index === 1) count = 7;
              else if (index === 2) count = 6;
              
              return { name: c, bulletCount: count };
          });
          
          this.companyConfigs.set(configs);
          this.lastAnalyzedText = currentText;
          
          // Cache the result using the text hash
          const textHash = this.simpleHash(currentText);
          localStorage.setItem(`configs_${textHash}`, JSON.stringify(configs));
      } catch (e: any) {
          console.error("Analysis failed", e);
          this.localError.set(e.message || "Analysis failed. Please try again.");
      } finally {
          this.isAnalyzing.set(false);
          this.analysisProgress.set('');
      }
  }
}