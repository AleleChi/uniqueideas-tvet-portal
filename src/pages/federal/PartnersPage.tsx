/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, Trash2, Edit2, MoveUp, MoveDown, CheckCircle, AlertTriangle, 
  Globe, HelpCircle, Upload, Eye, EyeOff, Loader2, Save, X, ExternalLink, Sliders, Image as ImageIcon
} from "lucide-react";
import { authFetch } from "../../utils/authFetch";

interface Partner {
  id: string;
  organisation_name: string;
  short_name: string;
  slug: string;
  category: string;
  description?: string;
  website_url?: string;
  logo_original_url: string;
  logo_optimized_url: string;
  logo_alt_text: string;
  logo_variant?: "colour" | "monochrome" | "dark" | "light";
  background_mode?: "transparent" | "light" | "dark";
  display_scale?: number;
  display_order: number;
  status: "draft" | "published";
  is_featured?: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  // Modal / Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [orgName, setOrgName] = useState("");
  const [shortName, setShortName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("Development Partner");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoOriginalUrl, setLogoOriginalUrl] = useState("");
  const [logoOptimizedUrl, setLogoOptimizedUrl] = useState("");
  const [logoAltText, setLogoAltText] = useState("");
  const [logoVariant, setLogoVariant] = useState<"colour" | "monochrome" | "dark" | "light">("colour");
  const [backgroundMode, setBackgroundMode] = useState<"transparent" | "light" | "dark">("transparent");
  const [displayScale, setDisplayScale] = useState<number>(1.0);
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isFeatured, setIsFeatured] = useState(true);

  // Image Upload Local States
  const [uploadingImage, setUploadingImage] = useState(false);
  const [transparencyCheck, setTransparencyCheck] = useState<{ checked: boolean; passed: boolean } | null>(null);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Grid/List background preview simulator state
  const [simulatedBg, setSimulatedBg] = useState<"light" | "dark" | "grid">("light");

  useEffect(() => {
    fetchPartners();
  }, []);

  const showNotification = (message: string, type: "success" | "error" | "warning") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const fetchPartners = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch("/api/admin/institutional-partners");
      if (!res.ok) {
        throw new Error(`Failed to load partners: ${res.statusText}`);
      }
      const data = await res.json();
      setPartners(data);
    } catch (err: any) {
      console.error("[PartnersPage] fetch error:", err);
      setErrorMsg(err.message || "Failed to synchronise partner directory records.");
    } finally {
      setLoading(false);
    }
  };

  // Auto slug generation helper
  const handleNameChange = (val: string) => {
    setOrgName(val);
    if (!editingId) {
      // Auto slugify
      const computedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      setSlug(computedSlug);
      // Auto short name helper
      if (!shortName) {
        setShortName(val.substring(0, 30));
      }
      if (!logoAltText) {
        setLogoAltText(`${val} Official Logo`);
      }
    }
  };

  // Image File Select & Server Processing
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!slug) {
      showNotification("Please specify the Organisation Name or Slug first so we can label files correctly.", "warning");
      return;
    }

    setUploadingImage(true);
    setTransparencyCheck(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Content = reader.result as string;
        
        const res = await authFetch("/api/admin/institutional-partners/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileContent: base64Content,
            slug: slug
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed server-side logo optimization.");
        }

        const data = await res.json();
        setLogoOriginalUrl(data.logo_original_url);
        setLogoOptimizedUrl(data.logo_optimized_url);
        setTransparencyCheck({
          checked: true,
          passed: !!data.has_transparency
        });

        if (!data.has_transparency) {
          showNotification("Upload complete. Warning: Image lacks transparent alpha channel.", "warning");
        } else {
          showNotification("Logo optimized, padded, cropped and uploaded successfully!", "success");
        }
      };
    } catch (err: any) {
      console.error("[Logo Upload Error]:", err);
      showNotification(err.message || "Failed uploading logo asset.", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setOrgName("");
    setShortName("");
    setSlug("");
    setCategory("Development Partner");
    setDescription("");
    setWebsiteUrl("");
    setLogoOriginalUrl("");
    setLogoOptimizedUrl("");
    setLogoAltText("");
    setLogoVariant("colour");
    setBackgroundMode("transparent");
    setDisplayScale(1.0);
    // Auto increment order
    const maxOrder = partners.length > 0 ? Math.max(...partners.map(p => p.display_order || 0)) : 0;
    setDisplayOrder(maxOrder + 1);
    setStatus("draft");
    setIsFeatured(true);
    setTransparencyCheck(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (partner: Partner) => {
    setEditingId(partner.id);
    setOrgName(partner.organisation_name);
    setShortName(partner.short_name);
    setSlug(partner.slug);
    setCategory(partner.category);
    setDescription(partner.description || "");
    setWebsiteUrl(partner.website_url || "");
    setLogoOriginalUrl(partner.logo_original_url);
    setLogoOptimizedUrl(partner.logo_optimized_url);
    setLogoAltText(partner.logo_alt_text);
    setLogoVariant(partner.logo_variant || "colour");
    setBackgroundMode(partner.background_mode || "transparent");
    setDisplayScale(partner.display_scale || 1.0);
    setDisplayOrder(partner.display_order);
    setStatus(partner.status);
    setIsFeatured(partner.is_featured !== false);
    setTransparencyCheck(null);
    setIsFormOpen(true);
  };

  const handleDeletePartner = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently remove '${name}'? This will delete all original and optimized logo assets.`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/admin/institutional-partners/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        throw new Error("Failed to delete partner logo record");
      }
      showNotification(`Successfully removed ${name} from partners directory.`, "success");
      fetchPartners();
    } catch (err: any) {
      console.error("[Delete Error]:", err);
      showNotification(err.message || "Failed deleting logo entry.", "error");
    }
  };

  const handleToggleStatus = async (partner: Partner) => {
    const nextStatus = partner.status === "published" ? "draft" : "published";
    try {
      const res = await authFetch(`/api/admin/institutional-partners/${partner.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) {
        throw new Error("Failed to toggle publish status");
      }
      showNotification(`Record is now ${nextStatus === "published" ? "Live / Published" : "saved as Draft"}.`, "success");
      fetchPartners();
    } catch (err: any) {
      console.error("[Status Toggle Error]:", err);
      showNotification(err.message || "Failed updating record status.", "error");
    }
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !shortName || !slug || !category || !logoOriginalUrl || !logoOptimizedUrl) {
      showNotification("Please complete all mandatory fields, including uploading a partner logo file.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        organisation_name: orgName,
        short_name: shortName,
        slug,
        category,
        description,
        website_url: websiteUrl,
        logo_original_url: logoOriginalUrl,
        logo_optimized_url: logoOptimizedUrl,
        logo_alt_text: logoAltText || `${orgName} logo`,
        logo_variant: logoVariant,
        background_mode: backgroundMode,
        display_scale: parseFloat(String(displayScale)),
        display_order: parseInt(String(displayOrder)),
        status,
        is_featured: isFeatured
      };

      let res;
      if (editingId) {
        res = await authFetch(`/api/admin/institutional-partners/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await authFetch("/api/admin/institutional-partners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed saving institutional partner.");
      }

      showNotification(`Successfully saved '${orgName}' record.`, "success");
      setIsFormOpen(false);
      fetchPartners();
    } catch (err: any) {
      console.error("[Form Save Error]:", err);
      showNotification(err.message || "Failed saving record.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= partners.length) return;

    const list = [...partners];
    // Swap
    const temp = list[index];
    list[index] = list[nextIndex];
    list[nextIndex] = temp;

    // Build ordered list of ids
    const orderedIds = list.map(p => p.id);
    
    // Optimistic update
    setPartners(list.map((p, idx) => ({ ...p, display_order: idx + 1 })));

    try {
      const res = await authFetch("/api/admin/institutional-partners/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds })
      });
      if (!res.ok) {
        throw new Error("Reordering API error");
      }
      showNotification("Updated visual display sequence successfully.", "success");
    } catch (err) {
      console.error("[Reorder Error]:", err);
      showNotification("Failed updating visual display order.", "error");
      fetchPartners();
    }
  };

  // Filter list
  const filteredPartners = partners.filter(p => {
    const matchesSearch = 
      p.organisation_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-left animate-in fade-in duration-200">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-sm font-semibold transition-all duration-300 transform translate-y-0 ${
          toast.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : toast.type === "warning"
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          {toast.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Institutional &amp; Partner Logos
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Federal Ministry of Education workspace to register, optimize and reorder program logo marquees on the landing page.
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold text-xs hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Institutional Partner
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-rose-500" />
          <div>
            <p className="font-bold text-sm">Database Sync Connection Offline</p>
            <p className="text-xs text-rose-700/80 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      ) : loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs text-slate-400 font-semibold">Synchronising institution directory registries...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 border border-slate-250 rounded-xl shadow-xs">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search partner registries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-3 py-1.5 border border-slate-250 rounded-lg text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <Globe className="w-4 h-4" />
                </span>
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="All">All Categories</option>
                  <option value="Development Partner">Development Partners</option>
                  <option value="Government Ministry">Government Ministries</option>
                  <option value="Programme Initiative">Programme Initiatives</option>
                </select>
              </div>
            </div>

            {/* BG Preview Simulators */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Background Simulator</span>
              <button
                onClick={() => setSimulatedBg("light")}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${
                  simulatedBg === "light" 
                    ? "bg-white border-slate-400 text-slate-900 shadow-xs" 
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                }`}
              >
                Light
              </button>
              <button
                onClick={() => setSimulatedBg("dark")}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${
                  simulatedBg === "dark" 
                    ? "bg-slate-900 border-slate-950 text-white shadow-xs" 
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => setSimulatedBg("grid")}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${
                  simulatedBg === "grid" 
                    ? "bg-slate-100 border-slate-300 text-slate-700 shadow-xs" 
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                }`}
              >
                Transparent
              </button>
            </div>
          </div>

          {/* Directory list */}
          {filteredPartners.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No partner entries found</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Refine your search parameters or click the &quot;Add Institutional Partner&quot; button above to register an official entity.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">Order</th>
                      <th className="py-3 px-4 w-44">Logo Preview</th>
                      <th className="py-3 px-4">Entity Details</th>
                      <th className="py-3 px-4 w-40">Category</th>
                      <th className="py-3 px-4 w-24">Scale</th>
                      <th className="py-3 px-4 w-28 text-center">Status</th>
                      <th className="py-3 px-4 w-32 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-xs font-semibold text-slate-700">
                    {filteredPartners.map((p, index) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        
                        {/* Display order indices and controls */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm font-extrabold text-slate-800 leading-none mb-1">
                              {p.display_order}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                disabled={index === 0}
                                onClick={() => handleMove(index, "up")}
                                className={`p-1 rounded transition-colors ${
                                  index === 0 
                                    ? "text-slate-300 cursor-not-allowed" 
                                    : "text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                                }`}
                                title="Move up visual sequence"
                              >
                                <MoveUp className="w-3 h-3" />
                              </button>
                              <button
                                disabled={index === filteredPartners.length - 1}
                                onClick={() => handleMove(index, "down")}
                                className={`p-1 rounded transition-colors ${
                                  index === filteredPartners.length - 1 
                                    ? "text-slate-300 cursor-not-allowed" 
                                    : "text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                                }`}
                                title="Move down visual sequence"
                              >
                                <MoveDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Logo rendering preview with simulated BG */}
                        <td className="py-3 px-4">
                          <div className={`p-4 rounded-lg border border-slate-200 flex items-center justify-center transition-all min-h-[64px] relative ${
                            simulatedBg === "dark" 
                              ? "bg-slate-900 border-slate-950" 
                              : simulatedBg === "grid"
                              ? "bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50"
                              : "bg-white"
                          }`}>
                            <img
                              src={p.logo_original_url}
                              alt={p.logo_alt_text}
                              style={{ transform: `scale(${p.display_scale || 1.0})` }}
                              referrerPolicy="no-referrer"
                              className="max-h-8 max-w-[130px] object-contain transition-transform"
                            />
                            <div className="absolute top-1 left-1 bg-slate-100 text-[8px] font-bold px-1 py-0.2 rounded text-slate-500 uppercase">
                              {p.logo_variant || "Colour"}
                            </div>
                          </div>
                        </td>

                        {/* Metadata details */}
                        <td className="py-3 px-4 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm leading-snug">
                              {p.organisation_name}
                            </span>
                            {p.website_url && (
                              <a
                                href={p.website_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            <span>Short Name: {p.short_name}</span>
                            <span>•</span>
                            <span>Slug: {p.slug}</span>
                          </div>
                          {p.description && (
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-sm line-clamp-1">
                              {p.description}
                            </p>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                            p.category === "Development Partner" 
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : p.category === "Government Ministry"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          }`}>
                            {p.category}
                          </span>
                        </td>

                        {/* Visual display scale */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-600 text-sm">
                          x{(p.display_scale || 1.0).toFixed(1)}
                        </td>

                        {/* Status badge */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase cursor-pointer transition-all border ${
                              p.status === "published"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            }`}
                          >
                            {p.status}
                          </button>
                        </td>

                        {/* Admin triggers */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit partner record"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePartner(p.id, p.organisation_name)}
                              className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                              title="Delete partner permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Slide-over Drawer / Modal for Add/Edit */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setIsFormOpen(false)} />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
              
              {/* Form Header */}
              <div className="p-6 border-b border-slate-150 flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-base font-extrabold text-slate-950">
                    {editingId ? "Edit Institutional Partner" : "Register Institutional Partner"}
                  </h2>
                  <p className="text-xs text-slate-450 font-semibold mt-0.5">
                    Define metadata, scale factors and process high-resolution logo assets.
                  </p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSavePartner} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* section 1: Base info */}
                <div className="space-y-4">
                  <span className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Base Registry Metadata</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Organisation Name *</label>
                      <input
                        type="text"
                        required
                        value={orgName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g. World Bank Group"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Short / Abbreviated Name *</label>
                      <input
                        type="text"
                        required
                        value={shortName}
                        onChange={(e) => setShortName(e.target.value)}
                        placeholder="e.g. World Bank"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Slug identifier *</label>
                      <input
                        type="text"
                        required
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="e.g. world-bank"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs font-mono font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Institution Category *</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="Development Partner">Development Partner</option>
                        <option value="Government Ministry">Government Ministry</option>
                        <option value="Programme Initiative">Programme Initiative</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Website URL (Optional)</label>
                      <input
                        type="url"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://example.org"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Logo ALT text *</label>
                      <input
                        type="text"
                        required
                        value={logoAltText}
                        onChange={(e) => setLogoAltText(e.target.value)}
                        placeholder="World Bank official logo standard"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Description / Purpose Statement</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter brief outline regarding their funding role, accreditation standards, or educational guidelines..."
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"
                    />
                  </div>
                </div>

                {/* section 2: Logo File Dropzone & Processing */}
                <div className="space-y-4 border-t border-slate-150 pt-5">
                  <span className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Logo Upload &amp; Automation Pipeline</span>
                  
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-5 text-center transition-all relative">
                    {uploadingImage ? (
                      <div className="py-6 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                        <span className="text-xs font-bold text-slate-500">Processing transparent vectors, stripping empty canvas boundaries and generating monochrome matrices...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-3 bg-white border border-slate-200 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-slate-500 shadow-xs">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Drag or select logo file (PNG format recommended)</p>
                          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                            Supported: PNG, WEBP, SVG, JPEG. High-resolution transparent vectors look best.
                          </p>
                        </div>
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            id="partner-logo-input"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                          <label
                            htmlFor="partner-logo-input"
                            className="inline-block px-3 py-1.5 bg-white border border-slate-250 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                          >
                            Select Image File
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Previews display */}
                  {logoOriginalUrl && (
                    <div className="space-y-3">
                      <span className="block text-[11px] font-bold text-slate-500 uppercase">Processed Image Results (Uploaded to Cloudinary)</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Original Colour */}
                        <div className="border border-slate-200 rounded-lg p-3 bg-white">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Color Original</span>
                          <div className="h-24 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 border border-slate-100 rounded-md flex items-center justify-center p-4">
                            <img src={logoOriginalUrl} alt="Color original preview" className="max-h-16 object-contain" referrerPolicy="no-referrer" />
                          </div>
                          <span className="block text-[10px] font-semibold text-slate-400 truncate mt-1.5">{logoOriginalUrl}</span>
                        </div>

                        {/* Monochrome Gray */}
                        <div className="border border-slate-200 rounded-lg p-3 bg-white">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Monochrome Variation (Grayscale Optimized)</span>
                          <div className="h-24 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 border border-slate-100 rounded-md flex items-center justify-center p-4">
                            <img src={logoOptimizedUrl} alt="Mono optimized preview" className="max-h-16 object-contain" referrerPolicy="no-referrer" />
                          </div>
                          <span className="block text-[10px] font-semibold text-slate-400 truncate mt-1.5">{logoOptimizedUrl}</span>
                        </div>
                      </div>

                      {/* Transparency feedback banner */}
                      {transparencyCheck && (
                        <div className={`p-4 rounded-lg border flex gap-3 items-start ${
                          transparencyCheck.passed 
                            ? "bg-emerald-50/50 border-emerald-100 text-emerald-800"
                            : "bg-amber-50 border-amber-200 text-amber-800"
                        }`}>
                          {transparencyCheck.passed ? (
                            <>
                              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold">Transparency Check Passed</p>
                                <p className="text-[10px] text-emerald-700/80 leading-snug mt-0.5">
                                  Real alpha transparency channels detected. Logo will overlay seamlessly across both Light and Dark mode landing layouts.
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold">Transparency Warning</p>
                                <p className="text-[10px] text-amber-700/80 leading-snug mt-0.5">
                                  No alpha transparency channel detected in this image. We recommend uploaded logos have a fully transparent alpha background to preserve seamless light/dark rendering on the landing page.
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* section 3: Visual Scaling & Alignment parameters */}
                <div className="space-y-4 border-t border-slate-150 pt-5">
                  <span className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Visual Scaling &amp; Alignment Settings</span>
                  
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4">
                    {/* Live visual scale framing container */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-700">Display Scale Factor: x{displayScale.toFixed(1)}</label>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Live Framing Preview</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={displayScale}
                        onChange={(e) => setDisplayScale(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                      />
                    </div>

                    {/* Live container preview */}
                    {logoOriginalUrl ? (
                      <div className="border border-slate-200 bg-white rounded-lg p-6 flex flex-col items-center justify-center relative min-h-[96px] overflow-hidden">
                        <div className="absolute top-2 left-2 bg-slate-100 text-[8px] font-bold px-1 py-0.5 rounded text-slate-400 uppercase tracking-wide">
                          Simulated Header Strip Slot (Height 32px)
                        </div>
                        <div className="h-10 flex items-center justify-center border-y border-dashed border-slate-100 w-full">
                          <img
                            src={logoVariant === "monochrome" ? logoOptimizedUrl : logoOriginalUrl}
                            alt="Visual slider preview"
                            style={{ transform: `scale(${displayScale})` }}
                            referrerPolicy="no-referrer"
                            className="max-h-8 object-contain transition-transform"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="border border-slate-150 bg-slate-100/50 rounded-lg p-6 text-center text-xs font-semibold text-slate-400">
                        Upload a logo image file above to see a live visual scale preview frame.
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Rendering Mode</label>
                        <select
                          value={logoVariant}
                          onChange={(e: any) => setLogoVariant(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                        >
                          <option value="colour">Colour Original</option>
                          <option value="monochrome">Monochrome Gray</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Fallback Background</label>
                        <select
                          value={backgroundMode}
                          onChange={(e: any) => setBackgroundMode(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                        >
                          <option value="transparent">Transparent</option>
                          <option value="light">Force Light Mode</option>
                          <option value="dark">Force Dark Mode</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Visual Sequence Order</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={displayOrder}
                          onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 1)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isFeatured}
                          onChange={(e) => setIsFeatured(e.target.checked)}
                          className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700">Feature on top header row</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={status === "published"}
                          onChange={(e) => setStatus(e.target.checked ? "published" : "draft")}
                          className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700">Publish immediately (Live status)</span>
                      </label>
                    </div>

                  </div>
                </div>

              </form>

              {/* Form Footer */}
              <div className="p-6 border-t border-slate-150 flex items-center justify-end gap-3 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-250 bg-white text-slate-700 rounded-lg font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting || uploadingImage}
                  onClick={handleSavePartner}
                  className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Registry...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Partner Record
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
