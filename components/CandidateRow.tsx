
import React from 'react';
import { AlertCircle, CheckCircle, ChevronRight, Info, Sparkles, Zap, GraduationCap, Briefcase } from 'lucide-react';
import { Candidate, CandidateScore } from '../types';

interface CandidateRowProps {
  candidate: Candidate;
  score: CandidateScore;
  onClick: () => void;
  onTailor: (e: React.MouseEvent) => void;
}

const CandidateRow: React.FC<CandidateRowProps> = ({ candidate, score, onClick, onTailor }) => {
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'top_fit':
        return { 
          bg: 'bg-emerald-50', 
          text: 'text-emerald-700', 
          border: 'border-emerald-100', 
          icon: <CheckCircle className="text-emerald-500" size={16} />,
          label: 'Top Talent'
        };
      case 'borderline':
        return { 
          bg: 'bg-amber-50', 
          text: 'text-amber-700', 
          border: 'border-amber-100', 
          icon: <AlertCircle className="text-amber-500" size={16} />,
          label: 'Waitlist'
        };
      default:
        return { 
          bg: 'bg-slate-50', 
          text: 'text-slate-500', 
          border: 'border-slate-200', 
          icon: <AlertCircle className="text-slate-400" size={16} />,
          label: 'Non-Match'
        };
    }
  };

  const statusStyles = getStatusStyles(score.status);
  const scoreColor = score.score.overallScore >= 80 ? 'text-emerald-600' : score.score.overallScore >= 60 ? 'text-amber-600' : 'text-slate-500';
  const scoreBg = score.score.overallScore >= 80 ? 'bg-emerald-500' : score.score.overallScore >= 60 ? 'bg-amber-500' : 'bg-slate-400';

  const mostRecentJob = candidate.experience && candidate.experience.length > 0 
    ? candidate.experience[0].title 
    : 'No experience listed';

  return (
    <div 
      onClick={onClick}
      className="group relative bg-white border border-slate-100 rounded-2xl p-5 hover:border-blue-300 hover:shadow-[0_10px_30px_rgba(59,130,246,0.05)] transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {score.hasTailoringPotential && (
        <div className="absolute top-0 right-0 pl-3 pr-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.15em] rounded-bl-2xl flex items-center gap-1.5 shadow-xl shadow-purple-500/10 z-10">
          <Zap size={10} fill="currentColor" className="animate-pulse" />
          Reframing Potential
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-5 flex-1 min-w-0">
          <div className="relative">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-lg transition-transform duration-500 group-hover:scale-105 ${scoreBg}`}>
              {Math.round(score.score.overallScore)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-md border border-slate-50">
              <TrendingUp size={12} className={scoreColor} />
            </div>
          </div>
          
          <div className="flex-1 min-w-0 space-y-1">
            <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate text-base">
              {candidate.name}
            </h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 text-slate-600 font-bold">
                <Briefcase size={14} className="text-blue-400" /> {mostRecentJob}
              </span>
              <span className="w-1 h-1 bg-slate-300 rounded-full hidden sm:block"></span>
              <span className="flex items-center gap-1">
                <GraduationCap size={14} /> {candidate.education[0]?.substring(0, 20)}...
              </span>
              <span className="w-1 h-1 bg-slate-300 rounded-full hidden sm:block"></span>
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                {candidate.totalYearsExperience}y Exp.
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 self-end md:self-center">
          <button 
            onClick={onTailor}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              score.hasTailoringPotential 
              ? 'bg-[#8b5cf6] text-white border-[#7c3aed] hover:bg-[#7c3aed] shadow-lg shadow-purple-500/20' 
              : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100'
            }`}
          >
            <Sparkles size={14} className={score.hasTailoringPotential ? 'animate-spin-slow' : ''} />
            Tailor Bio
          </button>

          <div className="hidden lg:block w-px h-10 bg-slate-100"></div>

          <div className="hidden lg:flex flex-col items-center w-28">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${statusStyles.bg} ${statusStyles.text} ${statusStyles.border} text-[10px] font-black uppercase tracking-wider`}>
              {statusStyles.icon}
              {statusStyles.label}
            </div>
          </div>

          <div className="p-2 text-slate-300 group-hover:text-blue-500 transition-colors group-hover:translate-x-1 duration-300">
            <ChevronRight size={20} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-50/50">
        {score.mismatchReason && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold border flex-1 md:flex-initial ${
            score.status === 'borderline' ? 'bg-amber-50/30 border-amber-100 text-amber-800' : 'bg-slate-50/50 border-slate-100 text-slate-500'
          }`}>
            <Info size={14} className="opacity-70" />
            <span className="truncate">{score.mismatchReason}</span>
          </div>
        )}
        
        {score.transferableSkills && score.transferableSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {score.transferableSkills.slice(0, 3).map((skill, i) => (
              <span key={i} className="px-2.5 py-1 bg-white border border-slate-100 text-blue-500 rounded-lg text-[10px] font-bold uppercase tracking-tight shadow-sm">
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TrendingUp = ({ size, className }: { size: number; className?: string }) => (
  <svg 
    width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);

export default CandidateRow;
