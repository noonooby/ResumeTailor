import { Injectable, inject, signal } from '@angular/core';
import * as mammoth from 'mammoth/mammoth.browser';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { Document as DocxDocument, Paragraph, TextRun, Packer, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import { safeGet, safeSet, safeSetMany, safeDel } from './idb-wrapper';
import { OptimizationResult, PersonalInfo } from '../types';
import { AuthService, db } from './auth.service';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class DocProcessorService {
  private readonly TEMPLATE_KEY = 'master_resume_template';
  private readonly TEMPLATE_NAME_KEY = 'master_resume_name';
  private readonly MASTER_STYLE_KEY = 'master_resume_style';
  
  private auth = inject(AuthService);
  public templateChange = signal<number>(0);

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async clearLocalTemplate(): Promise<void> {
      await safeDel(this.TEMPLATE_KEY);
      await safeDel(this.TEMPLATE_NAME_KEY);
      localStorage.removeItem(this.MASTER_STYLE_KEY);
      this.templateChange.update(v => v + 1);
  }

  async clearTemplate(): Promise<void> {
      await this.clearLocalTemplate();
      
      const user = this.auth.user();
      if (user) {
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'documents', 'masterTemplate'));
          } catch(e) {
            console.error('Failed to clear template from Firestore', e);
          }
      }
  }

  async extractText(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.messages && result.messages.length > 0) {
        console.warn('Mammoth messages:', result.messages);
      }
      return result.value;
    } catch (error: any) {
      console.error('Text extraction failed', error);
      throw new Error(`Failed to read DOCX file: ${error.message || 'Unknown error'}`);
    }
  }

  async saveTemplate(file: File): Promise<void> {
    try {
      const buffer = await file.arrayBuffer();
      
      let retries = 3;
      while (retries > 0) {
          try {
              await safeSetMany([
                  [this.TEMPLATE_KEY, buffer],
                  [this.TEMPLATE_NAME_KEY, file.name]
              ]);
              break; // Success
          } catch (idbError: any) {
              console.warn(`IndexedDB setMany failed (retries left: ${retries - 1})`, idbError);
              retries--;
              if (retries === 0) {
                  throw idbError;
              }
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 500));
          }
      }
      
      // If no master style exists, extract it from this first template
      const existingStyle = localStorage.getItem(this.MASTER_STYLE_KEY);
      if (!existingStyle) {
          await this.extractAndSaveMasterStyle(buffer);
      }

      // Sync to Firestore if authenticated
      const user = this.auth.user();
      if (user) {
          try {
             const base64Data = this.arrayBufferToBase64(buffer);
             const styleStr = localStorage.getItem(this.MASTER_STYLE_KEY);
             const masterStyle = styleStr ? JSON.parse(styleStr) : null;
             
             await setDoc(doc(db, 'users', user.uid, 'documents', 'masterTemplate'), {
                 userId: user.uid,
                 templateName: file.name,
                 templateData: base64Data,
                 updatedAt: serverTimestamp(),
                 masterStyle: masterStyle
             });
          } catch(e) {
             console.error('Failed to sync template to Firestore', e);
          }
      }
    } catch (error: any) {
      console.error('Save template failed', error);
      throw new Error(`Failed to save template: ${error.message || 'Unknown error'}`);
    }
  }

  async getTemplateName(): Promise<string | undefined> {
    try {
        const dbName = await safeGet<string>(this.TEMPLATE_NAME_KEY);
        if (dbName) return dbName;
    } catch (e) {
        console.warn('Failed to get template name from IndexedDB', e);
    }
    return undefined;
  }

  async syncTemplateFromCloud(): Promise<boolean> {
     const user = this.auth.user();
     if (!user) return false;
     
     try {
         const snap = await getDoc(doc(db, 'users', user.uid, 'documents', 'masterTemplate'));
         if (snap.exists() && snap.data()['templateData']) {
             const data = snap.data();
             const buffer = this.base64ToArrayBuffer(data['templateData']);
             await safeSetMany([
                 [this.TEMPLATE_KEY, buffer],
                 [this.TEMPLATE_NAME_KEY, data['templateName'] || 'Resume_Template.docx']
             ]);
             if (data['masterStyle']) {
                 localStorage.setItem(this.MASTER_STYLE_KEY, JSON.stringify(data['masterStyle']));
             }
             if (data['sectionOrder']) {
                 localStorage.setItem('resume_section_order', JSON.stringify(data['sectionOrder']));
             }
             this.templateChange.update(v => v + 1);
             return true;
         } else {
             // Cloud is empty. If we have local data, let's push it TO the cloud
             const localBase64 = await this.getTemplateBuffer().then(buf => buf ? this.arrayBufferToBase64(buf) : null);
             const localName = await this.getTemplateName();
             if (localBase64 && localName) {
                 const styleStr = localStorage.getItem(this.MASTER_STYLE_KEY);
                 const masterStyle = styleStr ? JSON.parse(styleStr) : null;
                 const sectionOrderStr = localStorage.getItem('resume_section_order');
                 const sectionOrder = sectionOrderStr ? JSON.parse(sectionOrderStr) : null;
                 await setDoc(doc(db, 'users', user.uid, 'documents', 'masterTemplate'), {
                     userId: user.uid,
                     templateName: localName,
                     templateData: localBase64,
                     updatedAt: serverTimestamp(),
                     masterStyle: masterStyle,
                     sectionOrder: sectionOrder
                 });
                 return true;
             }
         }
     } catch (e) {
         console.error('Failed to sync template to/from cloud', e);
     }
     return false;
  }

  async getTemplateBuffer(): Promise<ArrayBuffer | undefined> {
    try {
        return await safeGet<ArrayBuffer>(this.TEMPLATE_KEY);
    } catch (e) {
        console.warn('Failed to get template buffer from IndexedDB', e);
        return undefined;
    }
  }

  async getStoredTemplateText(): Promise<string | null> {
    try {
        const buffer = await safeGet<ArrayBuffer>(this.TEMPLATE_KEY);
        if (buffer) {
            return this.extractText(buffer);
        }
    } catch (e) {
        console.warn('Failed to get template buffer from IndexedDB', e);
    }
    return null;
  }

  async extractAndSaveMasterStyle(arrayBuffer: ArrayBuffer): Promise<void> {
    try {
      const zip = new PizZip(arrayBuffer);
      const docXml = zip.file("word/document.xml")?.asText();
      const stylesXml = zip.file("word/styles.xml")?.asText();
      
      if (!docXml) return;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(docXml, "application/xml");
      const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
      
      // Default values
      let fontFamily = "Arial";
      let fontSizePt = 11;
      let margins = { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 }; // 1 inch in mm
      let spacing = { before: "0", after: "200", line: "276", lineRule: "auto" };

      // 0. Extract Theme Fonts
      const themeXml = zip.file("word/theme/theme1.xml")?.asText();
      const themeFonts: Record<string, string> = {};
      if (themeXml) {
          const themeDoc = parser.parseFromString(themeXml, "application/xml");
          const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
          const fontScheme = themeDoc.getElementsByTagNameNS(a, "fontScheme")[0];
          if (fontScheme) {
              const majorFont = fontScheme.getElementsByTagNameNS(a, "majorFont")[0];
              if (majorFont) {
                  const latin = majorFont.getElementsByTagNameNS(a, "latin")[0];
                  if (latin && latin.getAttribute("typeface")) themeFonts['majorHAnsi'] = latin.getAttribute("typeface")!;
              }
              const minorFont = fontScheme.getElementsByTagNameNS(a, "minorFont")[0];
              if (minorFont) {
                  const latin = minorFont.getElementsByTagNameNS(a, "latin")[0];
                  if (latin && latin.getAttribute("typeface")) themeFonts['minorHAnsi'] = latin.getAttribute("typeface")!;
              }
          }
      }

      // 1. Extract Margins from document.xml
      const sectPr = xmlDoc.getElementsByTagNameNS(w, "sectPr")[0];
      if (sectPr) {
        const pgMar = sectPr.getElementsByTagNameNS(w, "pgMar")[0];
        if (pgMar) {
          const t = pgMar.getAttributeNS(w, "top");
          const r = pgMar.getAttributeNS(w, "right");
          const b = pgMar.getAttributeNS(w, "bottom");
          const l = pgMar.getAttributeNS(w, "left");
          if (t) margins.top = Math.round(parseInt(t) / 56.6929 * 10) / 10;
          if (r) margins.right = Math.round(parseInt(r) / 56.6929 * 10) / 10;
          if (b) margins.bottom = Math.round(parseInt(b) / 56.6929 * 10) / 10;
          if (l) margins.left = Math.round(parseInt(l) / 56.6929 * 10) / 10;
        }
      }

      // 2. Extract Font and Spacing from styles.xml (docDefaults & Normal style)
      if (stylesXml) {
        const xmlStyles = parser.parseFromString(stylesXml, "application/xml");
        
        // A. docDefaults
        const docDefaults = xmlStyles.getElementsByTagNameNS(w, "docDefaults")[0];
        if (docDefaults) {
          const rPr = docDefaults.getElementsByTagNameNS(w, "rPr")[0];
          if (rPr) {
            const rFonts = rPr.getElementsByTagNameNS(w, "rFonts")[0];
            if (rFonts) {
                let f = rFonts.getAttributeNS(w, "ascii");
                if (!f) {
                    const theme = rFonts.getAttributeNS(w, "asciiTheme");
                    if (theme && themeFonts[theme]) f = themeFonts[theme];
                }
                if (f) fontFamily = f;
            }
            const sz = rPr.getElementsByTagNameNS(w, "sz")[0];
            if (sz && sz.getAttributeNS(w, "val")) fontSizePt = parseInt(sz.getAttributeNS(w, "val")!) / 2;
          }
          const pPr = docDefaults.getElementsByTagNameNS(w, "pPr")[0];
          if (pPr) {
            const sp = pPr.getElementsByTagNameNS(w, "spacing")[0];
            if (sp) {
              spacing.before = sp.getAttributeNS(w, "before") || spacing.before;
              spacing.after = sp.getAttributeNS(w, "after") || spacing.after;
              spacing.line = sp.getAttributeNS(w, "line") || spacing.line;
              spacing.lineRule = sp.getAttributeNS(w, "lineRule") || spacing.lineRule;
            }
          }
        }

        // B. Normal style (overrides docDefaults)
        const styles = Array.from(xmlStyles.getElementsByTagNameNS(w, "style"));
        const normalStyle = styles.find(s => 
            s.getAttributeNS(w, "styleId") === "Normal" || 
            (s.getAttributeNS(w, "type") === "paragraph" && s.getAttributeNS(w, "default") === "1")
        );
        
        if (normalStyle) {
          const rPr = normalStyle.getElementsByTagNameNS(w, "rPr")[0];
          if (rPr) {
            const rFonts = rPr.getElementsByTagNameNS(w, "rFonts")[0];
            if (rFonts) {
                let f = rFonts.getAttributeNS(w, "ascii");
                if (!f) {
                    const theme = rFonts.getAttributeNS(w, "asciiTheme");
                    if (theme && themeFonts[theme]) f = themeFonts[theme];
                }
                if (f) fontFamily = f;
            }
            const sz = rPr.getElementsByTagNameNS(w, "sz")[0];
            if (sz && sz.getAttributeNS(w, "val")) fontSizePt = parseInt(sz.getAttributeNS(w, "val")!) / 2;
          }
          const pPr = normalStyle.getElementsByTagNameNS(w, "pPr")[0];
          if (pPr) {
            const sp = pPr.getElementsByTagNameNS(w, "spacing")[0];
            if (sp) {
              spacing.before = sp.getAttributeNS(w, "before") || spacing.before;
              spacing.after = sp.getAttributeNS(w, "after") || spacing.after;
              spacing.line = sp.getAttributeNS(w, "line") || spacing.line;
              spacing.lineRule = sp.getAttributeNS(w, "lineRule") || spacing.lineRule;
            }
          }
        }
      }

      // 3. Frequency analysis of direct formatting in document.xml (overrides styles.xml)
      const fontCounts: Record<string, number> = {};
      const sizeCounts: Record<number, number> = {};
      
      const runs = Array.from(xmlDoc.getElementsByTagNameNS(w, "r"));
      for (const r of runs) {
          const t = r.getElementsByTagNameNS(w, "t")[0];
          if (t && t.textContent && t.textContent.trim().length > 0) {
              const textLength = t.textContent.trim().length;
              const rPr = r.getElementsByTagNameNS(w, "rPr")[0];
              if (rPr) {
                  const rFonts = rPr.getElementsByTagNameNS(w, "rFonts")[0];
                  if (rFonts) {
                      let f = rFonts.getAttributeNS(w, "ascii");
                      if (!f) {
                          const theme = rFonts.getAttributeNS(w, "asciiTheme");
                          if (theme && themeFonts[theme]) f = themeFonts[theme];
                      }
                      if (f) {
                          fontCounts[f] = (fontCounts[f] || 0) + textLength;
                      }
                  }
                  const sz = rPr.getElementsByTagNameNS(w, "sz")[0];
                  if (sz && sz.getAttributeNS(w, "val")) {
                      const s = parseInt(sz.getAttributeNS(w, "val")!) / 2;
                      sizeCounts[s] = (sizeCounts[s] || 0) + textLength;
                  }
              }
          }
      }
      
      // Use the most frequent font/size (weighted by text length) if it's significant (>50 chars)
      let maxFontCount = 0;
      for (const [font, count] of Object.entries(fontCounts)) {
          if (count > maxFontCount && count > 50) {
              maxFontCount = count;
              fontFamily = font;
          }
      }
      
      let maxSizeCount = 0;
      for (const [size, count] of Object.entries(sizeCounts)) {
          if (count > maxSizeCount && count > 50) {
              maxSizeCount = count;
              fontSizePt = parseFloat(size);
          }
      }

      const masterStyle = { fontFamily, fontSizePt, margins, spacing };
      localStorage.setItem(this.MASTER_STYLE_KEY, JSON.stringify(masterStyle));
      console.log('Master style extracted and saved:', masterStyle);
    } catch (e) {
      console.error('Failed to extract master style', e);
    }
  }

  async getMasterStyleAndEnsure(): Promise<any> {
    let style = this.getMasterStyle();
    if (!style) {
        try {
            const buffer = await safeGet<ArrayBuffer>(this.TEMPLATE_KEY);
            if (buffer) {
                await this.extractAndSaveMasterStyle(buffer);
                style = this.getMasterStyle();
            }
        } catch (e) {}
    }
    return style;
  }

  getMasterStyle(): any | null {
    const saved = localStorage.getItem(this.MASTER_STYLE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async updateMasterStyle(updates: any) {
    const current = this.getMasterStyle() || {};
    const updated = { ...current, ...updates };
    localStorage.setItem(this.MASTER_STYLE_KEY, JSON.stringify(updated));
    console.log('Update master style:', updated);
    
    // Sync style updates back to Firestore
    const user = this.auth.user();
    if (user) {
        try {
            await setDoc(doc(db, 'users', user.uid, 'documents', 'masterTemplate'), {
                userId: user.uid,
                masterStyle: updated,
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch(e) {
            console.error('Failed to sync updated master style to cloud', e);
        }
    }
  }

  extractRawFormatDetails(arrayBuffer: ArrayBuffer): any {
    try {
        const zip = new PizZip(arrayBuffer);
        const docXml = zip.file("word/document.xml")?.asText();
        const stylesXml = zip.file("word/styles.xml")?.asText();
        const themeXml = zip.file("word/theme/theme1.xml")?.asText();

        const parser = new DOMParser();
        const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        const a = "http://schemas.openxmlformats.org/drawingml/2006/main";

        const details: any = {
            pageSetup: {},
            themeFonts: {},
            defaultStyles: {},
            namedStyles: {},
            documentStructure: []
        };

        // Parse Theme Fonts
        if (themeXml) {
            const xmlTheme = parser.parseFromString(themeXml, "application/xml");
            const fontScheme = xmlTheme.getElementsByTagNameNS(a, "fontScheme")[0];
            if (fontScheme) {
                ['majorFont', 'minorFont'].forEach(type => {
                    const fontNode = fontScheme.getElementsByTagNameNS(a, type)[0];
                    if (fontNode) {
                        const latin = fontNode.getElementsByTagNameNS(a, "latin")[0];
                        if (latin) details.themeFonts[type] = latin.getAttribute("typeface");
                    }
                });
            }
        }

        // Parse Styles
        if (stylesXml) {
            const xmlStyles = parser.parseFromString(stylesXml, "application/xml");
            
            // docDefaults
            const docDefaults = xmlStyles.getElementsByTagNameNS(w, "docDefaults")[0];
            if (docDefaults) {
                const rPr = docDefaults.getElementsByTagNameNS(w, "rPr")[0];
                if (rPr) details.defaultStyles.runProperties = this.parseRPr(rPr, w);
                const pPr = docDefaults.getElementsByTagNameNS(w, "pPr")[0];
                if (pPr) details.defaultStyles.paragraphProperties = this.parsePPr(pPr, w);
            }

            // named styles
            const styles = Array.from(xmlStyles.getElementsByTagNameNS(w, "style"));
            styles.forEach(s => {
                const styleId = s.getAttributeNS(w, "styleId");
                if (styleId) {
                    const styleDetails: any = {
                        type: s.getAttributeNS(w, "type"),
                        name: s.getElementsByTagNameNS(w, "name")[0]?.getAttributeNS(w, "val")
                    };
                    const rPr = s.getElementsByTagNameNS(w, "rPr")[0];
                    if (rPr) styleDetails.runProperties = this.parseRPr(rPr, w);
                    const pPr = s.getElementsByTagNameNS(w, "pPr")[0];
                    if (pPr) styleDetails.paragraphProperties = this.parsePPr(pPr, w);
                    
                    details.namedStyles[styleId] = styleDetails;
                }
            });
        }

        // Parse Document Structure
        if (docXml) {
            const xmlDoc = parser.parseFromString(docXml, "application/xml");
            
            // page setup
            const sectPr = xmlDoc.getElementsByTagNameNS(w, "sectPr")[0];
            if (sectPr) {
                const pgMar = sectPr.getElementsByTagNameNS(w, "pgMar")[0];
                if (pgMar) {
                    details.pageSetup.margins = {
                        top: pgMar.getAttributeNS(w, "top"),
                        right: pgMar.getAttributeNS(w, "right"),
                        bottom: pgMar.getAttributeNS(w, "bottom"),
                        left: pgMar.getAttributeNS(w, "left"),
                        header: pgMar.getAttributeNS(w, "header"),
                        footer: pgMar.getAttributeNS(w, "footer"),
                        gutter: pgMar.getAttributeNS(w, "gutter")
                    };
                }
                const pgSz = sectPr.getElementsByTagNameNS(w, "pgSz")[0];
                if (pgSz) {
                    details.pageSetup.pageSize = {
                        w: pgSz.getAttributeNS(w, "w"),
                        h: pgSz.getAttributeNS(w, "h"),
                        orient: pgSz.getAttributeNS(w, "orient")
                    };
                }
            }

            // paragraphs
            const paragraphs = Array.from(xmlDoc.getElementsByTagNameNS(w, "p"));
            paragraphs.forEach(p => {
                const pDetails: any = { type: 'paragraph', runs: [] };
                const pPr = p.getElementsByTagNameNS(w, "pPr")[0];
                if (pPr) {
                    pDetails.format = this.parsePPr(pPr, w);
                }
                const runs = Array.from(p.getElementsByTagNameNS(w, "r"));
                runs.forEach(r => {
                    const rDetails: any = { type: 'run', text: '' };
                    const rPr = r.getElementsByTagNameNS(w, "rPr")[0];
                    if (rPr) {
                        rDetails.format = this.parseRPr(rPr, w);
                    }
                    const t = r.getElementsByTagNameNS(w, "t")[0];
                    if (t) rDetails.text = t.textContent;
                    
                    if (rDetails.text || rDetails.format) {
                        pDetails.runs.push(rDetails);
                    }
                });
                if (pDetails.runs.length > 0 || pDetails.format) {
                    details.documentStructure.push(pDetails);
                }
            });
        }

        return details;
    } catch (e) {
        console.error("Failed to extract raw format details:", e);
        return { error: "Failed to extract raw format details." };
    }
  }

  private parsePPr(pPr: Element, w: string): any {
      const format: any = {};
      const spacing = pPr.getElementsByTagNameNS(w, "spacing")[0];
      if (spacing) {
          format.spacing = {
              before: spacing.getAttributeNS(w, "before"),
              after: spacing.getAttributeNS(w, "after"),
              line: spacing.getAttributeNS(w, "line"),
              lineRule: spacing.getAttributeNS(w, "lineRule")
          };
      }
      const ind = pPr.getElementsByTagNameNS(w, "ind")[0];
      if (ind) {
          format.indent = {
              left: ind.getAttributeNS(w, "left"),
              right: ind.getAttributeNS(w, "right"),
              hanging: ind.getAttributeNS(w, "hanging"),
              firstLine: ind.getAttributeNS(w, "firstLine")
          };
      }
      const jc = pPr.getElementsByTagNameNS(w, "jc")[0];
      if (jc) format.justification = jc.getAttributeNS(w, "val");
      const pStyle = pPr.getElementsByTagNameNS(w, "pStyle")[0];
      if (pStyle) format.styleId = pStyle.getAttributeNS(w, "val");
      const numPr = pPr.getElementsByTagNameNS(w, "numPr")[0];
      if (numPr) {
          format.numbering = {
              ilvl: numPr.getElementsByTagNameNS(w, "ilvl")[0]?.getAttributeNS(w, "val"),
              numId: numPr.getElementsByTagNameNS(w, "numId")[0]?.getAttributeNS(w, "val")
          };
      }
      return format;
  }

  private parseRPr(rPr: Element, w: string): any {
      const format: any = {};
      const rFonts = rPr.getElementsByTagNameNS(w, "rFonts")[0];
      if (rFonts) {
          format.fonts = {
              ascii: rFonts.getAttributeNS(w, "ascii"),
              hAnsi: rFonts.getAttributeNS(w, "hAnsi"),
              eastAsia: rFonts.getAttributeNS(w, "eastAsia"),
              cs: rFonts.getAttributeNS(w, "cs"),
              asciiTheme: rFonts.getAttributeNS(w, "asciiTheme"),
              hAnsiTheme: rFonts.getAttributeNS(w, "hAnsiTheme")
          };
      }
      const sz = rPr.getElementsByTagNameNS(w, "sz")[0];
      if (sz) format.size = sz.getAttributeNS(w, "val");
      const szCs = rPr.getElementsByTagNameNS(w, "szCs")[0];
      if (szCs) format.sizeComplexScript = szCs.getAttributeNS(w, "val");
      
      const b = rPr.getElementsByTagNameNS(w, "b");
      if (b.length > 0) format.bold = b[0].getAttributeNS(w, "val") !== "0" && b[0].getAttributeNS(w, "val") !== "false";
      
      const i = rPr.getElementsByTagNameNS(w, "i");
      if (i.length > 0) format.italic = i[0].getAttributeNS(w, "val") !== "0" && i[0].getAttributeNS(w, "val") !== "false";
      
      const u = rPr.getElementsByTagNameNS(w, "u")[0];
      if (u) format.underline = u.getAttributeNS(w, "val");
      
      const color = rPr.getElementsByTagNameNS(w, "color")[0];
      if (color) format.color = color.getAttributeNS(w, "val");
      
      const caps = rPr.getElementsByTagNameNS(w, "caps");
      if (caps.length > 0) format.caps = true;
      
      const smallCaps = rPr.getElementsByTagNameNS(w, "smallCaps");
      if (smallCaps.length > 0) format.smallCaps = true;
      
      const strike = rPr.getElementsByTagNameNS(w, "strike");
      if (strike.length > 0) format.strike = true;

      return format;
  }

  async generateDocWithTemplate(
    data: OptimizationResult, 
    sectionTitles: {[key: string]: string}
  ): Promise<Blob | null> {
    const templateBuffer = await safeGet<ArrayBuffer>(this.TEMPLATE_KEY);
    if (!templateBuffer) {
        return null; // Let the caller complain that template is missing
    }

    try {
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      const text = doc.getFullText();

      // If the template uses {{mustache}} tags, use standard render
      if (text.match(/\{[^}]+\}/)) {
        doc.render(data);
        return doc.getZip().generate({
          type: "blob",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      } else {
        // Otherwise, use smart DOM injection to replace sections by header detection
        const masterStyle = this.getMasterStyle();
        return this.smartDomInjection(zip, data, sectionTitles, masterStyle);
      }
    } catch (error: any) {
      console.error('Template rendering failed', error);
      if (error.properties && error.properties.errors) {
        const errorMessages = error.properties.errors.map((e: any) => e.message).join('\n');
        throw new Error(`Template Error: ${errorMessages}`);
      }
      throw new Error(`Failed to generate document: ${error.message || 'Unknown error'}`);
    }
  }

  private cleanText(text: string): string {
      if (!text) return '';
      // Remove **bold**, __italic__, and bullet points
      return text.replace(/\*\*/g, '').replace(/__/g, '').replace(/\*/g, '').replace(/•/g, '').trim();
  }

  private formatBulletPoint(point: string): { key: string, val: string, hasKey: boolean } {
    if (!point) return { key: '', val: '', hasKey: false };
    const separator = ' - ';
    const idx = point.indexOf(separator);
    if (idx > -1) {
        let key = point.substring(0, idx);
        const val = point.substring(idx); 
        key = this.cleanText(key);
        const cleanVal = this.cleanText(val);
        return { key, val: cleanVal, hasKey: true };
    }
    return { key: this.cleanText(point), val: '', hasKey: false };
  }

  private applyStylesToPara(doc: Document, p: Element, ns: string, styles: any) {
      let pPr = p.getElementsByTagNameNS(ns, "pPr")[0];
      if (!pPr) {
          pPr = doc.createElementNS(ns, "pPr");
          if (p.firstChild) p.insertBefore(pPr, p.firstChild); else p.appendChild(pPr);
      }
      
      if (styles.spacing) {
          let sp = pPr.getElementsByTagNameNS(ns, "spacing")[0];
          if (!sp) {
              sp = doc.createElementNS(ns, "spacing");
              pPr.appendChild(sp);
          }
          sp.setAttributeNS(ns, "before", styles.spacing.before);
          sp.setAttributeNS(ns, "after", styles.spacing.after);
          sp.setAttributeNS(ns, "line", styles.spacing.line);
          sp.setAttributeNS(ns, "lineRule", styles.spacing.lineRule);
      }
      
      // Ensure justification if not already set
      if (pPr.getElementsByTagNameNS(ns, "jc").length === 0) {
          const jc = doc.createElementNS(ns, "jc");
          jc.setAttributeNS(ns, "val", "both");
          pPr.appendChild(jc);
      }
  }

    private smartDomInjection(
    zip: PizZip, 
    data: OptimizationResult, 
    sectionTitles: {[key: string]: string}, 
    masterStyle?: any
  ): Blob {
    const xmlString = zip.file("word/document.xml")?.asText();
    if (!xmlString) throw new Error("Invalid DOCX structure: missing word/document.xml");

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        
        // CHECK FOR PARSER ERRORS
        const parserError = xmlDoc.getElementsByTagName("parsererror");
        if (parserError.length > 0) {
            throw new Error("XML Parsing Error: " + parserError[0].textContent);
        }
        
        // APPLY STYLES (Margins & Base Font)
        let fallbackStyleNode: Node | null = null;
        if (masterStyle) {
            // 1. Margins (sectPr)
            const body = xmlDoc.getElementsByTagNameNS(w, "body")[0];
            let sectPr = body.getElementsByTagNameNS(w, "sectPr")[0];
            if (sectPr && masterStyle.margins) {
                let pgMar = sectPr.getElementsByTagNameNS(w, "pgMar")[0];
                if (!pgMar) {
                    pgMar = xmlDoc.createElementNS(w, "pgMar");
                    sectPr.appendChild(pgMar);
                }
                pgMar.setAttributeNS(w, "top", Math.round(masterStyle.margins.top * 56.6929).toString());
                pgMar.setAttributeNS(w, "right", Math.round(masterStyle.margins.right * 56.6929).toString());
                pgMar.setAttributeNS(w, "bottom", Math.round(masterStyle.margins.bottom * 56.6929).toString());
                pgMar.setAttributeNS(w, "left", Math.round(masterStyle.margins.left * 56.6929).toString());
                pgMar.setAttributeNS(w, "gutter", "0");
            }
            
            // 2. Global Spacing Update
            if (masterStyle.spacing) {
                const allParas = Array.from(xmlDoc.getElementsByTagNameNS(w, "p"));
                allParas.forEach(p => this.applyStylesToPara(xmlDoc, p, w, masterStyle));
            }
            
            // 3. Global Font/Size Update (Best Effort)
            const allRuns = Array.from(xmlDoc.getElementsByTagNameNS(w, "r"));
            allRuns.forEach(r => {
                let rPr = r.getElementsByTagNameNS(w, "rPr")[0];
                if (!rPr) {
                    rPr = xmlDoc.createElementNS(w, "rPr");
                    r.insertBefore(rPr, r.firstChild);
                }
                
                // Update Font
                if (masterStyle.fontFamily) {
                    let rFonts = rPr.getElementsByTagNameNS(w, "rFonts")[0];
                    if (!rFonts) {
                        rFonts = xmlDoc.createElementNS(w, "rFonts");
                        rPr.appendChild(rFonts);
                    }
                    rFonts.setAttributeNS(w, "ascii", masterStyle.fontFamily);
                    rFonts.setAttributeNS(w, "hAnsi", masterStyle.fontFamily);
                    rFonts.setAttributeNS(w, "cs", masterStyle.fontFamily);
                }
                
                // Update Size
                if (masterStyle.fontSizePt) {
                    let sz = rPr.getElementsByTagNameNS(w, "sz")[0];
                    if (!sz) {
                        sz = xmlDoc.createElementNS(w, "sz");
                        rPr.appendChild(sz);
                    }
                    sz.setAttributeNS(w, "val", (masterStyle.fontSizePt * 2).toString());
                    
                    let szCs = rPr.getElementsByTagNameNS(w, "szCs")[0];
                    if (!szCs) {
                        szCs = xmlDoc.createElementNS(w, "szCs");
                        rPr.appendChild(szCs);
                    }
                    szCs.setAttributeNS(w, "val", (masterStyle.fontSizePt * 2).toString());
                }
            });

            // Create Fallback Style Node for new paragraphs
            fallbackStyleNode = xmlDoc.createElementNS(w, "rPr");
            if (masterStyle.fontFamily) {
                const rFonts = xmlDoc.createElementNS(w, "rFonts");
                rFonts.setAttributeNS(w, "ascii", masterStyle.fontFamily);
                rFonts.setAttributeNS(w, "hAnsi", masterStyle.fontFamily);
                rFonts.setAttributeNS(w, "cs", masterStyle.fontFamily);
                fallbackStyleNode.appendChild(rFonts);
            }
            
            if (masterStyle.fontSizePt) {
                const sz = xmlDoc.createElementNS(w, "sz");
                sz.setAttributeNS(w, "val", (masterStyle.fontSizePt * 2).toString());
                fallbackStyleNode.appendChild(sz);

                const szCs = xmlDoc.createElementNS(w, "szCs");
                szCs.setAttributeNS(w, "val", (masterStyle.fontSizePt * 2).toString());
                fallbackStyleNode.appendChild(szCs);
            }
        }

        const paragraphs = Array.from(xmlDoc.getElementsByTagNameNS(w, "p"));
        
        // Expanded Header Detection
        const summaryHeaders = [
            "Professional Summary", "Summary", "Profile", "About Me", "Career Profile", "Executive Summary", 
            "Objective", "Career Objective", "Professional Profile"
        ];
        const expHeaders = [
            "Experience", "Work History", "Employment", "Professional Experience", "Career History", 
            "Work Experience", "Professional Background", "Employment History"
        ];
        const eduHeaders = [
            "Education", "Academic Background", "Academic History", "Education & Credentials", "Degrees"
        ];
        const skillHeaders = [
            "Skills", "Technical Skills", "Competencies", "Core Competencies", "Key Skills", 
            "Areas of Expertise", "Technologies", "Technical Proficiencies"
        ];
        const certHeaders = [
            "Certifications", "Licenses", "Awards", "Certifications & Licenses", "Professional Development", 
            "Credentials", "Training"
        ];

        const summaryIdx = this.findIndex(paragraphs, [sectionTitles['summary'], ...summaryHeaders]);
        const expIdx = this.findIndex(paragraphs, [sectionTitles['experience'], ...expHeaders]);
        const eduIdx = this.findIndex(paragraphs, [sectionTitles['education'], ...eduHeaders]);
        const skillIdx = this.findIndex(paragraphs, [sectionTitles['skills'], ...skillHeaders]);
        const certIdx = this.findIndex(paragraphs, [sectionTitles['certifications'], ...certHeaders]);

        console.log('Section Indices Found:', { summaryIdx, expIdx, eduIdx, skillIdx, certIdx });

        const otherIndices = [summaryIdx, expIdx, eduIdx, skillIdx, certIdx].filter(i => i !== -1);

        [summaryIdx, expIdx, eduIdx, skillIdx, certIdx].forEach(idx => {
            if (idx !== -1) {
                this.uppercasePara(xmlDoc, paragraphs[idx], w);
            }
        });

        // Summary
        if (summaryIdx !== -1) {
            const summaryEnd = this.getNextSectionIndex(summaryIdx, paragraphs.length, otherIndices);
            const runStyle = this.findFirstRunStyle(paragraphs, summaryIdx + 1, summaryEnd, w) || fallbackStyleNode;
            
            const pSum = xmlDoc.createElementNS(w, "p");
            if (masterStyle) this.applyStylesToPara(xmlDoc, pSum, w, masterStyle);
            const cleanSummary = this.cleanText(data.summary);
            this.addTextRun(xmlDoc, pSum, cleanSummary, w, undefined, undefined, runStyle); 
            this.ensureJustification(xmlDoc, pSum, w);
            
            this.replaceSectionNodes(xmlDoc, paragraphs, summaryIdx, otherIndices, [pSum]);
        }

        // Experience
        if (expIdx !== -1) {
            const endIdx = this.getNextSectionIndex(expIdx, paragraphs.length, otherIndices);
            let headerStyleNode: Node | null = null;
            let bulletStyleNode: Node | null = null;
            let bodyRunStyleNode: Node | null = this.findFirstRunStyle(paragraphs, expIdx + 1, endIdx, w) || fallbackStyleNode;

            for (let k = expIdx + 1; k < endIdx; k++) {
                const pPr = paragraphs[k].getElementsByTagNameNS(w, "pPr")[0];
                if (pPr) {
                    const bold = pPr.getElementsByTagNameNS(w, "b").length > 0;
                    if (bold && !headerStyleNode) headerStyleNode = pPr.cloneNode(true);

                    const numPr = pPr.getElementsByTagNameNS(w, "numPr").length > 0;
                    if (numPr && !bulletStyleNode) {
                        bulletStyleNode = pPr.cloneNode(true);
                    }
                }
            }

            const newNodes: Node[] = [];
            data.experience.forEach(exp => {
                const pComp = xmlDoc.createElementNS(w, "p");
                if (masterStyle) this.applyStylesToPara(xmlDoc, pComp, w, masterStyle);
                if (headerStyleNode) pComp.appendChild(headerStyleNode.cloneNode(true));

                this.ensureKeepNext(xmlDoc, pComp, w);

                const companyText = exp.company;
                this.addTextRun(xmlDoc, pComp, companyText || "", w, true, false, bodyRunStyleNode); 
                this.addTextRun(xmlDoc, pComp, ", ", w, false, false, bodyRunStyleNode); 
                this.addTextRun(xmlDoc, pComp, exp.role || exp.title || "", w, true, true, bodyRunStyleNode); 
                this.addTextRun(xmlDoc, pComp, ", ", w, false, false, bodyRunStyleNode);
                this.addTextRun(xmlDoc, pComp, exp.period || exp.duration || "", w, false, false, bodyRunStyleNode, (masterStyle?.fontSizePt || 10) * 2); 

                newNodes.push(pComp);
                
                let points = exp.achievements || (exp as any).points || [];
                if (points.length === 0 && exp.description) {
                    // If description is a string, split it by bullets or newlines
                    points = exp.description.split(/\n|•/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
                }
                points.forEach(pt => {
                     const pBull = xmlDoc.createElementNS(w, "p");
                     if (masterStyle) this.applyStylesToPara(xmlDoc, pBull, w, masterStyle);
                     if (bulletStyleNode) {
                         const styleClone = bulletStyleNode.cloneNode(true) as Element;
                         const bNodes = styleClone.getElementsByTagNameNS(w, "b");
                         while(bNodes.length > 0) bNodes[0].parentNode?.removeChild(bNodes[0]);
                         this.setParagraphSpacingZero(xmlDoc, styleClone, w);
                         pBull.appendChild(styleClone);
                     } else {
                         const pPr = xmlDoc.createElementNS(w, "pPr");
                         const jc = xmlDoc.createElementNS(w, "jc"); jc.setAttributeNS(w, "val", "both"); pPr.appendChild(jc);
                         this.setParagraphSpacingZero(xmlDoc, pPr, w);
                         pBull.appendChild(pPr);
                     }
                     
                     const separator = " - ";
                     const splitIdx = pt.indexOf(separator);
                     const hasNumPr = bulletStyleNode && (bulletStyleNode as Element).getElementsByTagNameNS(w, "numPr").length > 0;
                     const prefix = hasNumPr ? "" : "• ";

                     if (splitIdx > -1) {
                         let key = pt.substring(0, splitIdx);
                         const val = pt.substring(splitIdx); 
                         key = this.cleanText(key);
                         const cleanVal = this.cleanText(val);
                         this.addTextRun(xmlDoc, pBull, prefix + key, w, true, false, bodyRunStyleNode);
                         this.addTextRun(xmlDoc, pBull, cleanVal, w, false, false, bodyRunStyleNode);
                     } else {
                         const cleanPt = this.cleanText(pt);
                         this.addTextRun(xmlDoc, pBull, prefix + cleanPt, w, false, false, bodyRunStyleNode);
                     }
                     
                     this.ensureJustification(xmlDoc, pBull, w);
                     newNodes.push(pBull);
                });
            });
            
            this.replaceSectionNodes(xmlDoc, paragraphs, expIdx, otherIndices, newNodes, false, true);
        }

        // Education
        // We intentionally skip replacing Education and Certifications to preserve their exact original formatting,
        // as requested by the user. The preview will still show them based on the extracted JSON, but the DOCX will remain untouched.
        /*
        if (eduIdx !== -1 && data.education?.length > 0) {
            const eduEnd = this.getNextSectionIndex(eduIdx, paragraphs.length, otherIndices);
            const runStyle = this.findFirstRunStyle(paragraphs, eduIdx + 1, eduEnd, w) || fallbackStyleNode;

            const newNodes: Node[] = [];
            data.education.forEach(edu => {
                // Combined Institution, Location, Degree, Year
                const pEdu = xmlDoc.createElementNS(w, "p");
                if (masterStyle) this.applyStylesToPara(xmlDoc, pEdu, w, masterStyle);
                this.addTextRun(xmlDoc, pEdu, edu.institution, w, true, false, runStyle);
                if (edu.location) {
                    this.addTextRun(xmlDoc, pEdu, ", ", w, false, false, runStyle);
                    this.addTextRun(xmlDoc, pEdu, edu.location, w, false, false, runStyle);
                }
                this.addTextRun(xmlDoc, pEdu, " - ", w, false, false, runStyle);
                this.addTextRun(xmlDoc, pEdu, edu.degree, w, false, true, runStyle);
                if (edu.year) {
                    this.addTextRun(xmlDoc, pEdu, ", ", w, false, false, runStyle);
                    this.addTextRun(xmlDoc, pEdu, edu.year, w, true, false, runStyle);
                }
                this.ensureJustification(xmlDoc, pEdu, w);
                this.setParagraphSpacingZero(xmlDoc, pEdu, w);
                newNodes.push(pEdu);

                // Add details
                if (edu.details?.length > 0) {
                    const pDetails = xmlDoc.createElementNS(w, "p");
                    if (masterStyle) this.applyStylesToPara(xmlDoc, pDetails, w, masterStyle);
                    this.ensureJustification(xmlDoc, pDetails, w);
                    this.setParagraphSpacingZero(xmlDoc, pDetails, w);
                    
                    edu.details.forEach((detail, i) => {
                        const cleanDetail = this.cleanText(detail);
                        this.addTextRun(xmlDoc, pDetails, cleanDetail, w, false, false, runStyle);
                        if (i < edu.details.length - 1) {
                            this.addTextRun(xmlDoc, pDetails, " ", w, false, false, runStyle);
                        }
                    });
                    newNodes.push(pDetails);
                }
            });
            this.replaceSectionNodes(xmlDoc, paragraphs, eduIdx, otherIndices, newNodes);
        }
        */

        // Skills
        if (skillIdx !== -1) {
             this.replaceSectionNodes(xmlDoc, paragraphs, skillIdx, otherIndices, [], true);
        }
        
        // Certs
        /*
        if (certIdx !== -1 && data.certifications?.length > 0) {
             const certEnd = this.getNextSectionIndex(certIdx, paragraphs.length, otherIndices);
             const runStyle = this.findFirstRunStyle(paragraphs, certIdx + 1, certEnd, w) || fallbackStyleNode;

             const pCert = xmlDoc.createElementNS(w, "p");
             if (masterStyle) this.applyStylesToPara(xmlDoc, pCert, w, masterStyle);
             
             data.certifications.forEach((cert, i) => {
                 const f = this.formatBulletPoint(cert);
                 if (f.hasKey) {
                     this.addTextRun(xmlDoc, pCert, f.key, w, true, false, runStyle);
                     this.addTextRun(xmlDoc, pCert, f.val, w, false, false, runStyle);
                 } else {
                     this.addTextRun(xmlDoc, pCert, this.cleanText(cert), w, undefined, undefined, runStyle);
                 }
                 if (i < data.certifications.length - 1) {
                     this.addTextRun(xmlDoc, pCert, " | ", w, false, false, runStyle);
                 }
             });
             
             this.ensureJustification(xmlDoc, pCert, w);
             this.replaceSectionNodes(xmlDoc, paragraphs, certIdx, otherIndices, [pCert]);
        }
        */

        const serializer = new XMLSerializer();
        const newXmlString = serializer.serializeToString(xmlDoc);
        zip.file("word/document.xml", newXmlString);

        return zip.generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    } catch (e: any) {
        console.error("Smart DOM Injection Error:", e);
        throw new Error(`Failed to process DOCX template: ${e.message || 'Unknown error'}`);
    }
  }

  private uppercasePara(doc: Document, p: Element, ns: string) {
    const runs = p.getElementsByTagNameNS(ns, "r");
    for(let i=0; i<runs.length; i++) {
        const texts = runs[i].getElementsByTagNameNS(ns, "t");
         for(let j=0; j<texts.length; j++) {
            if (texts[j].textContent) {
                texts[j].textContent = texts[j].textContent!.toUpperCase();
            }
         }
    }
  }

  private findIndex(paras: Element[], headers: (string | undefined)[]): number {
      const validHeaders = headers.filter(h => !!h).map(h => h.trim().toLowerCase());
      for (let i = 0; i < paras.length; i++) {
          const t = (paras[i].textContent || "").trim();
          const tLower = t.toLowerCase();
          
          if (t.length > 0 && t.length < 50) {
              // 1. Exact match or very close (e.g. "Experience", "Work Experience:")
              const stripped = tLower.replace(/[^a-z ]/g, '').trim();
              if (validHeaders.some(h => stripped === h || stripped === `${h}s` || stripped === h.replace(/s$/, ''))) {
                  return i;
              }
              // 2. Starts with and appears to be a heading (few words, no sentence structure)
              if (t.split(' ').length <= 4 && validHeaders.some(h => tLower.startsWith(h) || tLower.endsWith(h))) {
                 return i;
              }
          }
       }
       
       // Fallback to old behavior if nothing stricter matched, but ensure it doesn't look like a long sentence
       for (let i = 0; i < paras.length; i++) {
           const t = (paras[i].textContent || "").trim();
           if (t.length > 0 && t.length < 40 && t.split(' ').length <= 5 && !t.endsWith('.')) {
               if (validHeaders.some(h => t.toLowerCase().includes(h.toLowerCase()))) {
                   return i;
               }
           }
       }
       
      return -1;
  }
  
  private getNextSectionIndex(start: number, total: number, others: number[]): number {
      const upcoming = others.filter(i => i > start).sort((a,b) => a-b);
      return upcoming.length > 0 ? upcoming[0] : total;
  }
  
  private findFirstRunStyle(paras: Element[], start: number, end: number, ns: string): Node | null {
      for(let k=start; k < end; k++) {
          const runs = paras[k].getElementsByTagNameNS(ns, "r");
          for(let r=0; r<runs.length; r++) {
              const rPr = runs[r].getElementsByTagNameNS(ns, "rPr")[0];
              if (rPr) return rPr.cloneNode(true);
          }
      }
      return null;
  }

  private createPara(doc: Document, text: string, ns: string, baseRPr?: Node | null): Element {
      const p = doc.createElementNS(ns, "p");
      this.addTextRun(doc, p, text, ns, false, false, baseRPr);
      return p;
  }

  private addTextRun(doc: Document, p: Element, text: string, ns: string, bold?: boolean, italic?: boolean, baseRPr: Node | null = null, fontSizeHalfPoints?: number) {
      const r = doc.createElementNS(ns, "r");
      let rPr: Element;
      if (baseRPr) rPr = baseRPr.cloneNode(true) as Element;
      else rPr = doc.createElementNS(ns, "rPr");
      
      if (bold !== undefined) {
          const existingB = rPr.getElementsByTagNameNS(ns, "b");
          while(existingB.length > 0) existingB[0].parentNode?.removeChild(existingB[0]);
          if (bold) {
              const b = doc.createElementNS(ns, "b"); rPr.appendChild(b);
          } else {
              const b = doc.createElementNS(ns, "b"); b.setAttributeNS(ns, "val", "false"); rPr.appendChild(b);
          }
      }
      
      if (italic !== undefined) {
          const existingI = rPr.getElementsByTagNameNS(ns, "i");
          while(existingI.length > 0) existingI[0].parentNode?.removeChild(existingI[0]);
          if (italic) {
              const i = doc.createElementNS(ns, "i"); rPr.appendChild(i);
          } else {
              const i = doc.createElementNS(ns, "i"); i.setAttributeNS(ns, "val", "false"); rPr.appendChild(i);
          }
      }

      if (fontSizeHalfPoints) {
        const existingSz = rPr.getElementsByTagNameNS(ns, "sz");
        while(existingSz.length > 0) existingSz[0].parentNode?.removeChild(existingSz[0]);
        const sz = doc.createElementNS(ns, "sz"); sz.setAttributeNS(ns, "val", fontSizeHalfPoints.toString()); rPr.appendChild(sz);
      }
      r.appendChild(rPr);
      const t = doc.createElementNS(ns, "t"); t.setAttribute("xml:space", "preserve"); t.textContent = text; r.appendChild(t);
      p.appendChild(r);
  }
  
  private ensureJustification(doc: Document, p: Element, ns: string, val: string = "both") {
      let pPr = p.getElementsByTagNameNS(ns, "pPr")[0];
      if (!pPr) {
          pPr = doc.createElementNS(ns, "pPr");
          if (p.firstChild) p.insertBefore(pPr, p.firstChild); else p.appendChild(pPr);
      }
      const existingJc = pPr.getElementsByTagNameNS(ns, "jc");
      while(existingJc.length > 0) existingJc[0].parentNode?.removeChild(existingJc[0]);
      
      const jc = doc.createElementNS(ns, "jc");
      jc.setAttributeNS(ns, "val", val);
      pPr.appendChild(jc);
  }

  private ensureSpacing(doc: Document, p: Element, ns: string, before: string, after: string) {
      let pPr = p.getElementsByTagNameNS(ns, "pPr")[0];
      if (!pPr) {
          pPr = doc.createElementNS(ns, "pPr");
          if (p.firstChild) p.insertBefore(pPr, p.firstChild); else p.appendChild(pPr);
      }
      const existing = pPr.getElementsByTagNameNS(ns, "spacing");
      while(existing.length > 0) existing[0].parentNode?.removeChild(existing[0]);
      
      const s = doc.createElementNS(ns, "spacing");
      s.setAttributeNS(ns, "before", before);
      s.setAttributeNS(ns, "after", after);
      pPr.appendChild(s);
  }

  private ensureKeepNext(doc: Document, p: Element, ns: string) {
      let pPr = p.getElementsByTagNameNS(ns, "pPr")[0];
      if (!pPr) {
          pPr = doc.createElementNS(ns, "pPr");
          if (p.firstChild) p.insertBefore(pPr, p.firstChild); else p.appendChild(pPr);
      }
      if (pPr.getElementsByTagNameNS(ns, "keepNext").length === 0) {
          const kn = doc.createElementNS(ns, "keepNext");
          pPr.appendChild(kn);
      }
  }
  
  private setParagraphSpacingZero(doc: Document, pPr: Element, ns: string) {
     const existingSpacing = pPr.getElementsByTagNameNS(ns, "spacing");
     while(existingSpacing.length > 0) existingSpacing[0].parentNode?.removeChild(existingSpacing[0]);
     
     const spacing = doc.createElementNS(ns, "spacing");
     spacing.setAttributeNS(ns, "after", "0");
     spacing.setAttributeNS(ns, "before", "0");
     spacing.setAttributeNS(ns, "line", "276"); 
     spacing.setAttributeNS(ns, "lineRule", "auto");
     pPr.appendChild(spacing);
  }

  async generateCoverLetterDoc(data: OptimizationResult, content: string): Promise<Blob> {
    try {
      const buffer = await safeGet<ArrayBuffer>(this.TEMPLATE_KEY);
      if (!buffer) {
          throw new Error("No template found. Please ensure your template is uploaded in the Settings tab.");
      }

      const zip = new PizZip(buffer);
      const docXml = zip.file("word/document.xml")?.asText();
      if (!docXml) throw new Error("Invalid DOCX structure");

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(docXml, "application/xml");
      const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

      const paragraphs = Array.from(xmlDoc.getElementsByTagNameNS(w, "p"));
      
      // Find the first section header to know where the header ends
      const summaryHeaders = ["Professional Summary", "Summary", "Profile", "Objective"];
      const expHeaders = ["Experience", "Work History"];
      const eduHeaders = ["Education"];
      const skillHeaders = ["Skills"];
      
      let firstSectionIdx = this.findIndex(paragraphs, [...summaryHeaders, ...expHeaders, ...eduHeaders, ...skillHeaders]);
      
      if (firstSectionIdx === -1) {
          firstSectionIdx = Math.min(5, paragraphs.length);
      }

      const parent = paragraphs[0].parentNode;
      if (!parent) throw new Error("No parent node found");

      // Remove everything from firstSectionIdx onwards
      for (let i = paragraphs.length - 1; i >= firstSectionIdx; i--) {
          parent.removeChild(paragraphs[i]);
      }

      const masterStyle = this.getMasterStyle();
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      // Add Date
      const pDate = xmlDoc.createElementNS(w, "p");
      if (masterStyle) this.applyStylesToPara(xmlDoc, pDate, w, masterStyle);
      this.ensureSpacing(xmlDoc, pDate, w, "240", "240");
      this.addTextRun(xmlDoc, pDate, today, w);
      parent.appendChild(pDate);

      // Add Salutation
      const pSalutation = xmlDoc.createElementNS(w, "p");
      if (masterStyle) this.applyStylesToPara(xmlDoc, pSalutation, w, masterStyle);
      this.ensureSpacing(xmlDoc, pSalutation, w, "0", "120");
      this.addTextRun(xmlDoc, pSalutation, "Dear Hiring Manager,", w);
      parent.appendChild(pSalutation);

      // Add Body paragraphs
      const bodyParas = content.split('\n').filter(p => p.trim().length > 0);
      bodyParas.forEach(text => {
          const pBody = xmlDoc.createElementNS(w, "p");
          if (masterStyle) this.applyStylesToPara(xmlDoc, pBody, w, masterStyle);
          this.ensureSpacing(xmlDoc, pBody, w, "0", "120");
          this.ensureJustification(xmlDoc, pBody, w);
          this.addTextRun(xmlDoc, pBody, text.trim(), w);
          parent.appendChild(pBody);
      });

      // Add Closing
      const pClosing = xmlDoc.createElementNS(w, "p");
      if (masterStyle) this.applyStylesToPara(xmlDoc, pClosing, w, masterStyle);
      this.ensureSpacing(xmlDoc, pClosing, w, "240", "0");
      this.addTextRun(xmlDoc, pClosing, "Sincerely,", w);
      parent.appendChild(pClosing);

      const pName = xmlDoc.createElementNS(w, "p");
      if (masterStyle) this.applyStylesToPara(xmlDoc, pName, w, masterStyle);
      this.addTextRun(xmlDoc, pName, data.personalInfo.name, w, true);
      parent.appendChild(pName);

      const serializer = new XMLSerializer();
      const newXml = serializer.serializeToString(xmlDoc);
      zip.file("word/document.xml", newXml);

      return zip.generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    } catch (error) {
      console.error("Cover letter generation failed", error);
      throw error;
    }
  }

  private replaceSectionNodes(doc: Document, allParas: Element[], startIdx: number, otherIndices: number[], newNodes: Node[], removeAllContent = false, useProvidedStylesOnly = false) {
        try {
            const headerPara = allParas[startIdx];
            if (!headerPara || !headerPara.parentNode) return;
            
            const parent = headerPara.parentNode;
            let endIdx = this.getNextSectionIndex(startIdx, allParas.length, otherIndices);
            
            // Remove content between headers
            // We iterate backwards to avoid index shifting issues with removeChild
            for (let i = endIdx - 1; i > startIdx; i--) {
                const p = allParas[i];
                if (!p) continue;
                
                if (p.parentNode === parent) {
                    parent.removeChild(p);
                } else {
                    // Paragraph is in a different structural parent (e.g., a table cell).
                    // Removing the <w:p> entirely might leave the container empty, violating DOCX schema.
                    // Instead, we strip all text runs from it so the dummy text vanishes.
                    const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
                    const runs = Array.from(p.getElementsByTagNameNS(w, "r"));
                    runs.forEach(r => {
                        if (r.parentNode) r.parentNode.removeChild(r);
                    });
                }
            }
            
            if (removeAllContent) {
                if (headerPara.parentNode === parent) {
                    parent.removeChild(headerPara);
                } else {
                     const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
                     const runs = Array.from(headerPara.getElementsByTagNameNS(w, "r"));
                     runs.forEach(r => {
                         if (r.parentNode) r.parentNode.removeChild(r);
                     });
                }
                return;
            }

            let insertPoint = headerPara.nextSibling;
            newNodes.forEach(n => {
                parent.insertBefore(n, insertPoint);
            });
        } catch (e) {
            console.error("Error in replaceSectionNodes:", e);
        }
  }
}