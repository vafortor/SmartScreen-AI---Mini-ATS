import React from 'react';
import { MapPin, Users, Calendar, ArrowUpRight, Trash2 } from 'lucide-react';
import { Job } from '../types';

interface JobCardProps {
  job: Job;
  candidateCount: number;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, candidateCount, onClick, onDelete }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1.5 transition-all duration-500 cursor-pointer group relative overflow-hidden flex flex-col h-full"
    >
      <div className="absolute top-0 right-0 p-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {onDelete && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
            className="p-2 bg-red-50 text-red-500 rounded-full shadow-sm hover:bg-red-500 hover:text-white transition-all"
            title="Delete Listing"
          >
            <Trash2 size={16} />
          </button>
        )}
        <div className="p-2 bg-blue-50 text-blue-600 rounded-full shadow-sm">
          <ArrowUpRight size={16} />
        </div>
      </div>

      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">
              {job.department}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight pr-12">
            {job.title}
          </h3>
        </div>
      </div>

      <div className="space-y-3 mb-auto">
        <div className="flex items-center gap-2.5 text-slate-500 text-sm font-medium">
          <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
            <MapPin size={14} />
          </div>
          <span>{job.location}</span>
        </div>
        <div className="flex items-center gap-2.5 text-slate-500 text-sm font-medium">
          <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
            <Users size={14} />
          </div>
          <span>{candidateCount} Applicants</span>
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-slate-50 flex items-center justify-between">
        <div className="flex -space-x-2">
          {job.requiredSkills.slice(0, 3).map((skill) => (
            <div 
              key={skill} 
              className="px-2 py-1 bg-white border border-slate-100 text-slate-500 rounded-md text-[9px] font-bold uppercase tracking-widest shadow-sm"
              title={skill}
            >
              {skill}
            </div>
          ))}
          {job.requiredSkills.length > 3 && (
            <div className="w-7 h-6 flex items-center justify-center bg-slate-50 text-slate-400 text-[10px] font-bold border border-slate-100 rounded-md">
              +{job.requiredSkills.length - 3}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold">
          <Calendar size={12} />
          {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
};

export default JobCard;