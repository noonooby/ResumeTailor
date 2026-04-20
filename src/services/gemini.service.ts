import { Injectable } from '@angular/core';
import { GoogleGenAI, Type, ThinkingLevel, GenerateContentResponse } from "@google/genai";
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
Integrate JD concepts naturally (Agile leadership, Scrum mastery, delivery predictability, stakeholder trust, impediment removal, coaching, continuous improvement, release orchestration, metrics, transparency, experimentation, team culture, cross-functional execution, risk containment).
	∙	Never copy JD sentences.
	∙	Rewrite them as lived execution outcomes.
	∙	HUMAN, NOT AI:
Language must feel written by a seasoned leader reflecting on real delivery — not a keyword generator.

EXPERIENCE POSITIONING (LOGIC):
BULLET CONSEQUENCE RULE (NON-NEGOTIABLE):
Every bullet must implicitly answer three questions: What was broken or at risk? What did this person do? What would have happened to the business if they hadn’t? Bullets that only describe activity without consequence will be rewritten until this standard is met.
BULLET HIERARCHY PER ROLE:
Each role must contain bullets that cover all of the following dimensions — not in a fixed order, but all must be present:
	∙	1-2 bullets that establish scale, ownership, or authority (the size of the mandate)
	∙	2-3 bullets that demonstrate execution depth and delivery mechanics (how they actually ran the work)
	∙	1-2 bullets that show stakeholder complexity, political navigation, or cross-functional tension resolved
	∙	1 bullet that demonstrates continuous improvement, process institutionalization, or capability left behind
This creates a role that reads as a complete leadership story, not a task inventory.
CAREER PROGRESSION ARC:
Engineer a visible progression narrative across all roles. Each role must feel like deliberate preparation for the next. The latest role must read as the natural, inevitable destination of everything that came before. If a reader scanned only the first bullet of each role in sequence, they should be able to see a leader growing in scope, complexity, and consequence — not three separate job holders.
	∙	LATEST ROLE:
Emphasize ownership, governance, delivery accountability, executive communication, risk management, and business outcomes. Read like someone already operating at or above the target role.
	∙	MIDDLE ROLES:
Emphasize scale, multi-team coordination, Agile maturity, engineering cadence, roadmap execution, and dependency management.
	∙	EARLY ROLES:
Emphasize SDLC rigor, requirements clarity, UAT discipline, defect control, stakeholder translation, and foundational execution excellence.

METRICS TRUTH PROTOCOL:
	∙	Use exact numbers only if explicitly provided (budgets, team size, timelines).
	∙	If numbers are unavailable:
	∙	Use credible qualitative impact (e.g., “Eliminated release ambiguity,” “Restored stakeholder confidence,” “Stabilized delivery velocity”).
	∙	ABSOLUTELY FORBIDDEN:
	∙	Invented percentages.
	∙	Fake KPIs.
	∙	“Optimized by X%” unless sourced.

SECTION SPECIFICS:
	1.	SUMMARY
	∙	Must NEVER be empty or blank. Must be at least 3-4 powerful sentences.
	∙	Hook: Immediate senior credibility and role fit.
	∙	Pitch: Direct 1:1 mapping to JD intent and business needs.
	∙	Close: A forward-looking statement that implies the business cost or risk of this capability being absent — not a boast, but a quiet statement of consequence.
	∙	Must read like an executive introduction, not a bio. The reader should feel mild urgency after the summary, not just confidence.
	2.	WORK EXPERIENCE
	∙	Each bullet follows: Keyword - What was broken or at risk + what was done + what consequence was avoided or created.
	∙	Every bullet must reinforce JD relevance and resolve one of the three diagnostic pain points identified before writing.
	∙	Zero filler. Zero repetition. Every line earns its place.
	3.	SKILLS
	∙	Do NOT produce a flat keyword list.
	∙	Group skills into 3-4 functional categories that reflect a practiced leader’s toolkit (e.g., Delivery Governance / Agile Frameworks / Stakeholder Management / Technical Fluency).
	∙	Each category should contain only the skills most directly relevant to the JD’s highest-weight requirements.
	∙	The skills section must read as a coherent capability map, not a keyword dump.
	4.	CERTIFICATIONS
	∙	Preserve all certification names and IDs exactly as provided (e.g., PMP®, CSM®).

ATS GOAL:
	∙	Target Score: 95–98/100.
	∙	Keyword density must feel natural and contextual, never stuffed.
	∙	Resume must pass ATS and compel a human to stop scrolling.

NON-NEGOTIABLE OUTCOME:
The final resume must:
	∙	Feel unmistakably human and senior.
	∙	Read as if the candidate has already succeeded in this role.
	∙	Make rejection feel illogical.
	∙	Require zero edits before submission.
	∙	Carry a visible career arc where every role builds on the last.
	∙	Contain no bullet that describes activity without business consequence.
Before returning output, run a silent self-audit:
	∙	Does every bullet answer “what would have happened if this person hadn’t done this?”
	∙	Does the summary create mild urgency, not just confidence?
	∙	Are the 3 highest-weight JD requirements each addressed by a dedicated, unmistakable bullet?
	∙	Does the career arc read as intentional progression, not chronological listing?
	∙	If any answer is no, rewrite until all answers are yes.
`;

export const DEFAULT_COVER_LETTER_INSTRUCTIONS = `
You are an expert career coach and professional resume writer. Write a compelling, highly professional cover letter that feels authentic, human, and directly tailored to the job description.

CRITICAL CONSTRAINTS:
- FIRST PERSON ONLY: Use "I", "my", "me". NEVER use third person.
- NO EM-DASHES (—). Use commas or periods for sentence structure.
- NO ROBOTIC OPENINGS. Avoid overly generic openings like "I am writing to express my interest". Start with a strong, engaging opening that shows genuine interest in the role and company.
- TONE: Professional, confident, and enthusiastic. Read like a real person who is excited about the opportunity.
- LENGTH: Concise. 3-4 paragraphs maximum.

STRUCTURE:
1. THE OPENING: Clearly state the role you are applying for and express genuine enthusiasm for the company and its mission. Explain why you are applying for this specific role.
2. THE FIT (Why I am the best fit): Highlight 2-3 of your most relevant skills or achievements from your resume that directly align with the core requirements of the job description. Show, don't just tell, how your background makes you an ideal candidate.
3. THE VALUE (Why I should get the role): Explain what unique value you bring to the team and how you can contribute to the company's success.
4. THE CLOSING: Reiterate your interest, thank them for their time, and include a professional call to action for an interview.
`;

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  
  // Uses environment variable as requested
  private getClient(): GoogleGenAI {
      return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  private handleError(error: any, context: string): never {
    console.error(`${context} failed:`, error);
    let msg = `AI Service Error (${context}): `;
    if (error.message) {
        if (error.message.includes('429')) msg += 'Rate limit exceeded. Please try again later.';
        else if (error.message.includes('401') || error.message.includes('403')) msg += 'Authentication failed. Check API Key.';
        else if (error.message.includes('500')) msg += 'Google AI Service is currently unavailable.';
        else msg += error.message;
    } else {
        msg += 'Unknown error occurred.';
    }
    throw new Error(msg);
  }

  /**
   * extracting companies and initial metadata to populate the UI configuration
   */
  async extractMetadata(resumeText: string): Promise<{ 
      summary: string, 
      certifications: string[], 
      education: string[], 
      workExperienceText: string, 
      companies: string[] 
  }> {
    const extractPromise = this.doExtractMetadata(resumeText);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Analysis timed out. Please try again.')), 30000));
    return Promise.race([extractPromise, timeoutPromise]) as Promise<any>;
  }

  private async doExtractMetadata(resumeText: string): Promise<{ 
      summary: string, 
      certifications: string[], 
      education: string[], 
      workExperienceText: string, 
      companies: string[] 
  }> {
    try {
        const ai = this.getClient();
        const model = 'gemini-3-flash-preview';
        const schema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING, description: "The professional summary section." },
                certifications: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of certifications or licenses found." },
                education: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of educational institutions and degrees." },
                workExperienceText: { type: Type.STRING, description: "The raw text of the entire work experience section." },
                companies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of distinct company names extracted from the work experience section." }
            },
            required: ['companies', 'summary', 'certifications', 'education', 'workExperienceText']
        };

        const prompt = `
            Analyze the following resume text. 
            1. Identify and separate the resume into its logical sections: summary, certifications, work experience, and education.
            2. Keep these sections in memory and return them in the response.
            3. From the identified work experience section, extract a list of distinct Company Names.
            
            Resume Text:
            "${resumeText.substring(0, 10000)}" 
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { 
                responseMimeType: 'application/json', 
                responseSchema: schema
            }
        });

        if (!response.text) throw new Error('Empty response from AI');
        
        try {
            return JSON.parse(response.text);
        } catch (e) {
            return JSON.parse(jsonrepair(response.text));
        }
    } catch (error) {
        this.handleError(error, 'Extract Metadata');
    }
  }
  
  async extractJobDescriptionFromHtml(html: string): Promise<string> {
    try {
        // 1. Try to find SEO metadata (JSON-LD) first. 
        // This bypasses the "JavaScript Required" visual error because the data is usually embedded in the static HTML for Google Jobs.
        const jsonLdDescription = this.extractDescriptionFromJsonLd(html);
        if (jsonLdDescription) {
            console.log('Successfully extracted JD from JSON-LD');
            return jsonLdDescription;
        }

        // 2. Fallback to Gemini for Visual HTML extraction
        const ai = this.getClient();
        const model = 'gemini-3-flash-preview';
        
        // STRICT prompt to prevent AI from being chatty about errors
        const prompt = `
            Analyze the following HTML from a job posting webpage. Your task is to extract and return ONLY the plain text of the main job description.

            **Instructions:**
            1.  Identify the primary content area containing the job details.
            2.  Ignore all irrelevant content such as headers, footers, navigation bars, sidebars, advertisements, and cookie banners.
            3.  Extract all text related to the role, responsibilities, qualifications, requirements, and benefits.
            4.  Format the output as clean, readable plain text. Preserve paragraph breaks.
            5.  Do not include any HTML tags, CSS, or JavaScript in your response.
            
            **CRITICAL FAILURE CONDITION:**
            If the HTML provided contains NO job description (for example, if it only contains script tags, or says "Loading...", or "Enable JavaScript"), you MUST return exactly the string: "ERROR_JS_REQUIRED". 
            Do not return an explanation. Do not return "The provided HTML...". Return ONLY "ERROR_JS_REQUIRED".

            HTML content (first 25000 characters):
            "${html.substring(0, 25000)}"
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: 'text/plain'
            }
        });

        if (!response.text) throw new Error('Empty response from AI');
        return response.text.trim();
    } catch (error) {
        this.handleError(error, 'Extract Job Description');
    }
  }

  /**
   * Looks for <script type="application/ld+json"> tags that contain Schema.org 'JobPosting' data.
   * This is how browsers/Google Jobs see content on dynamic sites (Workday, Oracle, LinkedIn).
   */
  private extractDescriptionFromJsonLd(html: string): string | null {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        
        for (let i = 0; i < scripts.length; i++) {
            try {
                const content = scripts[i].textContent || '{}';
                const json = JSON.parse(content);
                // JSON-LD can be an array or object
                const items = Array.isArray(json) ? json : [json];
                
                for (const item of items) {
                    // Check for standard Schema.org JobPosting
                    if (item['@type'] === 'JobPosting' || item['@type'] === 'http://schema.org/JobPosting') {
                        if (item.description) {
                            // The description often contains HTML entities, so we decode them
                            const tmp = document.createElement('div');
                            tmp.innerHTML = item.description;
                            return tmp.textContent || tmp.innerText || '';
                        }
                    }
                }
            } catch (jsonErr) {
                // Ignore invalid JSON chunks
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
        const ai = this.getClient();
        const model = 'gemini-3.1-pro-preview';

        const schema = {
            type: Type.OBJECT,
            properties: {
                personalInfo: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        email: { type: Type.STRING },
                        phone: { type: Type.STRING },
                        location: { type: Type.STRING },
                        linkedin: { type: Type.STRING },
                        website: { type: Type.STRING },
                    }
                },
                targetJob: {
                    type: Type.OBJECT,
                    properties: {
                        company: { type: Type.STRING },
                        role: { type: Type.STRING },
                    }
                },
                summary: { type: Type.STRING },
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                experience: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            company: { type: Type.STRING },
                            title: { type: Type.STRING },
                            period: { type: Type.STRING },
                            description: { type: Type.STRING },
                            achievements: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    }
                },
                education: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            institution: { type: Type.STRING },
                            location: { type: Type.STRING },
                            degree: { type: Type.STRING },
                            year: { type: Type.STRING },
                            details: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    }
                },
                certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
                atsAnalysis: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.INTEGER },
                        matchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                        missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                        improvementReasoning: { type: Type.STRING }
                    }
                },
                coverLetter: { type: Type.STRING }
            },
            required: ['personalInfo', 'summary', 'experience', 'skills', 'atsAnalysis', 'education', 'certifications', 'coverLetter']
        };

        const configText = configs.map(c => `- For ${c.name}, generate exactly ${c.bulletCount} bullet points.`).join('\n');
        const skillInstruction = integrateSkills 
            ? "INTEGRATE SKILLS: You MUST weave technical skills and keywords from the JD naturally into the bullet points of the Work Experience. Do not just list them." 
            : "Keep skills separate in the Skills section.";

        const systemPrompt = customInstructions || DEFAULT_INSTRUCTIONS;
        const clPrompt = coverLetterInstructions || DEFAULT_COVER_LETTER_INSTRUCTIONS;

        let prompt = `
            ${systemPrompt}

            ---
            
            COVER LETTER INSTRUCTIONS:
            ${clPrompt}

            ---
            
            EDUCATION & CERTIFICATIONS FORMATTING (CRITICAL):
            - DO NOT modify the education or certifications sections. 
            - Extract and copy them EXACTLY as they appear in the original resume text. 
            - Do not add locations, countries, or any other information if it is not present in the original text.
            - Keep the formatting as simple and close to the original as possible.
            - For education, map the original text to the schema fields as best as possible without adding new information.

            ---
            
            USER REQUEST:
            Optimize the resume below for the following Job Description and generate a matching cover letter.
            
            TARGET JOB DESCRIPTION:
            "${jobDescription}"
            
            CURRENT RESUME:
            "${resumeText}"
            
            CONFIGURATION:
            ${configText}
            ${skillInstruction}
            
            OUTPUT REQUIREMENT:
            Return JSON matching the schema. You MUST generate BOTH the optimized resume and the cover letter in a single response.
        `;

        if (feedback) {
            prompt += `\n\nFEEDBACK / REFINEMENT REQUEST: ${feedback}\nAdjust the output based on this feedback.`;
        }

        const responseStream = await ai.models.generateContentStream({
            model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema
            }
        });

        console.log('Stream started...');
        let fullText = "";
        for await (const chunk of responseStream) {
            const chunkText = (chunk as GenerateContentResponse).text;
            if (chunkText) {
                fullText += chunkText;
                console.log('Received chunk, length:', chunkText.length);
                if (onPartialResult) {
                    try {
                        const repaired = jsonrepair(fullText);
                        const partial = JSON.parse(repaired);
                        onPartialResult(partial);
                    } catch (e) {
                        // Ignore partial parse errors
                    }
                }
            }
        }

        if (!fullText) throw new Error('Empty response from AI');
        try {
            return JSON.parse(fullText);
        } catch (e) {
            // Final attempt with repair
            try {
                return JSON.parse(jsonrepair(fullText));
            } catch (innerE) {
                throw new Error('Failed to parse AI response (Invalid JSON).');
            }
        }
    } catch (error) {
        this.handleError(error, 'Optimize Resume');
    }
  }
  
  async generateCoverLetter(jobDescription: string, context: string, info: any): Promise<string> {
      try {
          const ai = this.getClient();
          const model = 'gemini-3.1-pro-preview';
          
          const prompt = `
              You are an expert career coach. Write a compelling, highly professional cover letter for the following job.
              
              JOB DESCRIPTION:
              ${jobDescription}
              
              CANDIDATE CONTEXT (Summary & Experience):
              ${context}
              
              CANDIDATE INFO:
              Name: ${info.name}
              Email: ${info.email}
              Phone: ${info.phone}
              
              INSTRUCTIONS:
              1. Tone: Confident, professional, enthusiastic, but grounded.
              2. Focus on 3 key matches between the candidate's experience and the job requirements. Keep the total length around 300-400 words to fit on a single page.
              3. Do NOT include a date.
              4. Do NOT include a salutation (e.g., "Dear Hiring Manager,"). Start directly with the first paragraph of the letter.
              5. Do NOT include a sign-off (e.g., "Sincerely," or the candidate's name). End with the last paragraph of the letter.
              6. Return ONLY the body paragraphs of the letter. Do not wrap in markdown blocks.
          `;
          
          const response = await ai.models.generateContent({
              model,
              contents: prompt,
              config: { responseMimeType: 'text/plain' }
          });
          
          if (!response.text) throw new Error('Empty response from AI');
          return response.text;
      } catch (error) {
          this.handleError(error, 'Generate Cover Letter');
      }
  }
}