import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { jsonrepair } from 'jsonrepair';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasKey: !!process.env.GEMINI_API_KEY });
});

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('No Gemini API Key found in server environment variables.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const DEFAULT_INSTRUCTIONS = `
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

const DEFAULT_COVER_LETTER_INSTRUCTIONS = `
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

// 1. Optimize Resume (Supports SSE streaming chunks or direct JSON)
app.post('/api/gemini/optimize', async (req, res) => {
  try {
    const {
      jobDescription,
      resumeText,
      configs = [],
      integrateSkills = true,
      feedback,
      customInstructions,
      coverLetterInstructions,
    } = req.body;

    const ai = getGeminiClient();
    const model = req.body?.model || 'gemini-2.5-flash';

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
          },
        },
        targetJob: {
          type: Type.OBJECT,
          properties: {
            company: { type: Type.STRING },
            role: { type: Type.STRING },
          },
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
              achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
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
              details: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
        certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
        atsAnalysis: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            matchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvementReasoning: { type: Type.STRING },
          },
        },
        coverLetter: { type: Type.STRING },
      },
      required: [
        'personalInfo',
        'summary',
        'experience',
        'skills',
        'atsAnalysis',
        'education',
        'certifications',
        'coverLetter',
      ],
    };

    const configText = (configs as any[])
      .map((c: any) => `- For ${c.name}, generate exactly ${c.bulletCount} bullet points.`)
      .join('\n');
    const skillInstruction = integrateSkills
      ? 'INTEGRATE SKILLS: Weave technical skills and keywords from the JD naturally into the bullet points of Work Experience.'
      : 'Keep skills separate in the Skills section.';

    const systemPrompt = customInstructions || DEFAULT_INSTRUCTIONS;
    const clPrompt = coverLetterInstructions || DEFAULT_COVER_LETTER_INSTRUCTIONS;

    let prompt = `
${systemPrompt}

---
COVER LETTER INSTRUCTIONS:
${clPrompt}

---
EXPERIENCE FORMATTING (CRITICAL):
- STRICT SCHEMA ADHERENCE: Cleanly separate "company", "title", and "period" into their respective JSON fields.
- Do NOT combine company, role, and period into a single string.

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
Return valid JSON matching the schema with both the optimized resume and the cover letter.
`;

    if (feedback) {
      prompt += `\n\nFEEDBACK / REFINEMENT REQUEST: ${feedback}\nAdjust the output based on this feedback.`;
    }

    const wantsSse = req.headers.accept?.includes('text/event-stream');

    if (wantsSse) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const responseStream = await ai.models.generateContentStream({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      for await (const chunk of responseStream) {
        const chunkText = (chunk as GenerateContentResponse).text;
        if (chunkText) {
          res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const raw = response.text || '{}';
      try {
        res.json(JSON.parse(raw));
      } catch {
        res.json(JSON.parse(jsonrepair(raw)));
      }
    }
  } catch (error: any) {
    console.error('API /gemini/optimize error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to optimize resume' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

// 2. Extract Metadata from resume text
app.post('/api/gemini/extract-metadata', async (req, res) => {
  try {
    const { resumeText } = req.body;
    const ai = getGeminiClient();
    const model = req.body?.model || 'gemini-2.5-flash';

    const schema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'The professional summary section.' },
        certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
        education: { type: Type.ARRAY, items: { type: Type.STRING } },
        workExperienceText: { type: Type.STRING },
        companies: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['companies', 'summary', 'certifications', 'education', 'workExperienceText'],
    };

    const prompt = `
Analyze the following resume text.
1. Identify and separate the resume into its logical sections: summary, certifications, work experience, and education.
2. From the identified work experience section, extract a list of distinct Company Names (ONLY pure company name, no title/dates).

Resume Text:
"${(resumeText || '').substring(0, 12000)}"
`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    const text = response.text || '{}';
    try {
      res.json(JSON.parse(text));
    } catch {
      res.json(JSON.parse(jsonrepair(text)));
    }
  } catch (error: any) {
    console.error('API /gemini/extract-metadata error:', error);
    res.status(500).json({ error: error.message || 'Failed to extract metadata' });
  }
});

// 3. Regenerate Summary
app.post('/api/gemini/summary', async (req, res) => {
  try {
    const { jobDescription, resumeText, currentSummary, customInstructions } = req.body;
    const ai = getGeminiClient();
    const model = req.body?.model || 'gemini-2.5-flash';

    const systemPrompt = customInstructions || DEFAULT_INSTRUCTIONS;
    const prompt = `
${systemPrompt}

You are an expert resume writer. Rewrite ONLY the professional summary for a resume.
Target Job Description:
${jobDescription}

Original Resume Context:
${(resumeText || '').substring(0, 8000)}

Current Summary:
${currentSummary}

Return ONLY the rewritten summary paragraph. Plain text, no markdown headers.
`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: 'text/plain' },
    });

    res.json({ summary: response.text?.trim() || '' });
  } catch (error: any) {
    console.error('API /gemini/summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to regenerate summary' });
  }
});

// 4. Regenerate Company Experience
app.post('/api/gemini/experience', async (req, res) => {
  try {
    const {
      jobDescription,
      resumeText,
      companyExperience,
      configs = [],
      integrateSkills = true,
      customInstructions,
    } = req.body;

    const ai = getGeminiClient();
    const model = req.body?.model || 'gemini-2.5-flash';

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        company: { type: Type.STRING },
        period: { type: Type.STRING },
        description: { type: Type.STRING },
        achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['title', 'company', 'period', 'description', 'achievements'],
    };

    const configText = (configs as any[])
      .map((c: any) => `- For ${c.name}, generate exactly ${c.bulletCount} bullet points.`)
      .join('\n');
    const skillInstruction = integrateSkills
      ? 'Integrate relevant soft and hard skills directly into the bullet points organically.'
      : 'Keep skills separate in the Skills section.';
    const systemPrompt = customInstructions || DEFAULT_INSTRUCTIONS;

    const prompt = `
${systemPrompt}

Rewrite work experience bullets specifically for "${companyExperience?.company}".
Target Job Description:
${jobDescription}

Original Resume:
${(resumeText || '').substring(0, 8000)}

Previous Version for ${companyExperience?.company}:
${JSON.stringify(companyExperience, null, 2)}

${configText}
${skillInstruction}
`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    const text = response.text || '{}';
    try {
      res.json(JSON.parse(text));
    } catch {
      res.json(JSON.parse(jsonrepair(text)));
    }
  } catch (error: any) {
    console.error('API /gemini/experience error:', error);
    res.status(500).json({ error: error.message || 'Failed to regenerate experience' });
  }
});

// 5. Generate Standalone Cover Letter
app.post('/api/gemini/cover-letter', async (req, res) => {
  try {
    const { jobDescription, context, info } = req.body;
    const ai = getGeminiClient();
    const model = req.body?.model || 'gemini-2.5-flash';

    const prompt = `
You are an expert career coach. Write a compelling, highly professional cover letter.
JOB DESCRIPTION:
${jobDescription}

CANDIDATE CONTEXT:
${context}

CANDIDATE INFO:
Name: ${info?.name || ''}
Email: ${info?.email || ''}
Phone: ${info?.phone || ''}

INSTRUCTIONS:
1. Confident, professional, enthusiastic tone.
2. Focus on 3 key matches between candidate experience and JD. Length: ~300-400 words.
3. Return body paragraphs directly. Plain text.
`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: 'text/plain' },
    });

    res.json({ coverLetter: response.text?.trim() || '' });
  } catch (error: any) {
    console.error('API /gemini/cover-letter error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate cover letter' });
  }
});

// 6. Extract Job Description from HTML
app.post('/api/gemini/extract-jd', async (req, res) => {
  try {
    const { html } = req.body;
    const ai = getGeminiClient();
    const model = req.body?.model || 'gemini-2.5-flash';

    const prompt = `
Analyze the following HTML from a job posting webpage. Extract and return ONLY the plain text of the main job description.
If the HTML contains NO job description (e.g. script only, "Enable JavaScript"), return exactly "ERROR_JS_REQUIRED".

HTML content:
"${(html || '').substring(0, 25000)}"
`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: 'text/plain' },
    });

    res.json({ description: response.text?.trim() || '' });
  } catch (error: any) {
    console.error('API /gemini/extract-jd error:', error);
    res.status(500).json({ error: error.message || 'Failed to extract job description' });
  }
});

// 7. Search Jobs with Google Search Grounding
app.post('/api/gemini/search-jobs', async (req, res) => {
  try {
    const { query, greenFlags = [], redFlags = [] } = req.body;
    const ai = getGeminiClient();
    const model = req.body?.model || 'gemini-2.5-flash';

    const prompt = `You are a helpful job search assistant. Your task is to use Google Search to find real, active job postings that match the user's query.

User Query: "${query}"
Must Have (Green Flags): ${(greenFlags || []).join(', ') || 'None'}
Must Avoid (Red Flags): ${(redFlags || []).join(', ') || 'None'}

SEARCH INSTRUCTIONS:
1. Use Google Search to find highly relevant job postings for the user's query.
2. Ensure the jobs are recent (posted within the last month).
3. The URL MUST be a real, verifiable 'https://' deep-link from the search results (like LinkedIn, Indeed, Glassdoor, or company careers pages).
4. NEVER invent, synthesize, or guess URLs. Use the actual links from the search results.
5. Return up to 10 active jobs. Filter out any results that match the "Must Avoid" red flags.
6. Return the response as a valid JSON array of objects. Do not include markdown formatting or citation markers (like [1]).

Format exactly like this:
[
  {
    "title": "Exact Job Title",
    "company": "Company Name",
    "location": "Location / Remote",
    "url": "https://...",
    "summary": "1-2 sentences explaining why this job fits the user's criteria"
  }
]`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let textResult = response.text || '[]';
    textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
    textResult = textResult.replace(/\[\d+(?:,\s*\d+)*\]/g, '');

    const arrayMatch = textResult.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      textResult = arrayMatch[0];
    }

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(textResult);
    } catch {
      try {
        parsed = JSON.parse(jsonrepair(textResult));
      } catch {
        parsed = [];
      }
    }

    if (Array.isArray(parsed)) {
      parsed = parsed.filter((job) => job.url && job.url.startsWith('http') && !job.url.includes('...') && job.url !== '[Link]');
    } else {
      parsed = [];
    }

    res.json({ jobs: parsed });
  } catch (error: any) {
    console.error('API /gemini/search-jobs error:', error);
    res.status(500).json({ error: error.message || 'Job search failed' });
  }
});

// Static assets
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// Angular SSR catch-all
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

export const reqHandler = createNodeRequestHandler(app);

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 3000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export default app;
