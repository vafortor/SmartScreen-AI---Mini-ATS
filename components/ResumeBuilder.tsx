
import React, { useState, useRef } from 'react';
import { User, Mail, Phone, MapPin, Sparkles, Plus, Trash2, GraduationCap, Briefcase, ChevronRight, Download, Loader2, Zap, Rocket, FileUp, Target, Wand2 } from 'lucide-react';
import { ResumeBuilderData, Experience } from '../types';
import { enhanceResumeContent, parseResume, tailorResumeBuilderData } from '../geminiService';

interface ResumeBuilderProps {
  onComplete: () => void;
}

const ResumeBuilder: React.FC<ResumeBuilderProps> = ({ onComplete }) => {
  const [data, setData] = useState<ResumeBuilderData>({
    name: '',
    email: '',
    phone: '',
    location: '',
    summary: '',
    skills: [''],
    experience: [{ title: '', company: '', duration: '', description: '' }],
    education: ['']
  });

  const [isEnhancing, setIsEnhancing] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [targetJobDescription, setTargetJobDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const base64Data = await fileToBase64(file);
      const parsed = await parseResume(base64Data, file.type);
      
      setData({
        name: parsed.name || '',
        email: parsed.email || '',
        phone: parsed.phone || '',
        location: parsed.location || '',
        summary: parsed.summary || '',
        skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : [''],
        experience: parsed.experience && parsed.experience.length > 0 ? parsed.experience : [{ title: '', company: '', duration: '', description: '' }],
        education: parsed.education && parsed.education.length > 0 ? parsed.education : ['']
      });
    } catch (error) {
      console.error("Parsing failed:", error);
      alert("Failed to parse resume. Please ensure it's a valid PDF or Image.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleTailorToJob = async () => {
    if (!targetJobDescription.trim()) return;
    setIsTailoring(true);
    try {
      const tailoredData = await tailorResumeBuilderData(data, targetJobDescription);
      setData(tailoredData);
      alert("Resume strategically tailored to the target job description!");
    } catch (error) {
      console.error("Tailoring failed:", error);
      alert("Tailoring failed. Please try again.");
    } finally {
      setIsTailoring(false);
    }
  };

  const handleMagicEnhance = async (type: 'summary' | 'experience', index?: number) => {
    const content = type === 'summary' ? data.summary : data.experience[index!].description;
    if (!content.trim()) return;

    const loadingId = `${type}-${index ?? 'main'}`;
    setIsEnhancing(loadingId);

    try {
      const enhanced = await enhanceResumeContent(type, content);
      if (type === 'summary') {
        setData({ ...data, summary: enhanced });
      } else {
        const newExp = [...data.experience];
        newExp[index!].description = enhanced;
        setData({ ...data, experience: newExp });
      }
    } catch (error) {
      console.error("Enhancement failed:", error);
    } finally {
      setIsEnhancing(null);
    }
  };

  const updateExperience = (index: number, field: keyof Experience, value: string) => {
    const newExp = [...data.experience];
    newExp[index] = { ...newExp[index], [field]: value };
    setData({ ...data, experience: newExp });
  };

  const addExperience = () => {
    setData({ ...data, experience: [...data.experience, { title: '', company: '', duration: '', description: '' }] });
  };

  const removeExperience = (index: number) => {
    const newExp = data.experience.filter((_, i) => i !== index);
    setData({ ...data, experience: newExp });
  };

  const updateSkill = (index: number, value: string) => {
    const newSkills = [...data.skills];
    newSkills[index] = value;
    setData({ ...data, skills: newSkills });
  };

  const addSkill = () => setData({ ...data, skills: [...data.skills, ''] });
  const removeSkill = (index: number) => setData({ ...data, skills: data.skills.filter((_, i) => i !== index) });

  const updateEducation = (index: number, value: string) => {
    const newEdu = [...data.education];
    newEdu[index] = value;
    setData({ ...data, education: newEdu });
  };

  const addEducation = () => setData({ ...data, education: [...data.education, ''] });
  const removeEducation = (index: number) => setData({ ...data, education: data.education.filter((_, i) => i !== index) });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Editor Section */}
      <div className="space-y-8 h-full">
        {/* Fast Import Section */}
        <section className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-blue-500/10 group-hover:scale-110 transition-transform">
            <FileUp size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="text-xl font-black text-white tracking-tight mb-2">Fast Track: Import PDF</h3>
            <p className="text-slate-400 text-sm font-medium mb-6">Already have a resume? Upload it and our AI will pre-populate the fields for you.</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20"
            >
              {isParsing ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
              {isParsing ? 'Processing Intelligence...' : 'Upload Existing Resume'}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".pdf,.png,.jpg,.jpeg,.txt" 
              onChange={handleFileUpload}
            />
          </div>
        </section>

        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <User size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Identity Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <input 
                type="text" 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold"
                value={data.name}
                onChange={(e) => setData({...data, name: e.target.value})}
                placeholder="Alex Mercer"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <input 
                type="email" 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold"
                value={data.email}
                onChange={(e) => setData({...data, email: e.target.value})}
                placeholder="alex@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone</label>
              <input 
                type="text" 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold"
                value={data.phone}
                onChange={(e) => setData({...data, phone: e.target.value})}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Location</label>
              <input 
                type="text" 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold"
                value={data.location}
                onChange={(e) => setData({...data, location: e.target.value})}
                placeholder="San Francisco, CA"
              />
            </div>
          </div>
        </section>

        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Executive Bio</h3>
            </div>
            <button 
              onClick={() => handleMagicEnhance('summary')}
              disabled={isEnhancing !== null || !data.summary}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
            >
              {isEnhancing === 'summary-main' ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} fill="white" />}
              AI Enhance
            </button>
          </div>
          <textarea 
            rows={5}
            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-purple-500/10 font-medium leading-relaxed resize-none"
            value={data.summary}
            onChange={(e) => setData({...data, summary: e.target.value})}
            placeholder="Write a few lines about your professional journey..."
          />
        </section>

        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Briefcase size={20} />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Experience</h3>
            </div>
            <button 
              onClick={addExperience}
              className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            >
              <Plus size={20} />
            </button>
          </div>
          
          <div className="space-y-12">
            {data.experience.map((exp, i) => (
              <div key={i} className="space-y-6 relative pl-6 border-l-2 border-slate-100">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-white"></div>
                <div className="flex justify-between items-start">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                      <input 
                        className="bg-transparent border-b border-slate-100 py-1 font-black text-slate-900 outline-none focus:border-blue-500" 
                        placeholder="Job Title" 
                        value={exp.title}
                        onChange={(e) => updateExperience(i, 'title', e.target.value)}
                      />
                      <input 
                        className="bg-transparent border-b border-slate-100 py-1 font-bold text-slate-500 outline-none focus:border-blue-500" 
                        placeholder="Company" 
                        value={exp.company}
                        onChange={(e) => updateExperience(i, 'company', e.target.value)}
                      />
                   </div>
                   <button onClick={() => removeExperience(i)} className="text-slate-300 hover:text-red-500 transition-colors ml-4">
                      <Trash2 size={16} />
                   </button>
                </div>
                <input 
                  className="w-full bg-transparent border-b border-slate-100 py-1 text-xs font-bold text-slate-400 outline-none focus:border-blue-500" 
                  placeholder="Duration (e.g. Jan 2020 - Present)" 
                  value={exp.duration}
                  onChange={(e) => updateExperience(i, 'duration', e.target.value)}
                />
                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Key Accomplishments</span>
                     <button 
                        onClick={() => handleMagicEnhance('experience', i)}
                        disabled={isEnhancing !== null || !exp.description}
                        className="text-[10px] font-black text-purple-600 hover:text-purple-700 flex items-center gap-1 disabled:opacity-50"
                      >
                        {isEnhancing === `experience-${i}` ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} fill="currentColor" />}
                        AI REWRITE
                      </button>
                   </div>
                   <textarea 
                    rows={4}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-medium text-sm leading-relaxed resize-none"
                    placeholder="List your key contributions and results..."
                    value={exp.description}
                    onChange={(e) => updateExperience(i, 'description', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tailor to Job Section */}
        <section className="bg-gradient-to-br from-indigo-600 to-purple-700 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-white/5">
            <Target size={140} />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                <Wand2 size={24} />
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">Strategic Tailoring</h3>
            </div>
            <p className="text-white/70 text-sm font-medium leading-relaxed">Paste a target job description below. Our AI will automatically rewrite your bio and experience points to mirror the role requirements and high-priority keywords.</p>
            <textarea 
              rows={6}
              className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-[2rem] outline-none focus:ring-4 focus:ring-white/10 font-medium text-white placeholder-white/30 leading-relaxed resize-none shadow-inner"
              value={targetJobDescription}
              onChange={(e) => setTargetJobDescription(e.target.value)}
              placeholder="Paste the target job description here..."
            />
            <button 
              onClick={handleTailorToJob}
              disabled={isTailoring || !targetJobDescription.trim()}
              className="w-full py-5 bg-white text-indigo-700 rounded-2xl font-black uppercase tracking-[0.15em] text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isTailoring ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} fill="currentColor" />}
              {isTailoring ? 'Re-engineering Profile...' : 'Tailor Resume for this Job'}
            </button>
          </div>
        </section>
      </div>

      {/* Preview Section */}
      <div className="sticky top-12 h-[calc(100vh-10rem)] flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            Real-time Profile Preview
          </p>
          <div className="flex gap-3">
             <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                <Download size={14} /> Download PDF
             </button>
             <button 
               onClick={onComplete}
               className="flex items-center gap-2 px-6 py-2.5 bg-[#0f172a] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200"
             >
                Test Match Score <ChevronRight size={14} />
             </button>
          </div>
        </div>

        <div className="flex-1 bg-white shadow-2xl rounded-[3rem] border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-12 border-b-8 border-slate-900 bg-slate-50">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">{data.name || 'Your Name'}</h1>
            <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-500">
               <span className="flex items-center gap-1.5"><Mail size={12} className="text-blue-500" /> {data.email || 'email@example.com'}</span>
               <span className="flex items-center gap-1.5"><Phone size={12} className="text-blue-500" /> {data.phone || 'Phone'}</span>
               <span className="flex items-center gap-1.5"><MapPin size={12} className="text-blue-500" /> {data.location || 'Location'}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-12 space-y-10 scrollbar-hide">
            {data.summary && (
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4">Strategic Summary</h4>
                <p className="text-sm font-medium leading-relaxed text-slate-600 italic">"{data.summary}"</p>
              </section>
            )}

            <section>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-6">Professional Experience</h4>
              <div className="space-y-8">
                {data.experience.map((exp, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <h5 className="font-black text-slate-900 text-lg">{exp.title || 'Position Title'}</h5>
                      <span className="text-[10px] font-bold text-slate-400">{exp.duration}</span>
                    </div>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{exp.company || 'Organization'}</p>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium whitespace-pre-wrap">{exp.description || 'Describe your high-impact contributions...'}</p>
                  </div>
                ))}
              </div>
            </section>

            {data.skills.some(s => s.trim()) && (
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4">Skill Stack</h4>
                <div className="flex flex-wrap gap-2">
                  {data.skills.map((skill, i) => skill.trim() && (
                    <span key={i} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="p-12 bg-indigo-600 text-white rounded-t-[3rem]">
             <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                   <Rocket size={24} />
                </div>
                <div>
                   <h4 className="font-black text-lg tracking-tight">Unlock AI Screening</h4>
                   <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Available with Enterprise Pro</p>
                </div>
             </div>
             <p className="text-sm font-medium leading-relaxed mb-6 opacity-90">
               Build your resume for free, but see the truth about your application. Subscribe to run this resume through our neural matching engine.
             </p>
             <button 
                onClick={onComplete}
                className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-all shadow-xl"
             >
                Upgrade to Match with Jobs
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeBuilder;
