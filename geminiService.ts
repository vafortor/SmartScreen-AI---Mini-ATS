
import { GoogleGenAI, Type } from "@google/genai";
import { Job, Candidate, CandidateScore, TailoredResume, TalentReport, AIAgentContext, ResumeBuilderData } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const safeJsonParse = (text: string | undefined): any => {
  if (!text) return {};
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON Parsing Error from Gemini:", e, "Raw text:", text);
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch (innerE) {
        console.error("Fallback parsing failed:", innerE);
      }
    }
    return {};
  }
};

export const parseJobDescription = async (text: string): Promise<Partial<Job>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Parse this job description into JSON: ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          department: { type: Type.STRING },
          location: { type: Type.STRING },
          minYearsExperience: { type: Type.NUMBER },
          requiredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          niceToHaveSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          requiredCertifications: { type: Type.ARRAY, items: { type: Type.STRING } },
          educationLevel: { type: Type.STRING },
          salaryBand: { type: Type.STRING },
        },
        required: ["title", "requiredSkills"],
      },
    },
  });
  return safeJsonParse(response.text);
};

export const parseResume = async (base64Data: string, mimeType: string): Promise<Partial<Candidate>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        {
          text: "Extract detailed professional profile from this resume. Be extremely thorough with experience dates and skill lists."
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          location: { type: Type.STRING },
          summary: { type: Type.STRING },
          totalYearsExperience: { type: Type.NUMBER },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          education: { type: Type.ARRAY, items: { type: Type.STRING } },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                company: { type: Type.STRING },
                duration: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });
  return safeJsonParse(response.text);
};

export const enhanceResumeContent = async (type: 'summary' | 'experience', content: string): Promise<string> => {
  const prompt = `
    You are an expert career coach. 
    Rewrite the following ${type} content to be more professional, impact-driven, and concise. 
    Use strong action verbs and industry-standard terminology. 
    If it's experience, ensure it sounds like high-level achievements rather than just tasks.
    
    Content to rewrite: "${content}"
    
    Return only the rewritten text, nothing else.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || content;
};

export const tailorResumeBuilderData = async (data: ResumeBuilderData, jobDescription: string): Promise<ResumeBuilderData> => {
  const prompt = `
    You are a career strategy expert. Rewrite this user's resume data to perfectly align with the provided Job Description.
    Focus on:
    1. A strategic executive bio that hits JD keywords.
    2. Rewriting experience bullets to show alignment with JD requirements.
    3. Keeping the structure identical to input but content optimized.
    
    Job Description: ${jobDescription}
    Resume Data: ${JSON.stringify(data)}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          location: { type: Type.STRING },
          summary: { type: Type.STRING },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                company: { type: Type.STRING },
                duration: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          education: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  return safeJsonParse(response.text);
};

export const scoreCandidate = async (candidate: Candidate, job: Job): Promise<CandidateScore> => {
  const prompt = `
    Analyze Candidate vs Job.
    Job: ${JSON.stringify(job)}
    Candidate: ${JSON.stringify(candidate)}
    
    Tasks:
    1. Standard scoring (0-100).
    2. Identify mismatch reason if score < 80.
    3. CRITICAL: Evaluate 'Tailoring Potential'. Set 'hasTailoringPotential' to true if the candidate has strong education (e.g. Master's in relevant field) or transferable skills (e.g. they know Java but job is C#) that could be reframed to meet job requirements.
    4. List 'transferableSkills' found.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: {
            type: Type.OBJECT,
            properties: {
              skillsMatch: { type: Type.NUMBER },
              experienceMatch: { type: Type.NUMBER },
              educationMatch: { type: Type.NUMBER },
              locationMatch: { type: Type.NUMBER },
              overallScore: { type: Type.NUMBER },
            },
            required: ["overallScore"],
          },
          flags: { type: Type.ARRAY, items: { type: Type.STRING } },
          status: { type: Type.STRING, enum: ['top_fit', 'borderline', 'not_suitable'] },
          analysis: { type: Type.STRING },
          mismatchReason: { type: Type.STRING },
          hasTailoringPotential: { type: Type.BOOLEAN },
          transferableSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["score", "status", "analysis", "mismatchReason", "hasTailoringPotential"],
      },
    },
  });

  const result = safeJsonParse(response.text);
  return { candidateId: candidate.id, jobId: job.id, ...result };
};

export const tailorResumeForJob = async (candidate: Candidate, job: Job): Promise<TailoredResume> => {
  const prompt = `
    Rewrite the candidate's profile to align with the job description using industry terminology found in the JD.
    Highlight education if it covers missing direct experience.
    
    Candidate: ${JSON.stringify(candidate)}
    Job: ${JSON.stringify(job)}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedSummary: { type: Type.STRING },
          optimizedExperience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalTitle: { type: Type.STRING },
                suggestedBullets: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          },
          justification: { type: Type.STRING }
        }
      }
    }
  });
  return safeJsonParse(response.text);
};

export const generateTalentReport = async (job: Job, candidates: Candidate[], scores: CandidateScore[]): Promise<TalentReport> => {
  const pipelineData = candidates.map(c => {
    const score = scores.find(s => s.candidateId === c.id);
    return {
      name: c.name,
      overallScore: score?.score.overallScore,
      status: score?.status,
      topSkills: c.skills.slice(0, 5),
      analysis: score?.analysis
    };
  });

  const prompt = `
    Generate a high-level strategic Talent Intelligence Report for the following job pipeline.
    
    Job: ${job.title} in ${job.department}
    Requirements: ${job.requiredSkills.join(', ')}
    
    Pipeline Data:
    ${JSON.stringify(pipelineData)}
    
    Output a professional summary of the talent pool, its strengths, weaknesses, and a final hiring recommendation. 
    Also calculate a 'pipelineHealthScore' (0-100) based on how well the candidates meet the job needs.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendation: { type: Type.STRING },
          pipelineHealthScore: { type: Type.NUMBER }
        },
        required: ["summary", "strengths", "weaknesses", "recommendation", "pipelineHealthScore"]
      }
    }
  });

  return safeJsonParse(response.text);
};

export const askAIAssistant = async (query: string, context: AIAgentContext): Promise<string> => {
  const systemPrompt = `
    You are the SmartScreen AI Agent, an expert recruitment consultant.
    You have access to the current app context to help the user.
    
    Current System Context:
    - View: ${context.currentView}
    - Active Job: ${context.activeJob ? context.activeJob.title : 'None'}
    - Pipeline Count: ${context.pipelineCount || 0}
    - Total Jobs in System: ${context.allJobs?.length || 0}
    
    Guidelines:
    1. Be professional, strategic, and concise.
    2. Use the context to provide relevant answers. If they ask "summarize this job", use the Active Job data.
    3. If you don't have enough data (e.g. they ask about a specific candidate not in context), explain that you need more information.
    4. Format your response with markdown for readability (bullet points, bold text).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: query,
    config: {
      systemInstruction: systemPrompt,
    }
  });

  return response.text || "I'm sorry, I couldn't process that request.";
};
