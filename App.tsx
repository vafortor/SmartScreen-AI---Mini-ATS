
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Search, FileUp, Briefcase, Users, Filter, ArrowLeft, BrainCircuit, Sparkles, X, Award, DollarSign, MapPin, GraduationCap, Clock, FileText, Loader2, Lightbulb, Zap, TrendingUp, BarChart2, Download, CreditCard, ShieldCheck, Mail, Phone, ExternalLink, Activity, Target, CheckCircle2, CheckCircle, ChevronRight, Trash2, AlertTriangle, Settings, Bell, Shield, User, Globe, Code, LogIn, UserPlus, KeyRound, ShieldAlert, FilePieChart, Printer, Landmark, PencilRuler } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import Sidebar from './components/Sidebar';
import JobCard from './components/JobCard';
import CandidateRow from './components/CandidateRow';
import AIAssistAgent from './components/AIAssistAgent';
import ResumeBuilder from './components/ResumeBuilder';
import { Job, Candidate, CandidateScore, View, TailoredResume, UserTier, TrialInfo, User as UserType, TalentReport, AIAgentContext } from './types';
import { parseJobDescription, parseResume, scoreCandidate, tailorResumeForJob, generateTalentReport } from './geminiService';

const STRIPE_SUBSCRIBE_LINK = "https://buy.stripe.com/test_7sYcN7eA909Q90Q5RE6EU00";
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    const saved = localStorage.getItem('smartscreen_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [authError, setAuthError] = useState<string | null>(null);

  // App State
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [scores, setScores] = useState<CandidateScore[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  
  // Reporting State
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [talentReport, setTalentReport] = useState<TalentReport | null>(null);

  // Idle Timer State
  const lastActivityRef = useRef<number>(Date.now());

  // Settings State
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('smartscreen_settings');
    return saved ? JSON.parse(saved) : {
      userName: 'Guest Recruiter',
      userRole: 'Talent Partner',
      scoringThreshold: 75,
      autoArchive: true,
      notifications: {
        email: true,
        browser: false,
        summary: true
      },
      aiModel: 'gemini-3-flash-preview'
    };
  });

  // Handle Idle Timeout
  useEffect(() => {
    if (!currentUser) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, updateActivity));

    const checkIdle = setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        handleSignOut();
        alert("Session expired due to 15 minutes of inactivity. Please sign in again.");
      }
    }, 30000); // Check every 30 seconds

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(checkIdle);
    };
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('smartscreen_settings', JSON.stringify(settings));
  }, [settings]);

  // Derived Tier Logic (Based on currentUser)
  const tier: UserTier = currentUser?.tier || 'free';

  const [trial, setTrial] = useState<TrialInfo>({
    startDate: new Date().toISOString(),
    isExpired: false,
    daysRemaining: 7
  });

  // Initialize trial based on currentUser
  useEffect(() => {
    if (currentUser) {
      const trialKey = `smartscreen_trial_start_${currentUser.username}`;
      const storedStart = localStorage.getItem(trialKey);
      const now = new Date();
      let startDate: Date;

      if (!storedStart) {
        startDate = now;
        localStorage.setItem(trialKey, startDate.toISOString());
      } else {
        startDate = new Date(storedStart);
      }

      const diffInMs = now.getTime() - startDate.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 7 - diffInDays);

      setTrial({
        startDate: startDate.toISOString(),
        isExpired: diffInDays >= 7,
        daysRemaining: daysRemaining
      });
    }
  }, [currentUser]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiParsingJob, setIsAiParsingJob] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailoredResult, setTailoredResult] = useState<{ candidate: Candidate; result: TailoredResume } | null>(null);

  const [jobForm, setJobForm] = useState<Partial<Job>>({
    title: '', department: '', location: '', description: '',
    minYearsExperience: 0, requiredSkills: [], niceToHaveSkills: [],
    requiredCertifications: [], educationLevel: 'Bachelors', salaryBand: '',
  });

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result?.toString().split(',')[1];
        if (base64String) resolve(base64String);
        else reject(new Error("Failed to convert file to base64"));
      };
      reader.onerror = error => reject(error);
    });
  };

  // Auth Handlers
  const handleAuthSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;

    const storedUsers: UserType[] = JSON.parse(localStorage.getItem('smartscreen_users') || '[]');

    if (authMode === 'signup') {
      if (storedUsers.some(u => u.username === username)) {
        setAuthError("Username already exists.");
        return;
      }
      const newUser: UserType = {
        username,
        password,
        name: name || username,
        role: 'Recruiter',
        tier: 'free',
        createdAt: new Date().toISOString()
      };
      const updatedUsers = [...storedUsers, newUser];
      localStorage.setItem('smartscreen_users', JSON.stringify(updatedUsers));
      setCurrentUser(newUser);
      localStorage.setItem('smartscreen_session', JSON.stringify(newUser));
    } else if (authMode === 'login') {
      const user = storedUsers.find(u => u.username === username && u.password === password);
      if (user) {
        setCurrentUser(user);
        localStorage.setItem('smartscreen_session', JSON.stringify(user));
        lastActivityRef.current = Date.now();
      } else {
        setAuthError("Invalid credentials.");
      }
    } else if (authMode === 'reset') {
      const userIdx = storedUsers.findIndex(u => u.username === username);
      if (userIdx !== -1) {
        storedUsers[userIdx].password = password;
        localStorage.setItem('smartscreen_users', JSON.stringify(storedUsers));
        setAuthMode('login');
        alert("Password updated successfully. Please login.");
      } else {
        setAuthError("User not found.");
      }
    }
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('smartscreen_session');
    setCurrentView('dashboard');
  };

  const handleJobClick = (jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentView('job-detail');
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedJobId) return;

    setIsProcessing(true);
    try {
      const base64Data = await fileToBase64(file);
      const parsedCandidate = await parseResume(base64Data, file.type);
      
      const newCandidate: Candidate = {
        id: `cand-${Date.now()}`,
        name: parsedCandidate.name || 'Anonymous Applicant',
        email: parsedCandidate.email || '',
        phone: parsedCandidate.phone || '',
        location: parsedCandidate.location || '',
        summary: parsedCandidate.summary || '',
        totalYearsExperience: parsedCandidate.totalYearsExperience || 0,
        skills: parsedCandidate.skills || [],
        education: parsedCandidate.education || [],
        experience: parsedCandidate.experience || [],
        certifications: parsedCandidate.certifications || [],
        rawText: `Document: ${file.name}`,
      };

      setCandidates(prev => [...prev, newCandidate]);

      const job = jobs.find(j => j.id === selectedJobId);
      if (job) {
        const score = await scoreCandidate(newCandidate, job);
        setScores(prev => [...prev, score]);
      }
    } catch (error) {
      console.error("Processing error:", error);
      alert("Failed to review resume. Ensure it is a standard PDF or Image format.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTailorResume = async (candidateId: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    const job = jobs.find(j => j.id === selectedJobId);
    if (!candidate || !job) return;

    setIsTailoring(true);
    try {
      const result = await tailorResumeForJob(candidate, job);
      setTailoredResult({ candidate, result });
    } catch (error) {
      console.error("Tailoring error:", error);
    } finally {
      setIsTailoring(false);
    }
  };

  const handleGenerateReport = async () => {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job || !selectedJobId) return;

    const pipelineCandidates = candidates.filter(c => scores.some(s => s.candidateId === c.id && s.jobId === selectedJobId));
    const pipelineScores = scores.filter(s => s.jobId === selectedJobId);

    if (pipelineCandidates.length === 0) {
      alert("No candidates in the pipeline to report on.");
      return;
    }

    setIsGeneratingReport(true);
    try {
      const report = await generateTalentReport(job, pipelineCandidates, pipelineScores);
      setTalentReport(report);
    } catch (error) {
      console.error("Report generation error:", error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleExportPdf = () => {
    if (!tailoredResult || !selectedJobId) return;
    const job = jobs.find(j => j.id === selectedJobId);
    const { candidate, result } = tailoredResult;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to export the PDF.');
      return;
    }

    const content = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Reframed Resume - ${candidate.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
            
            :root {
              --primary: #2563eb;
              --text-main: #0f172a;
              --text-sub: #475569;
              --bg-muted: #f8fafc;
              --border: #e2e8f0;
            }

            body {
              font-family: 'Plus Jakarta Sans', sans-serif;
              color: var(--text-main);
              line-height: 1.6;
              margin: 0;
              padding: 40px;
              background: white;
            }

            .container {
              max-width: 850px;
              margin: 0 auto;
            }

            .header {
              border-bottom: 3px solid var(--primary);
              padding-bottom: 24px;
              margin-bottom: 32px;
            }

            .header h1 {
              font-size: 36px;
              font-weight: 800;
              margin: 0 0 10px 0;
              letter-spacing: -0.04em;
              color: var(--text-main);
            }

            .contact-info {
              display: flex;
              flex-wrap: wrap;
              gap: 16px;
              color: var(--text-sub);
              font-size: 14px;
              font-weight: 600;
            }

            .job-tag {
              display: inline-block;
              margin-top: 16px;
              font-weight: 800;
              font-size: 11px;
              color: white;
              background: var(--primary);
              padding: 4px 12px;
              border-radius: 6px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
            }

            section {
              margin-bottom: 32px;
            }

            section h2 {
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: var(--primary);
              border-bottom: 1px solid var(--border);
              padding-bottom: 8px;
              margin-bottom: 20px;
            }

            .summary-box {
              background: #f1f5f9;
              padding: 24px;
              border-radius: 16px;
              font-size: 15px;
              font-weight: 500;
              color: var(--text-main);
              border: 1px solid var(--border);
              line-height: 1.7;
            }

            .experience-item {
              margin-bottom: 28px;
            }

            .experience-item h3 {
              font-size: 18px;
              font-weight: 700;
              margin: 0 0 10px 0;
              color: var(--text-main);
            }

            .bullet-list {
              padding-left: 20px;
              margin: 0;
              list-style-type: square;
            }

            .bullet-list li {
              margin-bottom: 10px;
              color: var(--text-sub);
              font-size: 14.5px;
              font-weight: 500;
            }

            .footer {
              margin-top: 80px;
              text-align: center;
              font-size: 10px;
              color: #cbd5e1;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.2em;
            }

            @media print {
              body { padding: 0; }
              @page { margin: 1.5cm; }
              .container { max-width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <header class="header">
              <h1>${candidate.name}</h1>
              <div class="contact-info">
                <span>${candidate.email}</span>
                <span>•</span>
                <span>${candidate.phone}</span>
                <span>•</span>
                <span>${candidate.location}</span>
              </div>
              <div class="job-tag">Optimized Profile: ${job?.title}</div>
            </header>

            <section>
              <h2>Executive Bio Alignment</h2>
              <div class="summary-box">
                ${result.suggestedSummary}
              </div>
            </section>

            <section>
              <h2>High-Impact Contributions</h2>
              ${result.optimizedExperience.map(exp => `
                <div class="experience-item">
                  <h3>${exp.originalTitle}</h3>
                  <ul class="bullet-list">
                    ${exp.suggestedBullets.map(bullet => `<li>${bullet}</li>`).join('')}
                  </ul>
                </div>
              `).join('')}
            </section>

            <div class="footer">
              AI-Generated Strategic Profile Alignment | SmartScreen Engine v2.0
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.onafterprint = function() { window.close(); };
              }, 600);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleCreateJob = () => {
    const newJob: Job = {
      ...jobForm as Job,
      id: `job-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setJobs(prev => [newJob, ...prev]);
    setCurrentView('dashboard');
  };

  const handleDeleteJob = (jobId: string) => {
    setJobs(prev => prev.filter(j => j.id !== jobId));
    setScores(prev => prev.filter(s => s.jobId !== jobId));
    setJobToDelete(null);
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
      setCurrentView('dashboard');
    }
  };

  const handleAiAutoFill = async () => {
    if (!jobForm.description) return;
    setIsAiParsingJob(true);
    try {
      const parsed = await parseJobDescription(jobForm.description);
      setJobForm(prev => ({ ...prev, ...parsed }));
    } catch (error) { console.error(error); } finally { setIsAiParsingJob(false); }
  };

  const handleUpgrade = () => {
    window.open(STRIPE_SUBSCRIBE_LINK, '_blank');
    
    if (currentUser) {
      const storedUsers: UserType[] = JSON.parse(localStorage.getItem('smartscreen_users') || '[]');
      const userIdx = storedUsers.findIndex(u => u.username === currentUser.username);
      
      if (userIdx !== -1) {
        const updatedUser = { ...storedUsers[userIdx], tier: 'pro' as UserTier };
        storedUsers[userIdx] = updatedUser;
        localStorage.setItem('smartscreen_users', JSON.stringify(storedUsers));
        setCurrentUser(updatedUser);
        localStorage.setItem('smartscreen_session', JSON.stringify(updatedUser));
        setCurrentView('dashboard');
        alert("Account upgraded to Enterprise Pro! You now have unlimited access.");
      }
    }
  };

  const filteredScores = useMemo(() => 
    scores
      .filter(s => s.jobId === selectedJobId)
      .sort((a, b) => b.score.overallScore - a.score.overallScore),
    [scores, selectedJobId]
  );

  const aiContext: AIAgentContext = useMemo(() => ({
    currentView,
    activeJob: jobs.find(j => j.id === selectedJobId),
    pipelineCount: scores.filter(s => s.jobId === selectedJobId).length,
    allJobs: jobs
  }), [currentView, selectedJobId, jobs, scores]);

  const renderExpirationModal = () => (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={40} />
        </div>
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Trial Period Expired</h3>
        <p className="text-slate-500 font-medium leading-relaxed">
          Your 7-day evaluation period for the SmartScreen Engine has concluded. To continue using AI-powered matching, please upgrade to a Pro license.
        </p>
        <button 
          onClick={handleUpgrade}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
        >
          <Zap size={16} fill="white" />
          Upgrade to Pro
        </button>
      </div>
    </div>
  );

  const renderBilling = () => (
    <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Choose Your Intelligence Tier</h2>
        <p className="text-slate-500 font-medium max-w-xl mx-auto">Scale your talent acquisition with Gemini-3 powered parsing and strategic pipeline analysis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className={`p-10 rounded-[3rem] border-2 transition-all relative overflow-hidden ${tier === 'free' ? 'bg-white border-blue-500 shadow-xl' : 'bg-slate-50 border-slate-100 opacity-80'}`}>
          {tier === 'free' && <div className="absolute top-8 right-8 bg-blue-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Active Plan</div>}
          <h3 className="text-2xl font-black text-slate-900 mb-2">Free Trial</h3>
          <p className="text-slate-400 text-sm font-bold mb-8 uppercase tracking-widest">7 Days Evaluation</p>
          <div className="text-4xl font-black text-slate-900 mb-8">$0<span className="text-sm text-slate-400 font-bold tracking-normal">/month</span></div>
          <ul className="space-y-4 mb-10">
            {['Basic Resume Parsing', '3 Active Requisitions', 'Candidate Scorecard', 'Standard Support'].map((feat, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                <CheckCircle2 size={18} className="text-emerald-500" /> {feat}
              </li>
            ))}
          </ul>
          <button 
            disabled={tier === 'free'}
            className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs transition-all cursor-default"
          >
            Current Plan
          </button>
        </div>

        <div className={`p-10 rounded-[3rem] border-2 transition-all relative overflow-hidden ${tier === 'pro' ? 'bg-white border-indigo-500 shadow-xl' : 'bg-white border-slate-100 hover:border-indigo-300 shadow-lg'}`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          {tier === 'pro' && <div className="absolute top-8 right-8 bg-indigo-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Active Plan</div>}
          <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em] mb-2">
            <Sparkles size={14} fill="currentColor" /> Highly Recommended
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">Enterprise Pro</h3>
          <p className="text-slate-400 text-sm font-bold mb-8 uppercase tracking-widest">Full Engine Access</p>
          <div className="text-4xl font-black text-slate-900 mb-8">$25<span className="text-sm text-slate-400 font-bold tracking-normal">/month</span></div>
          <ul className="space-y-4 mb-10">
            {['Unlimited Parsing', 'Unlimited Requisitions', 'Strategic Talent Reports', 'AI Resume Reframing', 'Priority API Access', '24/7 Concierge Support'].map((feat, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                <CheckCircle2 size={18} className="text-indigo-500" /> {feat}
              </li>
            ))}
          </ul>
          <button 
            onClick={handleUpgrade}
            disabled={tier === 'pro'}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${
              tier === 'pro' ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20'
            }`}
          >
            {tier === 'pro' ? 'Active Pro License' : 'Upgrade to Pro'}
            {tier !== 'pro' && <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      <div className="p-12 bg-slate-900 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 text-center md:text-left">
          <h4 className="text-2xl font-black tracking-tight mb-2">Need a custom solution?</h4>
          <p className="text-slate-400 font-medium">For agencies with over 50 recruiters, we offer custom infrastructure deployments.</p>
        </div>
        <button className="px-10 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs whitespace-nowrap relative z-10 hover:bg-slate-100 transition-all">
          Contact Sales
        </button>
      </div>
    </div>
  );

  const renderTailoringModal = () => {
    if (!tailoredResult) return null;
    const { candidate, result } = tailoredResult;
    const job = jobs.find(j => j.id === selectedJobId);

    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                <Sparkles size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">Strategic Reframing Result</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Optimizing {candidate.name} for {job?.title}</p>
              </div>
            </div>
            <button 
              onClick={() => setTailoredResult(null)}
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-12 space-y-12">
            <section className="p-8 bg-purple-50 border border-purple-100 rounded-[2.5rem]">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-4 flex items-center gap-2">
                 <BrainCircuit size={16} /> Reframing Logic
               </h4>
               <p className="text-slate-700 font-medium leading-relaxed italic">"{result.justification}"</p>
            </section>

            <section className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-2">
                <FileText size={16} /> Suggested Executive Bio
              </h4>
              <div className="p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-sm italic text-slate-600 text-lg leading-relaxed">
                {result.suggestedSummary}
              </div>
            </section>

            <section className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-2">
                <Target size={16} /> Optimized Experience Bullets
              </h4>
              <div className="space-y-8">
                {result.optimizedExperience.map((exp, i) => (
                  <div key={i} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                    <h5 className="font-black text-slate-900 text-xl mb-4">{exp.originalTitle}</h5>
                    <ul className="space-y-3">
                      {exp.suggestedBullets.map((bullet, bi) => (
                        <li key={bi} className="flex gap-3 text-slate-600 font-medium leading-relaxed">
                          <CheckCircle2 size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-end gap-4">
            <button 
              onClick={() => setTailoredResult(null)}
              className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all"
            >
              Discard Changes
            </button>
            <button 
              onClick={handleExportPdf}
              className="px-10 py-4 bg-[#0f172a] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              <Download size={18} /> Export Reframed Resume
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeleteConfirmationModal = () => {
    if (!jobToDelete) return null;

    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Trash2 size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Delete Requisition?</h3>
          <p className="text-slate-500 font-medium leading-relaxed">
            Are you sure you want to remove <span className="font-bold text-slate-900">{jobToDelete.title}</span>? This will permanently delete the pipeline and all matching scores.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setJobToDelete(null)}
              className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={() => handleDeleteJob(jobToDelete.id)}
              className="py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAuthView = () => (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#0f172a] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] -mr-[400px] -mt-[400px]"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[100px] -ml-[300px] -mb-[300px]"></div>
      
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-white/5 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-700">
        <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border-r border-white/5 relative">
           <div className="space-y-6 relative z-10">
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-2xl">
                <Sparkles size={32} className="text-blue-600" fill="currentColor" />
              </div>
              <h2 className="text-5xl font-black text-white tracking-tighter leading-tight">
                Recruit with<br /><span className="text-blue-400">Pure Intelligence.</span>
              </h2>
              <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-sm">
                Join the next generation of talent partners using Gemini-3 powered scoring and resume reframing.
              </p>
           </div>
           
           <div className="space-y-8 relative z-10">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/20">
                    <ShieldCheck size={24} />
                 </div>
                 <div>
                    <p className="text-white font-bold">Enterprise Encryption</p>
                    <p className="text-slate-500 text-sm">Your data stays your data.</p>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                    <Zap size={24} />
                 </div>
                 <div>
                    <p className="text-white font-bold">Real-time Parsing</p>
                    <p className="text-slate-500 text-sm">Extract skills in milliseconds.</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="p-12 lg:p-20 flex flex-col justify-center">
          <div className="mb-10 text-center lg:text-left">
            <h3 className="text-3xl font-black text-white tracking-tight mb-2">
              {authMode === 'login' ? 'Welcome Back' : authMode === 'signup' ? 'Create Account' : 'Reset Credentials'}
            </h3>
            <p className="text-slate-400 font-medium">
              {authMode === 'login' ? 'Enter your details to access the engine.' : authMode === 'signup' ? 'Start your 7-day free trial today.' : 'Enter your username to update your password.'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-6">
            {authError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-bold animate-in shake duration-300">
                <ShieldAlert size={18} />
                {authError}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="username-input" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 cursor-pointer">Username</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  required
                  id="username-input"
                  name="username"
                  type="text" 
                  autoComplete="username"
                  placeholder="e.g. alex_recruiter"
                  className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-white font-bold transition-all"
                />
              </div>
            </div>

            {authMode === 'signup' && (
              <div className="space-y-1.5">
                <label htmlFor="name-input" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 cursor-pointer">Full Name</label>
                <div className="relative">
                  <Activity size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    required
                    id="name-input"
                    name="name"
                    type="text" 
                    autoComplete="name"
                    placeholder="Alex Smith"
                    className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-white font-bold transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex justify-between items-end px-1">
                <label htmlFor="password-input" className="text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                  {authMode === 'reset' ? 'New Password' : 'Password'}
                </label>
                {authMode === 'login' && (
                  <button type="button" onClick={() => setAuthMode('reset')} className="text-[10px] font-bold text-blue-400 hover:underline">Forgot password?</button>
                )}
              </div>
              <div className="relative">
                <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  required
                  id="password-input"
                  name="password"
                  type="password" 
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-white font-bold transition-all"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-blue-500/20 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {authMode === 'login' ? <LogIn size={18} /> : authMode === 'signup' ? <UserPlus size={18} /> : <ShieldCheck size={18} />}
              <span>{authMode === 'login' ? 'Enter System' : authMode === 'signup' ? 'Create Account' : 'Confirm Reset'}</span>
            </button>
          </form>

          <div className="mt-10 pt-10 border-t border-white/5 text-center">
            <p className="text-slate-500 text-sm font-medium">
              {authMode === 'login' ? "Don't have an account?" : "Already a partner?"}{" "}
              <button 
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} 
                className="text-blue-400 font-bold hover:underline"
              >
                {authMode === 'login' ? 'Create Profile' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCandidateProfileModal = () => {
    if (!selectedCandidateId) return null;
    const candidate = candidates.find(c => c.id === selectedCandidateId);
    if (!candidate) return null;

    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-3xl flex items-center justify-center text-2xl font-black shadow-xl shadow-blue-500/20">
                {candidate.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{candidate.name}</h3>
                <div className="flex items-center gap-4 text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                  <span className="flex items-center gap-1.5"><Mail size={14} /> {candidate.email}</span>
                  <span className="flex items-center gap-1.5"><Phone size={14} /> {candidate.phone}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setSelectedCandidateId(null)}
              className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-red-500 transition-all shadow-sm"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-12 space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="md:col-span-2 space-y-10">
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <Activity size={16} /> Professional Summary
                  </h4>
                  <p className="text-lg text-slate-600 font-medium leading-relaxed italic">
                    "{candidate.summary}"
                  </p>
                </section>

                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <Briefcase size={16} /> Experience History
                  </h4>
                  <div className="space-y-8">
                    {candidate.experience.map((exp, i) => (
                      <div key={i} className="relative pl-8 border-l-2 border-slate-100 pb-2">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-white"></div>
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-black text-slate-900 text-xl">{exp.title}</h5>
                          <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-xl text-xs font-bold">{exp.duration}</span>
                        </div>
                        <p className="text-blue-600 font-bold text-sm mb-4">{exp.company}</p>
                        <p className="text-slate-500 text-sm leading-relaxed">{exp.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-10">
                <section className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Candidate Stats</h4>
                  <div className="space-y-6">
                    <div>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Experience</p>
                      <p className="text-2xl font-black text-slate-900">{candidate.totalYearsExperience} Years</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Education</p>
                      <ul className="space-y-2">
                        {candidate.education.map((edu, i) => (
                          <li key={i} className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <GraduationCap size={16} className="text-purple-500" />
                            {edu}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Core Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map(skill => (
                      <span key={skill} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold border border-blue-100">
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>

                {candidate.certifications.length > 0 && (
                  <section>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Certifications</h4>
                    <ul className="space-y-2">
                      {candidate.certifications.map((cert, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          {cert}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          </div>

          <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-end gap-4">
            <button className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all flex items-center gap-2">
              <Mail size={18} /> Contact
            </button>
            <button className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all">
              Shortlist Candidate
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Live Requisitions', val: jobs.length, icon: <Briefcase className="text-blue-500" />, bg: 'bg-blue-50/50' },
          { label: 'Total Applicants', val: candidates.length, icon: <Users className="text-emerald-500" />, bg: 'bg-emerald-50/50' },
          { label: 'AI Top-Fit Matches', val: scores.filter(s => s.status === 'top_fit').length, icon: <Zap className="text-purple-500" />, bg: 'bg-purple-50/50' },
        ].map((stat, i) => (
          <div key={i} className={`p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-500 ${stat.bg}`}>
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                {stat.icon}
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{stat.val}</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              {React.cloneElement(stat.icon as any, { size: 100 })}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white/70 glass p-10 rounded-[2.5rem] border border-slate-200/50 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Priority Listings</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">High-activity roles requiring immediate screening.</p>
            </div>
            <button 
              onClick={() => setCurrentView('jobs')}
              className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1"
            >
              View all <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {jobs.slice(0, 2).map(job => (
              <JobCard 
                key={job.id} 
                job={job} 
                candidateCount={scores.filter(s => s.jobId === job.id).length}
                onClick={() => handleJobClick(job.id)}
                onDelete={() => setJobToDelete(job)}
              />
            ))}
            {jobs.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white/30">
                <Briefcase className="mx-auto text-slate-300 mb-4" size={48} />
                <p className="text-slate-400 font-bold">No active roles found.</p>
                <button 
                  onClick={() => setCurrentView('create-job')}
                  className="mt-4 text-blue-600 font-bold hover:underline text-sm"
                >
                  Create your first requisition
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0f172a] p-10 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <h3 className="font-black text-xl mb-8 flex items-center gap-3">
            <Activity size={20} className="text-blue-400" />
            System Monitor
          </h3>
          <div className="space-y-8">
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Sync Status</p>
                <p className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  Real-time Active
                </p>
              </div>
              <Activity size={24} className="text-slate-700" />
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Parsing Throughput</p>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={Array.from({length: 10}).map((_, i) => ({val: Math.floor(Math.random() * 50) + 20}))}>
                    <Area type="monotone" dataKey="val" stroke="#3b82f6" fill="rgba(59, 130, 246, 0.1)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="pt-6 border-t border-white/5 space-y-4">
               <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                 <span>API Usage</span>
                 <span>84%</span>
               </div>
               <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-500 w-[84%]"></div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderJobsView = () => {
    const filteredJobs = jobs.filter(j => 
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      j.department.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Role Management</h2>
            <p className="text-slate-500 font-medium">Oversee all active and archived job requisitions.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search listings..." 
                className="pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl w-full md:w-80 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setCurrentView('create-job')}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#0f172a] text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">New Listing</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredJobs.map(job => (
            <div key={job.id} className="relative group">
               <JobCard 
                job={job} 
                candidateCount={scores.filter(s => s.jobId === job.id).length}
                onClick={() => handleJobClick(job.id)}
                onDelete={() => setJobToDelete(job)}
              />
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                 <div className="bg-slate-900/90 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-2xl backdrop-blur-md">
                   Click to Manage Pipeline
                 </div>
              </div>
            </div>
          ))}
          {filteredJobs.length === 0 && (
            <div className="col-span-full py-40 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white/50">
              <Briefcase className="mx-auto text-slate-200 mb-6" size={64} />
              <p className="text-slate-500 font-bold text-lg">
                {searchQuery ? `No matches found for "${searchQuery}"` : "No job listings yet."}
              </p>
              {searchQuery ? (
                <button onClick={() => setSearchQuery('')} className="mt-4 text-blue-600 font-bold hover:underline">Clear search</button>
              ) : (
                <button onClick={() => setCurrentView('create-job')} className="mt-4 text-blue-600 font-bold hover:underline">Create your first role</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCandidatesView = () => {
    const filteredCandidates = candidates.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Talent Pool</h2>
            <p className="text-slate-500 font-medium">Explore and manage the entire cross-requisition database.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search talent (name, skill)..." 
                className="pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl w-full md:w-80 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-white/70 glass rounded-[3rem] border border-slate-200/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Candidate Info</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Expertise</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Experience</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCandidates.map(candidate => (
                  <tr key={candidate.id} className="group hover:bg-blue-50/30 transition-all duration-300">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                          {candidate.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-base">{candidate.name}</p>
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[150px]">{candidate.location || 'Global/Remote'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                        {candidate.skills.slice(0, 3).map(skill => (
                          <span key={skill} className="px-2.5 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-tight shadow-sm">
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 3 && (
                          <span className="text-[10px] text-blue-500 font-black px-1">+{candidate.skills.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                          <Clock size={14} className="text-blue-500" />
                          {candidate.totalYearsExperience}y
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[120px]">
                           {candidate.experience[0]?.title || 'No Title'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <a href={`mailto:${candidate.email}`} className="p-2.5 bg-white border border-slate-100 text-slate-400 hover:text-blue-500 hover:border-blue-200 rounded-xl transition-all shadow-sm"><Mail size={16} /></a>
                        {candidate.phone && <a href={`tel:${candidate.phone}`} className="p-2.5 bg-white border border-slate-100 text-slate-400 hover:text-emerald-500 hover:border-emerald-200 rounded-xl transition-all shadow-sm"><Phone size={16} /></a>}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => setSelectedCandidateId(candidate.id)}
                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all shadow-sm hover:shadow-md"
                      >
                        Full Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredCandidates.length === 0 && (
            <div className="py-40 text-center bg-white/50">
              <Users className="mx-auto text-slate-200 mb-6" size={64} />
              <p className="text-slate-500 font-bold text-lg">
                {searchQuery ? `No talent matches for "${searchQuery}"` : "Your talent database is empty."}
              </p>
              {searchQuery ? (
                <button onClick={() => setSearchQuery('')} className="mt-4 text-blue-600 font-bold hover:underline">Reset database filters</button>
              ) : (
                <p className="mt-2 text-slate-400 text-sm">Upload resumes in a job pipeline to populate the pool.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-700 pb-20">
      <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-xl space-y-12">
        <header className="flex items-center gap-4 border-b border-slate-50 pb-8">
          <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl">
            <Settings size={28} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">System Configuration</h3>
            <p className="text-slate-400 font-medium">Manage your recruiter profile and ATS logic parameters.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <section className="space-y-6">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <User size={16} className="text-blue-500" /> Identity Management
            </h4>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 ml-1">Full Name</label>
                <input 
                  type="text" 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                  value={settings.userName}
                  onChange={(e) => setSettings({...settings, userName: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 ml-1">Professional Role</label>
                <input 
                  type="text" 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                  value={settings.userRole}
                  onChange={(e) => setSettings({...settings, userRole: e.target.value})}
                />
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <BrainCircuit size={16} className="text-purple-500" /> Matching Intelligence
            </h4>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold text-slate-500 ml-1">Scoring Threshold</label>
                  <span className="text-lg font-black text-blue-600">{settings.scoringThreshold}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100"
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  value={settings.scoringThreshold}
                  onChange={(e) => setSettings({...settings, scoringThreshold: parseInt(e.target.value)})}
                />
                <p className="text-[10px] text-slate-400 font-medium">Candidates scoring below this value are marked as 'Non-Match'.</p>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-900">Auto-Archive Failures</p>
                  <p className="text-[10px] text-slate-400">Archive non-matches automatically.</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, autoArchive: !settings.autoArchive})}
                  className={`w-12 h-6 rounded-full relative transition-all ${settings.autoArchive ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.autoArchive ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Bell size={16} className="text-amber-500" /> Alert Preferences
            </h4>
            <div className="space-y-3">
              {[
                { id: 'email', label: 'Email Alerts', desc: 'New applicant notifications' },
                { id: 'browser', label: 'Push Notifications', desc: 'Real-time browser alerts' },
                { id: 'summary', label: 'Daily Intelligence', desc: 'Morning summary reports' },
              ].map(notif => (
                <div key={notif.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{notif.label}</p>
                    <p className="text-[10px] text-slate-400">{notif.desc}</p>
                  </div>
                  <button 
                    onClick={() => setSettings({
                      ...settings, 
                      notifications: { ...settings.notifications, [notif.id]: !settings.notifications[notif.id as keyof typeof settings.notifications] }
                    })}
                    className={`w-12 h-6 rounded-full relative transition-all ${settings.notifications[notif.id as keyof typeof settings.notifications] ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.notifications[notif.id as keyof typeof settings.notifications] ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Shield size={16} className="text-slate-600" /> Engine Infrastructure
            </h4>
            <div className="p-6 bg-[#0f172a] rounded-[2rem] text-white shadow-xl relative overflow-hidden group">
              <Code size={48} className="absolute -right-2 -bottom-2 text-white/5 group-hover:scale-110 transition-transform" />
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Primary Inference Node</p>
              <p className="text-lg font-bold truncate mb-4">{settings.aiModel}</p>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Globe size={14} className="text-emerald-400" /> Multi-regional Sync Active
              </div>
            </div>
          </section>
        </div>

        <footer className="pt-8 border-t border-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            <Clock size={14} /> Last synced: {new Date().toLocaleTimeString()}
          </div>
          <button 
            className="px-10 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-xl shadow-slate-200"
            onClick={() => setCurrentView('dashboard')}
          >
            Apply Changes
          </button>
        </footer>
      </div>
    </div>
  );

  const renderTalentReportModal = () => {
    if (!talentReport || !selectedJobId) return null;
    const job = jobs.find(j => j.id === selectedJobId);

    const handlePrintReport = () => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const content = `
        <html>
          <head>
            <title>Talent Intelligence Report - ${job?.title}</title>
            <style>
              body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
              h1 { color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
              .section { margin-bottom: 30px; }
              .label { font-weight: bold; text-transform: uppercase; font-size: 12px; color: #64748b; margin-bottom: 8px; display: block; }
              .health { font-size: 24px; font-weight: 800; color: #3b82f6; }
              ul { padding-left: 20px; }
              li { margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <h1>Talent Intelligence Report</h1>
            <div class="section">
              <span class="label">Job Requisition</span>
              <h2>${job?.title}</h2>
              <p>${job?.department} • ${job?.location}</p>
            </div>
            <div class="section">
              <span class="label">Pipeline Health Score</span>
              <div class="health">${talentReport.pipelineHealthScore}%</div>
            </div>
            <div class="section">
              <span class="label">Executive Summary</span>
              <p>${talentReport.summary}</p>
            </div>
            <div class="section">
              <span class="label">Identified Strengths</span>
              <ul>${talentReport.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
            </div>
            <div class="section">
              <span class="label">Strategic Weaknesses</span>
              <ul>${talentReport.weaknesses.map(w => `<li>${w}</li>`).join('')}</ul>
            </div>
            <div class="section">
              <span class="label">Hiring Recommendation</span>
              <p><strong>${talentReport.recommendation}</strong></p>
            </div>
            <script>window.print(); window.onafterprint = () => window.close();</script>
          </body>
        </html>
      `;
      printWindow.document.write(content);
      printWindow.document.close();
    };

    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                <FilePieChart size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">Pipeline Intelligence</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">{job?.title} Requisition</p>
              </div>
            </div>
            <button 
              onClick={() => setTalentReport(null)}
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-12 space-y-10">
            <div className="flex items-center gap-8 p-8 bg-blue-50 border border-blue-100 rounded-[2.5rem]">
              <div className="relative">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-blue-100" />
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 * (1 - talentReport.pipelineHealthScore / 100)} className="text-blue-600 transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-blue-900">
                  {talentReport.pipelineHealthScore}%
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-blue-900 font-black text-xl mb-1">Strategic Pipeline Health</h4>
                <p className="text-blue-700/70 font-medium">This score reflects the collective alignment of current candidates with the core requisition requirements.</p>
              </div>
            </div>

            <section className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Activity size={16} /> Executive Summary
              </h4>
              <p className="text-lg text-slate-700 font-medium leading-relaxed">{talentReport.summary}</p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <section className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                  <TrendingUp size={16} /> Key Strengths
                </h4>
                <ul className="space-y-3">
                  {talentReport.strengths.map((s, i) => (
                    <li key={i} className="flex gap-3 text-slate-600 font-medium p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                      <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                  <Target size={16} /> Core Gaps
                </h4>
                <ul className="space-y-3">
                  {talentReport.weaknesses.map((w, i) => (
                    <li key={i} className="flex gap-3 text-slate-600 font-medium p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                      <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      {w}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="p-8 bg-slate-900 rounded-[2.5rem] text-white">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                <Award size={16} className="text-blue-400" /> Final Recommendation
              </h4>
              <p className="text-xl font-bold leading-relaxed">{talentReport.recommendation}</p>
            </section>
          </div>

          <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-end gap-4">
            <button 
              onClick={() => setTalentReport(null)}
              className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all"
            >
              Close Intelligence
            </button>
            <button 
              onClick={handlePrintReport}
              className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <Printer size={18} /> Print Strategic Report
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderJobDetail = () => {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) return null;

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
        <button 
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Control Center
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2.5 h-full bg-blue-600"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">{job.title}</h2>
                  <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">{job.department} • {job.location}</p>
                </div>
                <div className="flex flex-col items-end">
                  <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl font-black text-sm border border-emerald-100 mb-2">
                    {job.salaryBand || 'N/A'}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Budget</span>
                </div>
              </div>
              
              <div className="prose prose-slate max-w-none mb-10">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                   <Activity size={14} /> Role Briefing
                </h4>
                <div className="text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">{job.description}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-50">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Required Credentials</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.requiredCertifications.length > 0 ? job.requiredCertifications.map(c => (
                      <span key={c} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-100 flex items-center gap-2">
                        <Award size={14} /> {c}
                      </span>
                    )) : <span className="text-slate-400 text-xs italic">No specific certifications required.</span>}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Experience & Education</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-700 text-sm font-bold">
                       <Clock size={16} className="text-blue-500" />
                       Min. {job.minYearsExperience} years relevant experience
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 text-sm font-bold">
                       <GraduationCap size={16} className="text-purple-500" />
                       {job.educationLevel} Degree or equivalent
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 mt-8 border-t border-slate-50">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Must-Have Skill Stack</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.requiredSkills.map(s => (
                      <span key={s} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg shadow-slate-200">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Secondary Advantages</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.niceToHaveSkills.map(s => (
                      <span key={s} className="px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-xs font-bold">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Pipeline Processing</h3>
                  <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest">{filteredScores.length} Profiles Analyzed</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98]">
                    <FileUp size={18} />
                    <span>Process Batch</span>
                    <input type="file" className="hidden" accept=".pdf,.txt,.docx,.png,.jpg,.jpeg" onChange={handleResumeUpload} disabled={isProcessing} />
                  </label>
                </div>
              </div>

              {isProcessing && (
                <div className="p-12 bg-blue-50/30 border border-blue-200 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-4 animate-pulse">
                  <div className="w-20 h-20 bg-white text-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-100">
                    <BrainCircuit size={40} className="animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900">Neural Network Analysis</h4>
                    <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto">Extracting multi-dimensional skill vectors and matching against job requirements using Gemini-3...</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {filteredScores.map(score => {
                  const candidate = candidates.find(c => c.id === score.candidateId);
                  if (!candidate) return null;
                  return (
                    <CandidateRow 
                      key={candidate.id}
                      candidate={candidate}
                      score={score}
                      onClick={() => setSelectedCandidateId(candidate.id)}
                      onTailor={(e) => {
                        e.stopPropagation();
                        handleTailorResume(candidate.id);
                      }}
                    />
                  );
                })}
                {filteredScores.length === 0 && !isProcessing && (
                  <div className="py-24 bg-white/50 border border-slate-100 border-dashed rounded-[2.5rem] text-center">
                    <Users className="mx-auto text-slate-200 mb-4" size={64} />
                    <p className="text-slate-400 font-bold text-lg">Your candidate pipeline is empty.</p>
                    <p className="text-slate-400 text-sm mt-1">Upload resumes to see intelligent matching results.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-[#0f172a] p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden sticky top-8">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8 flex items-center gap-2">
                <BrainCircuit size={16} className="text-blue-400" />
                Pipeline IQ
              </h4>
              <div className="space-y-8">
                <div className="flex items-center gap-6 p-6 bg-white/5 rounded-3xl border border-white/5">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 font-black text-2xl shadow-inner border border-blue-500/20">
                    {filteredScores.length > 0 
                      ? Math.round(filteredScores.reduce((acc, s) => acc + s.score.overallScore, 0) / filteredScores.length)
                      : 0}%
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Avg. Relevance</p>
                    <p className="text-lg font-bold text-white leading-tight">Match Quality</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Candidate Distribution</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Top Tier', val: filteredScores.filter(s => s.status === 'top_fit').length, col: 'bg-emerald-500' },
                      { label: 'Potential', val: filteredScores.filter(s => s.status === 'borderline').length, col: 'bg-amber-500' },
                      { label: 'Not Relevant', val: filteredScores.filter(s => s.status === 'not_suitable').length, col: 'bg-slate-600' }
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center group/dist">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${item.col} group-hover/dist:scale-150 transition-transform`}></div>
                          <span className="text-sm font-bold text-slate-400">{item.label}</span>
                        </div>
                        <span className="text-lg font-black text-white">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5">
                  <button 
                    onClick={handleGenerateReport}
                    disabled={isGeneratingReport || filteredScores.length === 0}
                    className="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingReport ? <Loader2 size={16} className="animate-spin" /> : <BarChart2 size={16} />}
                    {isGeneratingReport ? 'Processing Intelligence...' : 'Generate Talent Report'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCreateJob = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Discard Draft
        </button>
        <button 
          onClick={handleAiAutoFill}
          disabled={!jobForm.description || isAiParsingJob}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border shadow-lg ${
            isAiParsingJob 
            ? 'bg-slate-100 text-slate-400 animate-pulse' 
            : 'bg-purple-600 text-white border-purple-500 hover:bg-purple-700 shadow-purple-500/20'
          }`}
        >
          {isAiParsingJob ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} fill="currentColor" />}
          <span>{isAiParsingJob ? 'AI Extracting Requirements...' : 'AI Auto-Fill Requirement'}</span>
        </button>
      </div>

      <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-2xl space-y-12">
        <div className="space-y-6">
          <div className="flex items-center gap-4 mb-4">
             <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl">
               <Plus size={24} />
             </div>
             <div>
               <h3 className="text-3xl font-black text-slate-900 tracking-tight">Post New Requisition</h3>
               <p className="text-slate-400 font-medium">Define the core parameters for the AI matching engine.</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label htmlFor="job-title" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 cursor-pointer">Official Job Title</label>
              <input 
                required
                id="job-title"
                type="text" 
                placeholder="e.g. Lead Technical Architect"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                value={jobForm.title}
                onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="department" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 cursor-pointer">Target Department</label>
              <input 
                required
                id="department"
                type="text" 
                placeholder="e.g. Infrastructure & Cloud"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                value={jobForm.department}
                onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label htmlFor="location" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 cursor-pointer">Physical Location</label>
              <div className="relative">
                <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  id="location"
                  type="text" 
                  placeholder="e.g. Remote / New York, NY"
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                  value={jobForm.location}
                  onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="salary" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 cursor-pointer">Salary Band</label>
              <div className="relative">
                <DollarSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  id="salary"
                  type="text" 
                  placeholder="e.g. $140k - $180k"
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                  value={jobForm.salaryBand}
                  onChange={(e) => setJobForm({ ...jobForm, salaryBand: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label htmlFor="min-exp" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 cursor-pointer">Min. Experience (Years)</label>
              <div className="relative">
                <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  id="min-exp"
                  type="number" 
                  placeholder="e.g. 5"
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                  value={jobForm.minYearsExperience}
                  onChange={(e) => setJobForm({ ...jobForm, minYearsExperience: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="certs" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 cursor-pointer">Required Certifications</label>
              <div className="relative">
                <Award size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  id="certs"
                  type="text" 
                  placeholder="e.g. AWS Solutions Architect, PMP (Comma separated)"
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                  value={jobForm.requiredCertifications?.join(', ')}
                  onChange={(e) => setJobForm({ ...jobForm, requiredCertifications: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 cursor-pointer">Full Job Description</label>
            <textarea 
              required
              id="description"
              rows={10}
              placeholder="Paste the raw job description here. Our AI will automatically categorize requirements, skills, and experience bands."
              className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[2.5rem] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 leading-relaxed resize-none shadow-inner"
              value={jobForm.description}
              onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end pt-8 border-t border-slate-50">
          <button 
            onClick={handleCreateJob}
            disabled={!jobForm.title || !jobForm.description}
            className="px-12 py-5 bg-[#0f172a] text-white rounded-[2rem] font-black uppercase tracking-[0.15em] text-sm shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-3 hover:translate-y-[-2px]"
          >
            Finalize Posting
            <ArrowLeft size={18} className="rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );

  if (!currentUser) {
    return renderAuthView();
  }

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <Sidebar 
        currentView={currentView} 
        onViewChange={(view) => {
          setCurrentView(view);
          setSearchQuery(''); 
        }} 
        onSignOut={handleSignOut}
        tier={tier}
        trial={trial}
      />
      
      <main className="flex-1 ml-64 p-12 overflow-x-hidden transition-all duration-500">
        {tier === 'free' && trial.isExpired && renderExpirationModal()}

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border shadow-sm ${
                tier === 'pro' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-indigo-100' : 'bg-blue-50 text-blue-600 border-blue-100 shadow-blue-100'
              }`}>
                {tier === 'pro' ? (
                  <div className="flex items-center gap-2"><Zap size={10} fill="currentColor" /> Pro Engine Active</div>
                ) : (
                  `Evaluation Period: ${trial.daysRemaining} days remaining`
                )}
              </span>
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">
              {currentView === 'dashboard' ? 'Control Center' : 
               currentView === 'create-job' ? 'New Requisition' : 
               currentView === 'job-detail' ? 'Pipeline Analysis' : 
               currentView === 'billing' ? 'Licensing & Tier' :
               currentView === 'settings' ? 'System Settings' :
               currentView === 'jobs' ? 'Active Roles' : 
               currentView === 'resume-builder' ? 'AI Resume Builder' : 'Talent Ecosystem'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             {currentView !== 'resume-builder' && (
               <button 
                 onClick={() => setCurrentView('resume-builder')}
                 className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
               >
                 <PencilRuler size={18} className="text-blue-500" />
                 <span>Resume Builder</span>
               </button>
             )}
             <button 
               onClick={() => setCurrentView('billing')}
               className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
             >
               <CreditCard size={18} />
               <span>Manage Licensing</span>
             </button>
             {currentView !== 'create-job' && (
               <button 
                  onClick={() => setCurrentView('create-job')}
                  className="group flex items-center gap-2 px-8 py-4 bg-[#0f172a] text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-slate-200 hover:scale-[1.02] transition-all hover:bg-slate-800"
               >
                 <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                 <span>Post Requisition</span>
               </button>
             )}
          </div>
        </header>

        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'job-detail' && renderJobDetail()}
        {currentView === 'create-job' && renderCreateJob()}
        {currentView === 'billing' && renderBilling()}
        {currentView === 'jobs' && renderJobsView()}
        {currentView === 'candidates' && renderCandidatesView()}
        {currentView === 'settings' && renderSettings()}
        {currentView === 'resume-builder' && <ResumeBuilder onComplete={() => setCurrentView('billing')} />}
        
        {renderTailoringModal()}
        {renderCandidateProfileModal()}
        {renderDeleteConfirmationModal()}
        {renderTalentReportModal()}
      </main>

      <AIAssistAgent context={aiContext} />
    </div>
  );
};

export default App;
