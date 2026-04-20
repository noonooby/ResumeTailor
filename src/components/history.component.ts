import { Component, OnInit, inject, signal, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryService } from '../services/history.service';
import { AuthService } from '../services/auth.service';
import { HistoryItem } from '../types';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fade-in pb-10">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Resume History</h2>
        <button (click)="loadHistory()" class="text-sm text-blue-600 hover:text-blue-800">Refresh List</button>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-10">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      } @else if (items().length === 0) {
        <div class="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No history yet</h3>
          <p class="mt-1 text-sm text-gray-500">Generate your first resume to see it here.</p>
        </div>
      } @else {
        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <ul class="divide-y divide-gray-200">
            @for (item of items(); track item.id) {
              <li>
                <div class="block hover:bg-gray-50 transition-colors">
                  <div class="px-4 py-4 sm:px-6">
                    <div class="flex items-center justify-between">
                      <div class="flex flex-col truncate">
                        <p class="text-sm font-medium text-blue-600 truncate">{{ item.company }}</p>
                        <p class="text-sm text-gray-500 truncate">{{ item.role }}</p>
                      </div>
                      <div class="ml-2 flex-shrink-0 flex">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                              [class.bg-green-100]="item.score >= 90" [class.text-green-800]="item.score >= 90"
                              [class.bg-yellow-100]="item.score < 90 && item.score >= 70" [class.text-yellow-800]="item.score < 90 && item.score >= 70"
                              [class.bg-red-100]="item.score < 70" [class.text-red-800]="item.score < 70">
                          Score: {{ item.score }}
                        </span>
                      </div>
                    </div>
                    <div class="mt-2 sm:flex sm:justify-between">
                      <div class="sm:flex">
                        <p class="flex items-center text-xs text-gray-500">
                          <svg class="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
                          </svg>
                          {{ item.timestamp | date:'medium' }}
                        </p>
                      </div>
                      <div class="mt-2 flex items-center gap-3 sm:mt-0 text-sm">
                        <button (click)="onSelect(item)" class="font-medium text-indigo-600 hover:text-indigo-500">
                           View Resume
                        </button>
                        <button (click)="onDelete(item.id, $event)" class="font-medium text-red-600 hover:text-red-500">
                           Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `
})
export class HistoryComponent implements OnInit {
  items = signal<HistoryItem[]>([]);
  loading = signal(true);
  selectItem = output<HistoryItem>();

  private historyService = inject(HistoryService);
  private auth = inject(AuthService);

  constructor() {
      effect(() => {
          const user = this.auth.user();
          this.loadHistory(); // Reload history anytime user auth changes
      });
  }

  ngOnInit() {
    this.loadHistory();
  }

  async loadHistory() {
    this.loading.set(true);
    try {
      const data = await this.historyService.getHistory();
      this.items.set(data);
    } finally {
      this.loading.set(false);
    }
  }

  onSelect(item: HistoryItem) {
    this.selectItem.emit(item);
  }

  async onDelete(id: string, event: Event) {
    event.stopPropagation();
    const updated = await this.historyService.delete(id);
    this.items.set(updated);
  }
}