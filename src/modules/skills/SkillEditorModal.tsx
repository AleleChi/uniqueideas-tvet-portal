import React, { useState, useEffect } from "react";
import { X, Award, Map, Settings, Play } from "lucide-react";

interface SkillEditorModalProps {
  skill: any | null; // null if creating a new skill
  sectors: any[];
  onClose: () => void;
  onSave: (skillData: any) => Promise<void>;
}

export function SkillEditorModal({ skill, sectors, onClose, onSave }: SkillEditorModalProps) {
  const [skillCode, setSkillCode] = useState(skill?.skill_code || skill?.skillCode || "");
  const [skillName, setSkillName] = useState(skill?.skill_name || skill?.skillName || "");
  const [sectorId, setSectorId] = useState(skill?.sector_id || skill?.sectorId || "");
  const [description, setDescription] = useState(skill?.description || "");
  const [durationWeeks, setDurationWeeks] = useState<number>(Number(skill?.duration_weeks || skill?.durationWeeks || 12));
  const [certificationType, setCertificationType] = useState(skill?.certification_type || skill?.certificationType || "National Certification II");
  const [assessmentMethod, setAssessmentMethod] = useState(skill?.assessment_method || skill?.assessmentMethod || "Practical Practical Demonstration / MCQ");
  const [equipmentRequirements, setEquipmentRequirements] = useState(skill?.equipment_requirements || skill?.equipmentRequirements || "");
  const [curriculumVersion, setCurriculumVersion] = useState(skill?.curriculum_version || skill?.curriculumVersion || "1.0");
  const [status, setStatus] = useState(skill?.status || "ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!skill && sectors.length > 0) {
      setSectorId(sectors[0].id);
    }
  }, [sectors, skill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillCode || !skillName || !sectorId) {
      setError("Please fill in code, name, and sector.");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const payload = {
      id: skill?.id,
      skillCode,
      skillName,
      sectorId,
      description,
      durationWeeks,
      certificationType,
      assessmentMethod,
      equipmentRequirements,
      curriculumVersion,
      status
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save skill schema.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 font-sans no-print animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm tracking-tight text-white">
              {skill ? `Edit Skill: ${skillName}` : "Register National Vocational Skill"}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 text-slate-400 hover:text-white rounded-lg flex items-center justify-center min-h-[32px] min-w-[32px] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-700 max-h-[80vh]">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 font-semibold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label htmlFor="skill-code-inp" className="block font-bold text-slate-600 mb-1">Skill Code *</label>
              <input
                id="skill-code-inp"
                type="text"
                placeholder="e.g. SK-ICT-01"
                value={skillCode}
                onChange={(e) => setSkillCode(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-600 font-mono font-bold uppercase text-xs"
                required
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="skill-name-inp" className="block font-bold text-slate-600 mb-1">Official Skill Name *</label>
              <input
                id="skill-name-inp"
                type="text"
                placeholder="e.g. Domestic Electrical Installation"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-600 text-xs font-semibold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="skill-sector-sel" className="block font-bold text-slate-600 mb-1">Primary Sector *</label>
              <select
                id="skill-sector-sel"
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-600 bg-white"
                required
              >
                {sectors.map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {sec.sector_name || sec.sectorName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="skill-dur-inp" className="block font-bold text-slate-600 mb-1">Standard Duration (Weeks)</label>
              <input
                id="skill-dur-inp"
                type="number"
                min="1"
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-600 font-semibold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="skill-cert-inp" className="block font-bold text-slate-600 mb-1">Certification Standard</label>
              <input
                id="skill-cert-inp"
                type="text"
                placeholder="e.g. NBTE cert, NITDA"
                value={certificationType}
                onChange={(e) => setCertificationType(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div>
              <label htmlFor="skill-assess-inp" className="block font-bold text-slate-600 mb-1">Assessment Standard/Method</label>
              <input
                id="skill-assess-inp"
                type="text"
                placeholder="e.g. MCQ and practical project"
                value={assessmentMethod}
                onChange={(e) => setAssessmentMethod(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="skill-curric-inp" className="block font-bold text-slate-600 mb-1">Curriculum Version</label>
              <input
                id="skill-curric-inp"
                type="text"
                placeholder="1.0"
                value={curriculumVersion}
                onChange={(e) => setCurriculumVersion(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div>
              <label htmlFor="skill-status-sel" className="block font-bold text-slate-600 mb-1">Status</label>
              <select
                id="skill-status-sel"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden bg-white"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="skill-desc-inp" className="block font-bold text-slate-600 mb-1">Vocational Skill Description</label>
            <textarea
              id="skill-desc-inp"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Primary duties, learning objectives, competencies, and sector industrial fits."
              className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden h-20 resize-none"
            />
          </div>

          <div>
            <label htmlFor="skill-equip-inp" className="block font-bold text-slate-600 mb-1">Mandatory Workshop & Equipment Requirements</label>
            <textarea
              id="skill-equip-inp"
              value={equipmentRequirements}
              onChange={(e) => setEquipmentRequirements(e.target.value)}
              placeholder="e.g. Multi-meters, soldering irons, safety wear, structural wiring boards."
              className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden h-20 resize-none"
            />
          </div>

          {/* Quick decision defaults */}
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                setDurationWeeks(12);
                setCertificationType("National Vocational Certificate II");
                setAssessmentMethod("Continuous assessment (30%) + Practical Board Exam (70%)");
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-[9px] hover:bg-slate-100"
            >
              NVC-II Standard Defaults
            </button>
            <button
              type="button"
              onClick={() => {
                setDurationWeeks(24);
                setCertificationType("NBTE Modular National Diploma");
                setAssessmentMethod("Integrated Project + External Industrial Assessor Audit");
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-[9px] hover:bg-slate-100"
            >
              MND Advanced Defaults
            </button>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-900 border border-slate-950 text-white hover:bg-slate-800 font-bold rounded-lg cursor-pointer flex items-center gap-1 shadow-sm"
            >
              {isSubmitting ? "Saving..." : "Save Schema"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
