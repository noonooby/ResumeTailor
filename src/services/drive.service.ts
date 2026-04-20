import { Injectable, signal } from '@angular/core';

declare var google: any;

export interface DriveState {
  isSignedIn: boolean;
  userEmail: string | null;
  folders: {
    root: string | null;
    resumes: string | null;
    templates: string | null;
  };
  isReady: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class DriveService {
  state = signal<DriveState>({
    isSignedIn: false,
    userEmail: null,
    folders: { root: null, resumes: null, templates: null },
    isReady: false,
    error: null
  });

  private tokenClient: any;
  private accessToken: string | null = null;
  private readonly APP_FOLDER_NAME = 'ATS Resume Tailor';
  private readonly SCOPES = 'https://www.googleapis.com/auth/drive.file';
  private readonly DATA_FILE_NAME = 'app_data.json';

  constructor() {}

  private waitForScripts(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        // We only strictly need google (Identity Services) now, removing gapi dependency
        if (typeof google !== 'undefined') {
          resolve();
        } else {
          attempts++;
          if (attempts > 50) { // 5 seconds timeout
             reject('Google Identity scripts failed to load. Please disable ad-blockers.');
             return;
          }
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // Initialize only OAuth client (no API key needed for GAPI client anymore)
  async initialize(clientId: string) {
    this.state.update(s => ({ ...s, error: null }));
    
    if (!clientId) {
        this.state.update(s => ({ ...s, error: 'Client ID is missing' }));
        return;
    }

    try {
      await this.waitForScripts();

      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: this.SCOPES,
        callback: async (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            this.accessToken = tokenResponse.access_token;
            this.state.update(s => ({ ...s, isSignedIn: true }));
            await this.setupFolders();
          } else {
             console.warn("Token response invalid", tokenResponse);
          }
        },
      });

      this.state.update(s => ({ ...s, isReady: true }));
    } catch (err: any) {
      console.error('Drive Init Error:', err);
      this.state.update(s => ({ ...s, error: typeof err === 'string' ? err : 'Initialization failed. Check Client ID.' }));
      throw err;
    }
  }

  signIn() {
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        alert('System not initialized. Please click "Initialize" first.');
    }
  }

  signOut() {
    if (this.accessToken) {
        google.accounts.oauth2.revoke(this.accessToken);
        this.accessToken = null;
    }
    this.state.update(s => ({
      isSignedIn: false,
      userEmail: null,
      folders: { root: null, resumes: null, templates: null },
      isReady: s.isReady, // Keep readiness
      error: null
    }));
  }

  // --- Helper to make authenticated requests ---
  private async fetchDrive(endpoint: string, options: RequestInit = {}): Promise<any> {
      if (!this.accessToken) throw new Error("No access token");
      
      const headers = {
          'Authorization': `Bearer ${this.accessToken}`,
          ...options.headers
      };

      const res = await fetch(`https://www.googleapis.com/drive/v3/${endpoint}`, {
          ...options,
          headers
      });

      if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
          throw new Error(err.error?.message || 'Drive API Error');
      }

      // Handle empty responses (like 204 No Content)
      const text = await res.text();
      return text ? JSON.parse(text) : null;
  }

  /**
   * Ensures the folder structure exists:
   * ATS Resume Tailor/
   *   |- Resumes/
   *   |- Templates/
   */
  private async setupFolders() {
    try {
      // 1. Root
      let rootId = await this.findFile(this.APP_FOLDER_NAME, 'root', 'application/vnd.google-apps.folder');
      if (!rootId) {
        rootId = await this.createFolder(this.APP_FOLDER_NAME, 'root');
      }

      // 2. Subfolders
      let resumesId = await this.findFile('Resumes', rootId, 'application/vnd.google-apps.folder');
      if (!resumesId) resumesId = await this.createFolder('Resumes', rootId);

      let templatesId = await this.findFile('Templates', rootId, 'application/vnd.google-apps.folder');
      if (!templatesId) templatesId = await this.createFolder('Templates', rootId);

      this.state.update(s => ({
        ...s,
        folders: { root: rootId!, resumes: resumesId!, templates: templatesId! }
      }));
      
    } catch (e) {
      console.error('Error setting up folders', e);
      this.state.update(s => ({ ...s, error: 'Failed to set up Drive folders.' }));
    }
  }

  /**
   * Syncs generic app data (History, Settings, Defaults) to a JSON file in Drive
   */
  async syncAppData(data: any): Promise<void> {
    if (!this.state().isSignedIn || !this.state().folders.root) return;

    try {
      const fileId = await this.findFile(this.DATA_FILE_NAME, this.state().folders.root!);
      const content = JSON.stringify(data, null, 2);
      
      if (fileId) {
        await this.updateFile(fileId, content, 'application/json');
      } else {
        await this.createFile(this.DATA_FILE_NAME, this.state().folders.root!, content, 'application/json');
      }
    } catch (e) {
      console.error('Failed to sync app data', e);
    }
  }

  async loadAppData<T>(): Promise<T | null> {
    if (!this.state().isSignedIn || !this.state().folders.root) return null;
    
    try {
      const fileId = await this.findFile(this.DATA_FILE_NAME, this.state().folders.root!);
      if (!fileId) return null;
      
      // Use raw fetch for media content
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('Failed to load app data', e);
      return null;
    }
  }

  async saveResumeFile(name: string, blob: Blob) {
    if (!this.state().isSignedIn || !this.state().folders.resumes) return;
    
    // Check if exists to replace
    const existingId = await this.findFile(name, this.state().folders.resumes);
    if (existingId) {
      await this.updateFileBlob(existingId, blob);
    } else {
      await this.createFileBlob(name, this.state().folders.resumes, blob);
    }
  }

  // --- Low Level Helpers using Fetch ---

  private async findFile(name: string, parentId: string, mimeType?: string): Promise<string | null> {
    let query = `name = '${name}' and '${parentId}' in parents and trash = false`;
    if (mimeType) query += ` and mimeType = '${mimeType}'`;
    
    const res = await this.fetchDrive(`files?q=${encodeURIComponent(query)}&fields=files(id,name)`);
    return res.files && res.files.length > 0 ? res.files[0].id : null;
  }

  private async createFolder(name: string, parentId: string = 'root'): Promise<string> {
    const body = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };
    
    const res = await this.fetchDrive('files?fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.id;
  }

  private async createFile(name: string, parentId: string, content: string, mimeType: string) {
     await this.createFileBlob(name, parentId, new Blob([content], {type: mimeType}));
  }

  private async updateFile(fileId: string, content: string, mimeType: string) {
     await this.updateFileBlob(fileId, new Blob([content], {type: mimeType}));
  }

  private async createFileBlob(name: string, parentId: string, blob: Blob) {
    const metadata = {
      name: name,
      parents: [parentId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
      body: form
    });
  }

  private async updateFileBlob(fileId: string, blob: Blob) {
    // Simple upload for updates
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': blob.type 
      },
      body: blob
    });
  }
}