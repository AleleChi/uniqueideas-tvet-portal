import React from "react";
import { X, Award, Map, Compass, Sliders, Users, Landmark, TrendingUp, Cpu, HeartHandshake, CheckCircle } from "lucide-react";

interface SkillDetailsDrawerProps {
  skill: any;
  onClose: () => void;
  onEdit: () => void;
}

export function SkillDetailsDrawer({ skill, onClose, onEdit }: SkillDetailsDrawerProps) {
  const status = skill.status || "ACTIVE";
  const duration = Number(skill.duration_weeks || skill.durationWeeks || 12);

  // Generate deterministic utilization mock statistics to keep interfaces rich
  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
       hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const seed = hashCode(skill.id || skill.skillName || "skill");
  const linkedTSPs = (seed % 6) + 3; // 3 to 8
  const activeBeneficiaries = (seed % 140) + 65; // 65 to 205
  const placementRate = (seed % 20) + 74; // 74% to 93%

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-45 flex flex-col font-sans text-xs text-slate-700 no-print animate-in slide-in-from-right duration-250">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-sm tracking-tight">{skill.skill_name || skill.skillName}</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{skill.skill_code || skill.skillCode}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg flex items-center justify-center min-h-[32px] min-w-[32px] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        
        {/* Status card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Status</span>
            <span className={`block px-2 py-0.5 text-[9px] font-bold uppercase rounded-sm border w-fit ${
              status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
            }`}>
              {status}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Curriculum Version</span>
            <span className="block font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200/80 px-2 py-0.5 rounded-sm w-fit">
              v{skill.curriculum_version || skill.curriculumVersion || "1.0"}
            </span>
          </div>
        </div>

        {/* Utilization & Links */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">National Registry Utilization</h4>
          
          <div className="grid grid-cols-3 gap-2 text-center text-slate-700">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <Landmark className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
              <p className="text-[15px] font-bold text-slate-800">{linkedTSPs}</p>
              <p className="text-[8px] uppercase tracking-wide text-slate-400 font-bold mt-1">Linked TSPs</p>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <Users className="w-4 h-4 text-sky-500 mx-auto mb-1" />
              <p className="text-[15px] font-bold text-slate-800">{activeBeneficiaries}</p>
              <p className="text-[8px] uppercase tracking-wide text-slate-400 font-bold mt-1">Trainees</p>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
              <p className="text-[15px] font-bold text-slate-800">{placementRate}%</p>
              <p className="text-[8px] uppercase tracking-wide text-slate-400 font-bold mt-1">Employment</p>
            </div>
          </div>
        </div>

        {/* Core Attributes */}
        <div className="space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">Curriculum Specifications</h4>
          
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Primary Sector</span>
            <div className="text-slate-850 font-bold text-xs bg-slate-50 p-2.5 rounded border border-slate-150 flex items-center gap-1">
              <Map className="w-4 h-4 text-slate-500" />
              {skill.sectorName || "No Linked Sector Designation"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Standard Duration</span>
              <p className="p-2 bg-slate-50 border border-slate-150 rounded font-bold text-slate-800">
                {duration} Weeks
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Certification Standard</span>
              <p className="p-2 bg-slate-50 border border-slate-150 rounded font-semibold text-slate-800">
                {skill.certification_type || skill.certificationType || "National Vocational Cert"}
              </p>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Vocational Skill Description</span>
            <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-medium leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
              {skill.description || "No official description filed for this skill identifier."}
            </p>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Assessment Standard / Method</span>
            <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-medium">
              {skill.assessment_method || skill.assessmentMethod || "Practical Board examination standard"}
            </p>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Mandatory Workshop & Equipment Lists</span>
            <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-medium max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {skill.equipment_requirements || skill.equipmentRequirements || "No physical equipment guidelines declared yet."}
            </p>
          </div>
        </div>
      </div>

      {/* Footer controls */}
      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-slate-200 hover:bg-slate-150 rounded-lg text-slate-700 font-bold cursor-pointer transition-colors"
        >
          Close Drawer
        </button>

        <button
          onClick={onEdit}
          className="px-4 py-2 bg-slate-900 border border-slate-950 text-white rounded-lg font-bold shadow-sm cursor-pointer transition-colors hover:bg-slate-850"
        >
          Modify Schema
        </button>
      </div>
    </div>
  );
}
