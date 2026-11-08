import { Injectable } from '@angular/core';
import { OptimizationResult, CompanyConfig } from '../types';
import { jsonrepair } from 'jsonrepair';

export const DEFAULT_INSTRUCTIONS = `
You are the World’s Top Resume Strategist (Top 0.1%). You do not write generic resumes; you write strategic business cases that make the hiring decision feel inevitable.
Your output must make the hiring manager conclude: “This person has already done this job at our level.”

STRATEGY: “THE PERFECT FIT”
Before writing a single word, you must complete a silent internal diagnostic:
	∙	Identify the 3 core pain points the JD is trying to hire away (delivery risk, scaling failure, stakeholder breakdown, execution gaps, governance weakness, velocity problems — pick the ones most dominant in this JD).
	∙	Identify the 1 fear the hiring manager has about a wrong hire for this role.
	∙	Identify the 1 thing in this candidate’s background that makes them uniquely credible above all other applicants.
Build the entire resume as a direct answer to these three things. Every section — summary, bullets, skills — must resolve these diagnostics, not just reflect the JD.
Treat the Job Description (JD) as a problem statement, not a checklist.
	∙	Identify the explicit and implicit pain points in the JD (delivery risk, scaling, execution gaps, stakeholder friction, governance weakness, ambiguity, velocity, quality, predictability).
	∙	Rewrite the candidate’s experience to prove — implicitly and explicitly — that they have already solved these exact problems in comparable or harder environments.
	∙	Every line must answer: “Why this candidate over all others?”
Before writing the experience section, identify the 3 highest-weight requirements in the JD. Each of these must have at least one dedicated bullet that a hiring manager could point to and say “this is exactly what we need” — not adjacent keywords, but a direct, undeniable match.

FORMATTING RULES (ABSOLUTE PRECISION):
	∙	BULLET FORMAT: Each bullet must follow this format exactly:
Keyword - Text continues here
	∙	Keyword: A high-signal hard skill, capability, or domain phrase directly derived from the JD, wrapped in double asterisks (**).
	∙	Separator: “ - “ (single hyphen with spaces).
	∙	Constraint: No colons (:). No em dashes (—). No decorative punctuation.
	∙	Spacing: No extra blank lines between bullets.
	∙	NO MARKDOWN BLOCKS: Return raw JSON strings only. Do not wrap output in code blocks.
	∙	NO PLACEHOLDERS: Every line must be production-ready.

CAREER TRAJECTORY & TITLE OPTIMIZATION (CRITICAL):
	∙	RESTRICTED ROLE TITLES: You should attempt to normalize all past job titles to one of the following three options if they fit the responsibilities:
	1.	“Project Manager”
	2.	“Business Analyst”
	3.	“Product Owner”
	∙	LOGIC:
	∙	Analyze the responsibilities of each past role.
	∙	Map it to the closest match among the three allowed titles if possible.
	∙	If a role absolutely cannot be mapped to one of these three without losing its core identity, you may use a closely related professional title that fits the senior narrative.
	∙	GOAL: Create a consistent narrative using standard industry roles.

TONE & STYLE:
	∙	SENIORITY: Senior Project / Program / Product / Delivery Leader. Calm authority. Governance-aware. Outcome-obsessed.
	∙	BAN GENERIC LANGUAGE: Absolutely forbid phrases like “Responsible for,” “Worked on,” “Assisted,” “Helped,” “Supported.”
	∙	REQUIRED VERB ENERGY: Lead with decisive, executive verbs (e.g., Orchestrated, Stabilized, De-risked, Unblocked, Engineered, Governed, Accelerated, Institutionalized).
	∙	JD ALIGNMENT WITHOUT MIRRORING:
Integrate JD concepts naturally. Never copy JD sentences. Rewrite them as lived execution outcomes.
	∙	HUMAN, NOT AI:
Language must feel written by a seasoned leader reflecting on real delivery — not a keyword generator.
`;

export const DEFAULT_COVER_LETTER_INSTRUCTIONS = `
You are an expert career coach and professional resume writer. Write a compelling, highly professional cover letter that feels authentic, human, and directly tailored to the job description.

CRITICAL CONSTRAINTS:
- FIRST PERSON ONLY: Use "I", "my", "me". NEVER use third person.
- NO MARKDOWN HEADERS: Do not use #, ##, or boldly styled headings for structural elements.
- SIMPLE FORMATTING: Output strictly in this format:
[Date]

Dear Hiring Manager,

[2-3 paragraph body]

Sincerely,
[Name]
- NO ROBOTIC OPENINGS: Avoid overly generic openings. Start with a strong, engaging opening that shows genuine interest in the role and company.
- TONE: Professional, confident, and enthusiastic.
- LENGTH: Concise. 3-4 paragraphs maximum.
`;

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  
  private _selectedModel: string = 'gemini-2.5-flash';
  
  public setSelectedModel(model: string) {
      this._selectedModel = model;
  }

  public async searchJobs(query: string, greenFlags: string[], redFlags: string[]): Promise<any[]> {
    try {
      const res = await fetch('/api/gemini/search-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, greenFlags, redFlags, model: this._selectedModel })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      return data.jobs || [];
    } catch (error: any) {
      console.error('Search jobs error:', error);
      throw new Error(error.message || 'Failed to search for jobs');
    }
  }

  async extractMetadata(resumeText: string): Promise<{ 
      summary: string, 
      certifications: string[], 
      education: string[], 
      workExperienceText: string, 
      companies: string[] 
  }> {
    try {
      const res = await fetch('/api/gemini/extract-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, model: this._selectedModel })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      return await res.json();
    } catch (error: any) {
      console.error('Extract metadata error:', error);
      throw new Error(error.message || 'Failed to analyze resume metadata');
    }
  }
  
  async regenerateSummary(jobDescription: string, resumeText: string, currentSummary: string, customInstructions?: string): Promise<string> {
    try {
      const res = await fetch('/api/gemini/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resumeText, currentSummary, customInstructions, model: this._selectedModel })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      return data.summary || '';
    } catch (error: any) {
      console.error('Regenerate summary error:', error);
      throw new Error(error.message || 'Failed to regenerate summary');
    }
  }

  async regenerateCompanyExperience(
      jobDescription: string, 
      resumeText: string, 
      companyExperience: any, 
      configs: CompanyConfig[],
      integrateSkills: boolean,
      customInstructions?: string
  ): Promise<any> {
    try {
      const res = await fetch('/api/gemini/experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resumeText, companyExperience, configs, integrateSkills, customInstructions, model: this._selectedModel })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      return await res.json();
    } catch (error: any) {
      console.error('Regenerate experience error:', error);
      throw new Error(error.message || 'Failed to regenerate company experience');
    }
  }

  async extractJobDescriptionFromHtml(html: string): Promise<string> {
    try {
      const jsonLdDescription = this.extractDescriptionFromJsonLd(html);
      if (jsonLdDescription) {
        return jsonLdDescription;
      }

      const res = await fetch('/api/gemini/extract-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, model: this._selectedModel })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      return data.description || '';
    } catch (error: any) {
      console.error('Extract JD error:', error);
      throw new Error(error.message || 'Failed to extract job description');
    }
  }

  private extractDescriptionFromJsonLd(html: string): string | null {
    if (typeof DOMParser === 'undefined' || typeof document === 'undefined') return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      
      for (let i = 0; i < scripts.length; i++) {
        try {
          const content = scripts[i].textContent || '{}';
          const json = JSON.parse(content);
          const items = Array.isArray(json) ? json : [json];
          
          for (const item of items) {
            if (item['@type'] === 'JobPosting' || item['@type'] === 'http://schema.org/JobPosting') {
              if (item.description) {
                const tmp = document.createElement('div');
                tmp.innerHTML = item.description;
                return tmp.textContent || tmp.innerText || '';
              }
            }
          }
        } catch {
          continue;
        }
      }
    } catch (e) {
      console.error('JSON-LD extraction failed', e);
    }
    return null;
  }

  async optimizeResume(
    jobDescription: string, 
    resumeText: string, 
    configs: CompanyConfig[], 
    integrateSkills: boolean,
    feedback?: string,
    customInstructions?: string,
    coverLetterInstructions?: string,
    onPartialResult?: (result: Partial<OptimizationResult>) => void
  ): Promise<OptimizationResult> {
    try {
      const res = await fetch('/api/gemini/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          jobDescription,
          resumeText,
          configs,
          integrateSkills,
          feedback,
          customInstructions,
          coverLetterInstructions,
          model: this._selectedModel
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      if (!res.body) {
        const data = await res.json();
        return data;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsedData = JSON.parse(payload);
            if (parsedData.error) {
              throw new Error(parsedData.error);
            }
            if (parsedData.chunk) {
              fullText += parsedData.chunk;
              if (onPartialResult) {
                try {
                  const repaired = jsonrepair(fullText);
                  const partial = JSON.parse(repaired);
                  onPartialResult(partial);
                } catch {
                  // Partial stream parse error, continue accumulating
                }
              }
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) {
              throw e;
            }
          }
        }
      }

      if (!fullText) {
        throw new Error('Empty response received from AI server');
      }

      try {
        return JSON.parse(fullText);
      } catch {
        return JSON.parse(jsonrepair(fullText));
      }
    } catch (error: any) {
      console.error('Optimize Resume error:', error);
      throw new Error(error.message || 'Failed to optimize resume');
    }
  }
  
  async generateCoverLetter(jobDescription: string, context: string, info: any): Promise<string> {
    try {
      const res = await fetch('/api/gemini/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, context, info, model: this._selectedModel })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      return data.coverLetter || '';
    } catch (error: any) {
      console.error('Generate Cover Letter error:', error);
      throw new Error(error.message || 'Failed to generate cover letter');
    }
  }
}