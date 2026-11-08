import { Component, input, output, signal, inject, OnInit, effect, computed, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OptimizationResult } from '../types';
import { DocProcessorService } from '../services/doc-processor.service';
import { GeminiService } from '../services/gemini.service';
import { AuthService, db } from '../services/auth.service';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

declare var html2pdf: any;

@Component({
  selector: 'app-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    /* Critical for keeping headers with content */
    .job-block {
        page-break-inside: avoid;
        break-inside: avoid;
        display: block;
        position: relative;
    }
    
    #resume-container {
        background: #eef2ff;
        padding: 60px 0;
        display: flex;
        justify-content: center;
        overflow-x: auto;
        min-height: 100vh;
    }

    #resume-content {
        width: 210mm;
        min-height: 297mm;
        background: white;
        box-shadow: none;
        border: 1px solid #e0e7ff;
        border-radius: 0.75rem;
        margin: 0 auto;
        position: relative;
        box-sizing: border-box;
    }

    /* Page Break Indicator - Proper Split */
    .page-break-line {
        position: absolute;
        left: -40px;
        right: -40px;
        height: 60px;
        background: #eef2ff;
        pointer-events: none;
        z-index: 20;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    
    .page-break-shadow-top {
        position: absolute;
        top: -1px; left: 40px; right: 40px; height: 1px;
        border-top: 1px solid #e0e7ff;
        box-shadow: none;
    }
    .page-break-shadow-bottom {
        position: absolute;
        bottom: -1px; left: 40px; right: 40px; height: 1px;
        border-bottom: 1px solid #e0e7ff;
        box-shadow: none;
    }

    .page-break-label {
        color: #64748b;
        font-size: 12px;
        padding: 4px 16px;
        font-weight: 700;
        letter-spacing: 0.2em;
        text-transform: uppercase;
    }
    
    input.editable-header {
        background: transparent;
        border: 1px dashed transparent;
        transition: all 0.2s;
    }
    input.editable-header:hover, input.editable-header:focus {
        border-color: #cbd5e1;
        background: #f8fafc;
    }

    .cl-textarea {
        width: 100%;
        height: 100%;
        resize: none;
        outline: none;
        overflow: hidden;
        background: transparent;
    }
    
    /* Range Slider Styling */
    input[type=range] {
        -webkit-appearance: none;
        background: transparent;
    }
    input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: #3b82f6;
        cursor: pointer;
        margin-top: -6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    input[type=range]::-webkit-slider-runnable-track {
        width: 100%;
        height: 4px;
        cursor: pointer;
        background: #e2e8f0;
        border-radius: 2px;
    }

    @keyframes progress {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(300%); }
    }
  `],
  template: `
    <div class="flex gap-8 animate-fade-in-up pb-20 relative">
      
      <!-- Subtle Loading Indicator -->
      @if (isLoading()) {
        <div class="absolute top-0 left-0 right-0 z-50 pointer-events-none">
            <div class="h-1.5 w-full bg-blue-100 overflow-hidden rounded-full">
                <div class="h-full bg-blue-500 animate-[progress_2s_infinite_linear] w-1/3"></div>
            </div>
            <div class="flex justify-center mt-2">
                <span class="bg-white/90 backdrop-blur px-4 py-1 rounded-full shadow-sm border border-blue-100 text-xs font-bold text-blue-600 animate-pulse">
                    AI is refining your resume...
                </span>
            </div>
        </div>
      }
      
      <!-- Main Content (Resume or Cover Letter) -->
      <div class="flex-grow space-y-6 min-w-0">

        <h2 class="text-2xl font-bold text-gray-900 mb-2">3. Review & Export</h2>

        <!-- Version Switcher -->
        @if (versions().length > 1) {
            <div class="flex items-center gap-2 mb-4 bg-white p-2 rounded-lg border border-gray-200 shadow-sm w-fit">
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Versions</span>
                    <span class="text-[8px] text-gray-400 px-2 leading-none">(Right click to delete)</span>
                </div>
                <div class="flex gap-1 ml-2 relative">
                    @for (v of versions(); track $index) {
                        <div class="relative">
                            <button 
                                (click)="versionChange.emit($index)"
                                (contextmenu)="$event.preventDefault(); handleContextMenu($event, $index)"
                                [class.bg-blue-500]="currentVersionIndex() === $index"
                                [class.text-white]="currentVersionIndex() === $index"
                                [class.bg-gray-100]="currentVersionIndex() !== $index"
                                [class.text-gray-600]="currentVersionIndex() !== $index"
                                class="w-8 h-8 rounded-md text-xs font-bold transition-all hover:scale-105"
                                title="Right click to delete">
                                {{ $index + 1 }}
                            </button>
                            
                            @if (contextMenuVisibleForVersion() === $index) {
                                <div class="absolute top-10 left-0 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden w-24">
                                    <button 
                                        (click)="confirmDelete($index)"
                                        class="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-1 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete
                                    </button>
                                </div>
                                <div class="fixed inset-0 z-40" (click)="contextMenuVisibleForVersion.set(null)" (contextmenu)="$event.preventDefault(); contextMenuVisibleForVersion.set(null)"></div>
                            }
                        </div>
                    }
                </div>
            </div>
        }

        @if (errorMessage()) {
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 mb-4 animate-fade-in">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                <p class="text-sm text-red-800 font-medium">{{ errorMessage() }}</p>
                <button (click)="errorMessage.set(null)" class="ml-auto text-red-500 hover:text-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        }

        <!-- Tab Switcher -->
        <div class="max-w-xs mx-auto print:hidden">
            <div class="p-1 bg-gray-200/80 rounded-lg flex space-x-1">
                <button 
                    (click)="activeTab.set('resume')"
                    [class.bg-white]="activeTab() === 'resume'"
                    [class.text-gray-900]="activeTab() === 'resume'"
                    [class.shadow-sm]="activeTab() === 'resume'"
                    class="w-full rounded-md py-1.5 text-sm font-semibold text-gray-600 transition-all">
                    Resume
                </button>
                <button
                    (click)="activeTab.set('letter')"
                    [class.bg-white]="activeTab() === 'letter'"
                    [class.text-gray-900]="activeTab() === 'letter'"
                    [class.shadow-sm]="activeTab() === 'letter'"
                    class="w-full rounded-md py-1.5 text-sm font-semibold text-gray-600 transition-all">
                    Cover Letter
                </button>
            </div>
        </div>

        @if (activeTab() === 'letter') {
             <div class="flex justify-end gap-2 mb-4 print:hidden">
                <button (click)="generateCoverLetter()" [disabled]="isGeneratingCL() || isLoading() || !data()" class="inline-flex items-center px-4 py-2 border border-indigo-200 shadow-sm text-xs font-bold tracking-wide rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" [class.animate-spin]="isGeneratingCL()">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate CL
                </button>
                <button (click)="downloadCoverLetterDoc()" [disabled]="!coverLetterContent() || isGeneratingCL() || isLoading() || !data()" class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-xs font-bold uppercase tracking-wide rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                   Export Cover Letter (.DOCX)
                </button>
             </div>
        }

        <!-- ATS Analysis Report (Only for Resume) -->
        @if (activeTab() === 'resume' && data()?.atsAnalysis) {
            <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm print:hidden transition-all duration-300">
                <div class="flex flex-col md:flex-row gap-6 items-center justify-center">
                    <!-- Score Circle (Always Visible) -->
                    <div class="flex-shrink-0 flex items-center gap-4 cursor-pointer w-full md:w-auto justify-center" (click)="isAnalysisExpanded.set(!isAnalysisExpanded())">
                        <div class="relative h-16 w-16 md:h-24 md:w-24 flex-shrink-0">
                            <svg class="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                                <path class="text-indigo-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" />
                                <path class="text-indigo-600 transition-all duration-1000 ease-out" [attr.stroke-dasharray]="data()?.atsAnalysis?.score + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" />
                            </svg>
                            <div class="absolute inset-0 flex items-center justify-center flex-col">
                                <span class="text-xl md:text-2xl font-bold text-indigo-900">{{ data()?.atsAnalysis?.score }}%</span>
                                <span class="text-[10px] md:text-xs text-indigo-600 font-medium">ATS Score</span>
                            </div>
                        </div>
                        
                        <div class="flex-grow md:hidden text-center">
                             <h3 class="text-lg font-bold text-indigo-900">Optimization Analysis</h3>
                             <p class="text-indigo-600 text-xs">Click to {{ isAnalysisExpanded() ? 'collapse' : 'expand' }} details</p>
                        </div>
                        
                        <div class="hidden md:block">
                             <button class="text-indigo-500 hover:text-indigo-700 text-sm font-medium focus:outline-none">
                                 {{ isAnalysisExpanded() ? 'Hide Details' : 'Show Details' }}
                             </button>
                        </div>
                    </div>

                    <!-- Details (Collapsible) -->
                    @if (isAnalysisExpanded()) {
                        <div class="flex-grow animate-fade-in w-full">
                            <h3 class="text-lg font-bold text-indigo-900 mb-2 hidden md:block">Optimization Analysis</h3>
                            <p class="text-indigo-800 text-sm mb-3 italic">{{ data()?.atsAnalysis?.improvementReasoning }}</p>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h4 class="text-xs font-bold uppercase text-indigo-400 mb-1">Matched Keywords</h4>
                                <div class="flex flex-wrap gap-1">
                                @for (word of data()?.atsAnalysis?.matchedKeywords; track word) {
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">{{ word }}</span>
                                }
                                </div>
                            </div>
                            <div>
                                <h4 class="text-xs font-bold uppercase text-indigo-400 mb-1">Missing Keywords</h4>
                                <div class="flex flex-wrap gap-1">
                                @for (word of data()?.atsAnalysis?.missingKeywords; track word) {
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">{{ word }}</span>
                                }
                                </div>
                            </div>
                            </div>
                        </div>
                    }
                </div>
            </div>
        }

        <!-- Toolbar -->
        <div class="bg-white/90 backdrop-blur-md rounded-xl shadow-sm p-3 border border-gray-200 print:hidden sticky top-20 z-20">
            <div class="flex flex-wrap items-center justify-between gap-y-3 gap-x-4">
            
            <!-- View Controls -->
            <div class="flex flex-wrap items-center gap-4 text-gray-600">
                <!-- Margin Controls -->
                <div class="flex items-center gap-2 border-r pr-4">
                    <span class="text-xs font-bold uppercase text-gray-400">Margins</span>
                    <div class="flex items-center gap-1">
                        <label class="text-[10px] text-gray-500">T/B</label>
                        <input type="number" [ngModel]="masterStyle()?.margins?.top || 25.4" (ngModelChange)="updateMargin('top', $event); updateMargin('bottom', $event)" class="w-12 px-1 py-0.5 text-xs border rounded" step="1">
                    </div>
                    <div class="flex items-center gap-1">
                        <label class="text-[10px] text-gray-500">L/R</label>
                        <input type="number" [ngModel]="masterStyle()?.margins?.left || 19" (ngModelChange)="updateMargin('left', $event); updateMargin('right', $event)" class="w-12 px-1 py-0.5 text-xs border rounded" step="1">
                    </div>
                </div>

                <!-- Font Controls -->
                <div class="flex items-center gap-2 border-r pr-4">
                    <span class="text-xs font-bold uppercase text-gray-400">Font</span>
                    <select [ngModel]="masterStyle()?.fontFamily || 'Arial'" (ngModelChange)="updateStyle('fontFamily', $event)" class="w-24 px-1 py-0.5 text-xs border rounded bg-white font-sans text-gray-700">
                        <option value="Arial">Arial</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Garamond">Garamond</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Trebuchet MS">Trebuchet MS</option>
                    </select>
                    <input type="number" [ngModel]="masterStyle()?.fontSizePt || 11" (ngModelChange)="updateStyle('fontSizePt', $event)" class="w-12 px-1 py-0.5 text-xs border rounded" step="0.5" min="8" max="24">
                    <span class="text-[10px] text-gray-500">pt</span>
                </div>

                <!-- Extra Settings -->
                @if (activeTab() === 'resume') {
                    <div class="flex items-center gap-3 h-6">
                        <button 
                            (click)="toggleJd()"
                            class="text-xs font-bold px-2 py-1 rounded border transition-colors"
                            [class.bg-blue-50]="showJd()"
                            [class.border-blue-200]="showJd()"
                            [class.text-blue-700]="showJd()"
                            [class.bg-white]="!showJd()"
                            [class.border-gray-200]="!showJd()"
                            [class.text-gray-600]="!showJd()"
                            >
                            {{ showJd() ? 'Hide JD' : 'Show JD' }}
                        </button>
                    </div>
                }
            </div>

            </div>
        </div>

        @if (activeTab() === 'resume') {
            <!-- Actions -->
            <div class="flex flex-wrap items-center justify-end gap-2 mb-4 relative z-50">
                
                <!-- Regenerate Options Dropdown -->
                <div class="relative inline-block text-left">
                    <button type="button" (click)="showRegenerateMenu.set(!showRegenerateMenu())" [disabled]="isLoading() || !data()" class="inline-flex items-center px-4 py-2 border border-indigo-200 shadow-sm text-xs font-bold tracking-wide rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        Regenerate Match
                        <svg class="-mr-1 ml-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>

                    @if (showRegenerateMenu()) {
                        <div class="origin-top-right absolute right-0 mt-2 w-56 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none overflow-hidden z-50 animate-fade-in-up">
                            <div class="py-1">
                                <button (click)="regenerateSection.emit({type: 'whole'}); showRegenerateMenu.set(false)" class="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-indigo-50 hover:text-indigo-700 flex items-center transition-colors">
                                    <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    Regenerate Whole Resume
                                </button>
                                <button (click)="regenerateSection.emit({type: 'summary'}); showRegenerateMenu.set(false)" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center transition-colors">
                                    <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Rewrite Summary Only
                                </button>
                            </div>
                            <div class="py-1">
                                <p class="px-4 py-2 text-xs font-bold tracking-wider text-gray-400 uppercase">Regenerate By Company</p>
                                @for (exp of data()?.experience || []; track exp.company; let i = $index) {
                                    <button (click)="regenerateSection.emit({type: 'experience', company: exp.company}); showRegenerateMenu.set(false)" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 truncate transition-colors flex items-center">
                                        <div class="w-1.5 h-1.5 rounded-full bg-gray-300 mr-2"></div>
                                        {{ exp.company }}
                                    </button>
                                }
                            </div>
                        </div>
                    }
                </div>

                <button (click)="downloadDoc()" [disabled]="isLoading() || !data()" class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-xs font-bold uppercase tracking-wide rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Export Resume (.DOCX)
                </button>
            </div>
            <!-- Resume Paper View (HTML Preview) -->
            <div id="resume-container" class="print:bg-white print:p-0">
                <div id="resume-content" 
                    class="bg-white shadow-lg min-h-[297mm] text-justify text-black leading-[1.3]"
                    [style.font-family]="masterStyle()?.fontFamily || 'Calibri, Arial, sans-serif'"
                    [style.font-size.pt]="masterStyle()?.fontSizePt || 10"
                    [style.padding-top.mm]="masterStyle()?.margins?.top || 25.4"
                    [style.padding-bottom.mm]="masterStyle()?.margins?.bottom || 25.4"
                    [style.padding-left.mm]="masterStyle()?.margins?.left || 19"
                    [style.padding-right.mm]="masterStyle()?.margins?.right || 19">
                
                <!-- Page Break Indicators -->
                <div class="page-break-line no-invert print:hidden" style="top: 297mm;">
                    <div class="page-break-shadow-top"></div>
                    <span class="page-break-label">PAGE 2</span>
                    <div class="page-break-shadow-bottom"></div>
                </div>
                
                @if (data()) {
                    <!-- Header -->
                    <header class="text-center mb-6 border-b border-black pb-4">
                        <h1 class="text-3xl font-bold uppercase mb-2 tracking-wide text-black">{{ data()?.personalInfo?.name }}</h1>
                        <div class="text-sm flex justify-center flex-wrap gap-1 text-black font-medium">
                        
                        @if (data()?.personalInfo?.email) { <a [href]="'mailto:' + data()!.personalInfo.email" class="text-black no-underline">{{ data()!.personalInfo.email }}</a> }
                        @if (data()?.personalInfo?.email && (data()?.personalInfo?.phone || data()?.personalInfo?.linkedin)) { <span class="mx-1">|</span> }
                        
                        @if (data()?.personalInfo?.phone) { <span>{{ data()?.personalInfo?.phone }}</span> }
                        @if (data()?.personalInfo?.phone && data()?.personalInfo?.linkedin) { <span class="mx-1">|</span> }
                        
                        @if (data()?.personalInfo?.linkedin) { <span>{{ data()?.personalInfo?.linkedin }}</span> }
                        </div>
                    </header>

                    <!-- Dynamic Sections -->
                    @for (section of sections(); track section.id; let i = $index) {
                        
                        <!-- Hide Skills Check -->
                        @if (section.id !== 'skills' || !hideSkillsSection()) {

                            <section class="mb-4 group relative rounded-md transition-colors hover:bg-gray-50 p-2 -mx-2">
                            <!-- Reorder Controls -->
                            <div class="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 p-1 print:hidden z-10">
                                <button (click)="moveSection(i, -1)" [disabled]="i === 0" class="p-1 bg-white border rounded shadow hover:bg-blue-50 text-gray-500 hover:text-blue-600">↑</button>
                                <button (click)="moveSection(i, 1)" [disabled]="i === sections().length - 1" class="p-1 bg-white border rounded shadow hover:bg-blue-50 text-gray-500 hover:text-blue-600">↓</button>
                            </div>

                            <!-- Editable Title (Centered) -->
                            <div class="mb-3 flex items-center justify-center gap-2">
                                <span class="border-b border-black pb-0.5 inline-block">
                                    <input 
                                        [ngModel]="section.title.toUpperCase()" 
                                        (ngModelChange)="section.title = $event; saveConfigs()"
                                        class="editable-header font-bold uppercase tracking-wider text-sm w-full text-black placeholder-gray-400 focus:outline-none focus:ring-0 px-1 text-center bg-transparent"
                                        style="min-width: 150px;"
                                    >
                                </span>
                            </div>

                            <!-- Summary Content -->
                            @if (section.id === 'summary') {
                                <p class="leading-snug italic text-justify text-black">{{ cleanText(data()?.summary || '') }}</p>
                            }

                            <!-- Experience Content -->
                            @if (section.id === 'experience') {
                                <div class="space-y-4">
                                @for (exp of data()?.experience || []; track $index) {
                                    <div class="job-block">
                                        <div class="flex items-baseline flex-wrap gap-1 mb-1">
                                            <span class="font-bold text-black">{{ exp.company }}</span>
                                            <span class="text-black">,</span>
                                            <span class="font-bold italic text-black">{{ exp.title || exp.role }}</span>
                                            <span class="text-black">,</span>
                                            <span class="text-black text-sm whitespace-nowrap">{{ exp.period || exp.duration }}</span>
                                        </div>
                                        <ul class="list-disc list-outside ml-4 space-y-1 marker:text-black">
                                            @for (point of getExperiencePoints(exp); track point) {
                                                <li class="pl-1 text-justify text-black">
                                                    {{ cleanText(point) }}
                                                </li>
                                            }
                                        </ul>
                                    </div>
                                }
                                </div>
                            }

                            <!-- Education Content -->
                            @if (section.id === 'education' && data()?.education?.length) {
                                <div class="grid gap-4">
                                @for (edu of data()?.education || []; track $index) {
                                    <div class="job-block">
                                        <div class="text-black">
                                            <span class="font-bold">{{ edu.institution }}</span>
                                            @if (edu.location) {<span>, {{ edu.location }}</span>}
                                            <span> - </span>
                                            <span class="italic">{{ edu.degree }}</span>
                                            @if (edu.year) {<span>, {{ edu.year }}</span>}
                                        </div>
                                        @if (edu.details?.length) {
                                            <div class="text-black text-sm mt-1 text-justify">
                                                @for (detail of edu.details; track detail) {
                                                    @let cleanDetail = cleanText(detail);
                                                    <div class="text-black">{{ cleanDetail }}</div>
                                                }
                                            </div>
                                        }
                                    </div>
                                }
                                </div>
                            }
                            
                            <!-- Certifications Content -->
                            @if (section.id === 'certifications' && data()?.certifications?.length) {
                                <div class="mb-4 text-justify text-black">
                                    @for (cert of data()?.certifications || []; track cert; let last = $last) {
                                        @let f = formatBulletPoint(cert);
                                        <span class="inline">
                                            @if (f.hasKey) {
                                                <strong>{{ f.key }}</strong>{{ f.val }}
                                            } @else {
                                                {{ f.key }}
                                            }
                                        </span>@if (!last) { <span class="text-black"> | </span> }
                                    }
                                </div>
                            }
                            </section>

                        }
                    }
                } @else {
                    <!-- Skeleton / Blank State -->
                    <div class="p-8 space-y-8 animate-pulse">
                        <div class="h-8 bg-gray-100 rounded w-1/2 mx-auto"></div>
                        <div class="h-4 bg-gray-100 rounded w-3/4 mx-auto"></div>
                        <div class="space-y-4">
                            <div class="h-4 bg-gray-100 rounded w-1/4"></div>
                            <div class="h-20 bg-gray-100 rounded w-full"></div>
                        </div>
                        <div class="space-y-4">
                            <div class="h-4 bg-gray-100 rounded w-1/4"></div>
                            <div class="h-40 bg-gray-100 rounded w-full"></div>
                        </div>
                    </div>
                }

                </div>
            </div>
        } @else {
            <!-- Cover Letter View -->
            <div id="cl-container" class="mx-auto max-w-[215.9mm]">
                <div id="cl-content"
                    class="bg-white shadow-lg min-h-[279.4mm] text-black leading-[1.6]"
                    [style.font-family]="masterStyle()?.fontFamily || 'Calibri, Arial, sans-serif'"
                    [style.font-size.pt]="masterStyle()?.fontSizePt || 10"
                    [style.padding-top.mm]="masterStyle()?.margins?.top || 25.4"
                    [style.padding-bottom.mm]="masterStyle()?.margins?.bottom || 25.4"
                    [style.padding-left.mm]="masterStyle()?.margins?.left || 19"
                    [style.padding-right.mm]="masterStyle()?.margins?.right || 19">

                    @if (!coverLetterContent() && !isLoading() && !isGeneratingCL()) {
                         <div class="h-full flex flex-col items-center justify-center py-20 gap-4">
                             <p class="text-gray-500 text-sm text-center max-w-md">No cover letter generated yet.</p>
                             <button (click)="generateCoverLetter()" class="px-6 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow hover:bg-blue-700 transition-colors">Generate Cover Letter</button>
                         </div>
                    } @else if (isLoading() || isGeneratingCL()) {
                        <div class="animate-pulse space-y-8">
                            <div class="h-4 bg-gray-100 rounded w-1/4"></div>
                            <div class="space-y-4">
                                <div class="h-4 bg-gray-100 rounded w-full"></div>
                                <div class="h-4 bg-gray-100 rounded w-full"></div>
                                <div class="h-4 bg-gray-100 rounded w-3/4"></div>
                            </div>
                            <div class="space-y-4">
                                <div class="h-4 bg-gray-100 rounded w-full"></div>
                                <div class="h-4 bg-gray-100 rounded w-full"></div>
                                <div class="h-4 bg-gray-100 rounded w-1/2"></div>
                            </div>
                        </div>
                    } @else {
                        <div id="cl-content-inner">
                            <textarea 
                                [ngModel]="coverLetterContent()"
                                (ngModelChange)="coverLetterContent.set($event); coverLetterUpdate.emit($event)"
                                class="cl-textarea w-full text-justify text-black whitespace-pre-wrap outline-none"
                                rows="30"
                                spellcheck="false"
                            ></textarea>
                        </div>
                        
                        <!-- Actions moved up -->
                    }
                </div>
            </div>
        }
        
        <!-- Re-optimize Input (HIDDEN) -->
      </div>
      
      <!-- Job Description Sidebar -->
      @if (showJd() && activeTab() === 'resume') {
         <div class="w-80 flex-shrink-0 bg-gray-50 border-l border-gray-200 p-4 sticky top-20 h-screen overflow-y-auto hidden xl:block print:hidden shadow-inner rounded-lg">
            <h3 class="font-bold text-gray-700 mb-2">Reference Job Description</h3>
            <p class="text-xs text-gray-500 mb-4">Use this to verify that the key requirements are addressed.</p>
            <div class="whitespace-pre-wrap text-xs text-gray-600 font-mono bg-white p-3 border rounded">
                {{ jobDescription() }}
            </div>
         </div>
      }
    </div>
  `
})
export class PreviewComponent implements OnInit, AfterViewInit, OnDestroy {
  data = input<OptimizationResult | null>(null);
  jobDescription = input<string>('');
  isLoading = input<boolean>(false);
  versions = input<OptimizationResult[]>([]);
  currentVersionIndex = input<number>(-1);
  reoptimize = output<string>();
  regenerateSection = output<{type: 'summary' | 'experience' | 'whole', company?: string}>();
  versionChange = output<number>();
  versionDelete = output<number>();
  coverLetterUpdate = output<string>();
  feedbackInput = signal('');
  
  // Dropdown States
  showRegenerateMenu = signal(false);
  contextMenuVisibleForVersion = signal<number | null>(null);
  
  handleContextMenu(event: MouseEvent, index: number) {
      this.contextMenuVisibleForVersion.set(index);
  }

  confirmDelete(index: number) {
      this.versionDelete.emit(index);
      this.contextMenuVisibleForVersion.set(null);
  }
  
  // Error State
  errorMessage = signal<string | null>(null);
  
  // Visibility State
  showJd = signal(false);
  activeTab = signal<'resume' | 'letter'>('resume');
  isAnalysisExpanded = signal(false);

  // Master Style
  masterStyle = signal<any>(null);

  // Cover Letter State
  coverLetterContent = signal<string>('');
  isGeneratingCL = signal(false);
  todayDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Default sections UPPERCASE
  sections = signal([
    { id: 'summary', title: 'SUMMARY' },
    { id: 'certifications', title: 'CERTIFICATIONS' }, 
    { id: 'experience', title: 'WORK EXPERIENCE' },
    { id: 'education', title: 'EDUCATION' }
  ]);
  
  private docService = inject(DocProcessorService);
  private geminiService = inject(GeminiService);
  private resizeObserver: ResizeObserver | null = null;
  private isAdjusting = false;

  ngOnInit() {
      // Handled by effect
  }

  ngAfterViewInit() {
      const content = document.getElementById('resume-content');
      if (content) {
          this.resizeObserver = new ResizeObserver(() => {
              if (!this.isAdjusting) {
                  this.ensureTwoPages();
              }
          });
          this.resizeObserver.observe(content);
      }
  }

  ngOnDestroy() {
      if (this.resizeObserver) {
          this.resizeObserver.disconnect();
      }
  }

  private ensureTwoPages() {
      const content = document.getElementById('resume-content');
      if (!content) return;
      
      // Approx conversion px to mm (96 DPI standard)
      const heightMm = content.scrollHeight * (25.4 / 96); 
      const maxAllowedHeight = 297 * 2; // 2 A4 pages
      
      if (heightMm > maxAllowedHeight + 2) { // 2mm buffer
          this.isAdjusting = true;
          const current = this.masterStyle() || {};
          const margins = { ...(current.margins || { top: 25.4, bottom: 25.4, left: 19, right: 19 }) };
          
          let changed = false;
          // Try reducing bottom margin first, then top, then font size
          if (margins.bottom > 10) {
              margins.bottom = Math.max(10, margins.bottom - 2);
              changed = true;
          } else if (margins.top > 10) {
              margins.top = Math.max(10, margins.top - 2);
              changed = true;
          } else if (current.fontSizePt > 8.5) {
              const updated = { ...current, fontSizePt: current.fontSizePt - 0.2 };
              this.masterStyle.set(updated);
              this.docService.updateMasterStyle(updated);
              changed = true;
          }

          if (changed) {
              const updated = { ...current, margins };
              this.masterStyle.set(updated);
              this.docService.updateMasterStyle(updated);
          }
          
          setTimeout(() => { this.isAdjusting = false; }, 100);
      }
  }

  updateMargin(side: 'top' | 'bottom' | 'left' | 'right', value: number) {
      const current = this.masterStyle() || {};
      const margins = current.margins || { top: 25.4, bottom: 25.4, left: 19, right: 19 };
      margins[side] = value;
      const updated = { ...current, margins };
      this.masterStyle.set(updated);
      this.docService.updateMasterStyle(updated);
  }

  updateStyle(key: string, value: any) {
      const current = this.masterStyle() || {};
      const updated = { ...current, [key]: value };
      this.masterStyle.set(updated);
      this.docService.updateMasterStyle(updated);
  }

  private authService = inject(AuthService);

  saveConfigs() {
      const orderJson = JSON.stringify(this.sections());
      localStorage.setItem('resume_section_order', orderJson);
      
      const user = this.authService.user();
      if (user) {
          setDoc(doc(db, 'users', user.uid, 'documents', 'masterTemplate'), {
              userId: user.uid,
              sectionOrder: this.sections(),
              updatedAt: serverTimestamp()
          }, { merge: true }).catch(console.error);
      }
  }
  
  constructor() {
      effect(() => {
          const changeId = this.docService.templateChange();
          // Rely on un-tracked code to not leak dependencies further
          import('@angular/core').then(({ untracked }) => {
              untracked(() => {
                  this.masterStyle.set(this.docService.getMasterStyle());
                  
                  const savedSections = localStorage.getItem('resume_section_order');
                  if (savedSections) {
                      try {
                          let parsed = JSON.parse(savedSections);
                          // Filter out skills section
                          parsed = parsed.filter((s: any) => s.id !== 'skills');
                          const defaultSecs = [
                              { id: 'summary', title: 'SUMMARY' },
                              { id: 'certifications', title: 'CERTIFICATIONS' }, 
                              { id: 'experience', title: 'WORK EXPERIENCE' },
                              { id: 'education', title: 'EDUCATION' }
                          ];
                          const existingIds = new Set(parsed.map((s: any) => s.id));
                          defaultSecs.forEach(ds => { if (!existingIds.has(ds.id)) parsed.push(ds); });
                          this.sections.set(parsed);
                      } catch(e) {}
                  }
              });
          });
      }, { allowSignalWrites: true });
      // effect(() => { this.saveConfigs(); }); // Commented this out as it causes saveConfigs on every render blindly!
      effect(() => {
          const data = this.data();
          if (data) Object.assign(this, { _tempDataRef: data }); // force ref tracking
          this.coverLetterContent.set(data?.coverLetter || '');
      }, { allowSignalWrites: true });
  }

  toggleJd() { this.showJd.update(v => !v); }

  // STRICTLY remove double asterisks from display text
  cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\*\*/g, '').replace(/__/g, '').replace(/\*/g, '');
  }

  getExperiencePoints(exp: any): string[] {
    if (!exp) return [];
    let points = exp.achievements || exp.points || [];
    if (points.length === 0 && exp.description) {
        // If description is a string, split it by bullets or newlines
        points = exp.description.split(/\n|•/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    }
    return points;
  }

  formatBulletPoint(point: string): { key: string, val: string, hasKey: boolean } {
    if (!point) return { key: '', val: '', hasKey: false };
    const separator = ' - ';
    const idx = point.indexOf(separator);
    if (idx > -1) {
        let key = point.substring(0, idx);
        const val = point.substring(idx); 
        
        // Clean key (removes **)
        key = this.cleanText(key);
        
        // Clean value as well to avoid artifacts in the middle of sentences
        const cleanVal = this.cleanText(val);

        return { key, val: cleanVal, hasKey: true };
    }
    return { key: this.cleanText(point), val: '', hasKey: false };
  }

  moveSection(index: number, direction: number) {
    const newIndex = index + direction;
    const currentSections = this.sections();
    if (newIndex >= 0 && newIndex < currentSections.length) {
      const temp = currentSections[index];
      currentSections[index] = currentSections[newIndex];
      currentSections[newIndex] = temp;
      this.sections.set([...currentSections]);
      this.saveConfigs();
    }
  }

  triggerReoptimize() {
    if (this.feedbackInput().trim()) {
      this.reoptimize.emit(this.feedbackInput());
      this.feedbackInput.set('');
    }
  }
  
  async generateCoverLetter() {
      this.isGeneratingCL.set(true);
      this.errorMessage.set(null);
      try {
          // Use summary + experience for context
          const expText = (this.data()?.experience || []).map(e => `${e.company} ${e.title} ${(e.achievements || []).join(' ')}`).join('\n');
          const context = `Summary: ${this.data()?.summary || ''}\nExperience: ${expText}`;
          
          const cl = await this.geminiService.generateCoverLetter(this.jobDescription(), context, this.data()?.personalInfo || {} as any);
          this.coverLetterContent.set(cl);
          this.coverLetterUpdate.emit(cl);
      } catch(e: any) {
          console.error(e);
          this.errorMessage.set(e.message || 'Failed to generate cover letter.');
      } finally {
          this.isGeneratingCL.set(false);
      }
  }

  getSafeFilename(ext: string, customSuffix: string = ''): string {
      const c = this.data()?.targetJob?.company?.replace(/[^a-zA-Z0-9]/g, '') || '';
      const r = this.data()?.targetJob?.role?.replace(/[^a-zA-Z0-9]/g, '') || '';
      const suffix = customSuffix || (this.activeTab() === 'letter' ? '_CoverLetter' : '_Resume');
      
      let base = c ? `${c}_${r}${suffix}` : `Resume${suffix}`;
      return `${base}.${ext}`;
  }

  nativePrint() {
      window.print();
  }

  async downloadCoverLetterDoc() {
    this.errorMessage.set(null);
    
    if (!this.coverLetterContent()) {
        this.errorMessage.set("No cover letter content to export. Please generate one first.");
        return;
    }

    try {
        const blob = await this.docService.generateCoverLetterDoc(
            this.data(), 
            this.coverLetterContent()
        );
        if (blob) {
            this.triggerDownload(blob, '_Cover_Letter');
        }
        else this.errorMessage.set('Could not generate cover letter DOCX. Please ensure a template was uploaded.');
    } catch(e: any) {
        console.error(e);
        this.errorMessage.set(e.message || 'Failed to generate cover letter DOCX.');
    }
  }

  async downloadDoc() {
    this.errorMessage.set(null);

    const sectionTitles: {[key: string]: string} = {};
    this.sections().forEach(s => sectionTitles[s.id] = s.title);
    
    try {
        const blob = await this.docService.generateDocWithTemplate(
            this.data(), 
            sectionTitles
        );
        if (blob) this.triggerDownload(blob);
        else this.errorMessage.set('Could not generate DOCX. Please ensure a template was uploaded.');
    } catch(e: any) {
        console.error(e);
        this.errorMessage.set(e.message || 'Failed to generate DOCX. Please verify the resume data.');
    }
  }
  
  triggerDownload(blob: Blob, suffix: string = '') {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.getSafeFilename('docx', suffix);
      link.click();
      window.URL.revokeObjectURL(url);
  }
}