import React, { useState } from "react";
import { 
  FolderOpen, Search, UploadCloud, FileText, CheckCircle2, AlertCircle, 
  Trash2, ShieldCheck, Download, ExternalLink, Filter, HelpCircle 
} from "lucide-react";

interface DocumentMeta {
  id: string;
  name: string;
  type: "SLA" | "BIOMETRIC_PRESET" | "LICENSE" | "DECLARATION" | "REPORT" | "LOG";
  size: string;
  uploadedAt: string;
  uploadedBy: string;
  status: "VERIFIED" | "PENDING" | "REJECTED";
  securityLevel: "REGULATORY" | "HIGH_ENCRYPTED" | "PUBLIC_AUDIT";
}

export default function DocumentsCenter() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([
    {
      id: "doc-001",
      name: "National SLA Agreement - Federal TVET Board.pdf",
      type: "SLA",
      size: "2.4 MB",
      uploadedAt: "2026-06-11T14:32:00Z",
      uploadedBy: "Dr. Aliyu Benson (FED)",
      status: "VERIFIED",
      securityLevel: "HIGH_ENCRYPTED"
    },
    {
      id: "doc-002",
      name: "Biometric Approval Protocol Certification - Kaduna Gateway.pdf",
      type: "BIOMETRIC_PRESET",
      size: "1.2 MB",
      uploadedAt: "2026-06-10T09:15:00Z",
      uploadedBy: "Engr. Fatima Musa (KAD)",
      status: "VERIFIED",
      securityLevel: "HIGH_ENCRYPTED"
    },
    {
      id: "doc-003",
      name: "Physical NBTE License Certificate - National TVET Hub.pdf",
      type: "LICENSE",
      size: "4.1 MB",
      uploadedAt: "2026-06-08T17:45:00Z",
      uploadedBy: "Dr. Aliyu Benson (FED)",
      status: "VERIFIED",
      securityLevel: "REGULATORY"
    },
    {
      id: "doc-004",
      name: "Trainee Enrollment Declaration & Biometric Affidavits.zip",
      type: "DECLARATION",
      size: "18.5 MB",
      uploadedAt: "2026-06-12T02:04:00Z",
      uploadedBy: "State Director (STA)",
      status: "PENDING",
      securityLevel: "HIGH_ENCRYPTED"
    },
    {
      id: "doc-005",
      name: "Q1 National TVET Execution & Funds Disbursement Dispatch.pdf",
      type: "REPORT",
      size: "8.9 MB",
      uploadedAt: "2026-06-05T11:20:00Z",
      uploadedBy: "Hon. Minister Oversight Team",
      status: "VERIFIED",
      securityLevel: "REGULATORY"
    }
  ]);

  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      addNewDocument(file.name, file.size);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      addNewDocument(file.name, file.size);
    }
  };

  const addNewDocument = (fileName: string, bytesSize: number | string) => {
    let sizeStr = "1.5 MB";
    if (typeof bytesSize === "number") {
      sizeStr = `${(bytesSize / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      sizeStr = bytesSize;
    }

    const newDoc: DocumentMeta = {
      id: `doc-${Date.now()}`,
      name: fileName,
      type: fileName.toLowerCase().includes("sla") ? "SLA" : "DECLARATION",
      size: sizeStr,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "Administrative Dispatcher (FED)",
      status: "PENDING",
      securityLevel: "HIGH_ENCRYPTED"
    };

    setDocuments(prev => [newDoc, ...prev]);
    setUploadFeedback(`Consolidated document "${fileName}" received and row-secured successfully.`);
    setTimeout(() => setUploadFeedback(null), 5000);
  };

  const handleDelete = (docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const filteredDocs = documents.filter(doc => {
    const matchesCategory = activeCategory === "ALL" || doc.type === activeCategory;
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 text-slate-200 animate-in fade-in duration-300 text-left">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 border border-slate-850 p-6 rounded-2xl gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-400" />
            <span>National Governance Document Center</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Secure audit-logged document vault for SLAs, regulatory NBTE credentials, and biometric agreements.
          </p>
        </div>
        
        <div className="flex gap-2 text-[10px] font-mono text-emerald-450 bg-emerald-950/40 p-2 px-3 border border-emerald-900/40 rounded-xl">
          <span>● AUDIT COMPLIANT REGISTRY</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload and Filtering Side Panel */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Drag & Drop Upload Block */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
            <h3 className="text-xs uppercase font-mono font-bold text-indigo-400 tracking-wider">Secure Document Upload</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Upload compliance SLA files, biometric terminal certifications, or authorization decrees.
            </p>

            <form 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center gap-3 cursor-pointer relative ${
                dragActive 
                  ? "border-indigo-500 bg-indigo-950/20" 
                  : "border-slate-800 hover:border-slate-700 bg-slate-950/45"
              }`}
            >
              <input 
                type="file" 
                id="doc-upload-input" 
                multiple={false} 
                className="hidden" 
                onChange={handleFileSelect}
              />
              <label htmlFor="doc-upload-input" className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                <UploadCloud className="w-8 h-8 text-slate-500 mb-1" />
                <span className="font-bold text-[11px] text-slate-200 block">Drag file here or Click to select</span>
                <span className="text-[9px] text-slate-500 block mt-1 font-mono">Accepts PDF, ZIP, PNG &bull; Max 50MB</span>
              </label>
            </form>

            {uploadFeedback && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-905/30 rounded-xl text-emerald-400 flex gap-2 items-start text-[11px] font-medium leading-normal animate-in slide-in-from-top-1 duration-200">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{uploadFeedback}</span>
              </div>
            )}
          </div>

          {/* Quick Filters */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl">
            <h3 className="text-xs uppercase font-mono font-bold text-indigo-400 tracking-wider mb-3">Filter by Category</h3>
            <div className="space-y-1.5 flex flex-col">
              {[
                { id: "ALL", label: "All Documents" },
                { id: "SLA", label: "National SLAs" },
                { id: "BIOMETRIC_PRESET", label: "Biometric Approval Protocols" },
                { id: "LICENSE", label: "NBTE Regulatory Licenses" },
                { id: "DECLARATION", label: "Trainee Sworn Affidavits" },
                { id: "REPORT", label: "Oversight Reports" }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`p-2.5 rounded-xl text-[11px] font-bold text-left transition ${
                    activeCategory === cat.id 
                      ? "bg-indigo-950 text-indigo-300 border border-indigo-900/40" 
                      : "bg-slate-950/65 border border-transparent text-slate-400 hover:bg-slate-850 hover:text-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Documents Registry Listing */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Filter Bar and Search */}
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search documents by filename or supervisor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 p-2.5 pl-10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-sans text-xs"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-slate-950 px-3 border border-slate-850 rounded-xl text-slate-400 text-[11px] select-none shrink-0 py-2 md:py-0">
              <Filter className="w-3.5 h-3.5" />
              <span className="font-medium">Total: {filteredDocs.length} items</span>
            </div>
          </div>

          {/* List layout */}
          <div className="space-y-3">
            {filteredDocs.length === 0 ? (
              <div className="bg-slate-900 border border-slate-850 rounded-2xl p-15 text-center text-slate-500">
                <FileText className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                <p className="font-semibold text-xs">No documents found matching criteria.</p>
                <p className="text-[10px] text-slate-650 mt-1">Refine your search tags or insert a new file to the center.</p>
              </div>
            ) : (
              filteredDocs.map(doc => (
                <div 
                  key={doc.id} 
                  className="bg-slate-900 border border-slate-850 p-4 rounded-2xl hover:border-slate-750 transition duration-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left relative overflow-hidden"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[8px] font-mono font-bold bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded border border-indigo-900/35 uppercase">
                        {doc.type}
                      </span>
                      <span className="text-[8.5px] font-mono font-bold bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-850 uppercase">
                        {doc.securityLevel}
                      </span>
                    </div>
                    
                    <h4 className="font-bold text-white text-xs mt-1 block leading-tight">{doc.name}</h4>
                    
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 font-sans mt-1">
                      <span>Owner: <strong className="text-slate-350">{doc.uploadedBy}</strong></span>
                      <span>&bull;</span>
                      <span className="font-mono">{doc.size}</span>
                      <span>&bull;</span>
                      <span className="font-mono">{new Date(doc.uploadedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-transparent border-slate-855">
                    
                    <span className={`px-2 py-0.5 text-[9px] rounded-full border font-mono font-extra-bold uppercase ${
                      doc.status === "VERIFIED" 
                        ? "bg-emerald-950 text-emerald-400 border-emerald-900/30" 
                        : "bg-amber-955 text-amber-400 border-amber-900/30 animate-pulse"
                    }`}>
                      {doc.status}
                    </span>

                    <button 
                      title="Download Secure Copy"
                      className="p-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 rounded-xl text-indigo-400 hover:text-white transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button 
                      onClick={() => handleDelete(doc.id)}
                      title="Delete Registry Entry"
                      className="p-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 rounded-xl text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                  </div>

                </div>
              ))
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
