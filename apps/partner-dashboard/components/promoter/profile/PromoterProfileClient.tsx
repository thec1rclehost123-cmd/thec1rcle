"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Camera, Link as LinkIcon, Instagram, Twitter, Globe, Eye, EyeOff, Check, X, ShieldAlert } from "lucide-react";

export function PromoterProfileClient() {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["promoter", "profile"],
        queryFn: async () => {
            const res = await fetch(`/api/partner/promoter/profile`);
            if (!res.ok) throw new Error("Failed to fetch profile");
            return res.json();
        },
    });

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<any>({});
    
    useEffect(() => {
        if (data?.profile && !isEditing) {
            setFormData(data.profile);
        }
    }, [data, isEditing]);

    const updateProfile = useMutation({
        mutationFn: async (updatedData: any) => {
             const res = await fetch(`/api/partner/promoter/profile`, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(updatedData)
             });
             if (!res.ok) throw new Error("Failed to update");
             return res.json();
        },
        onSuccess: () => {
             refetch();
             setIsEditing(false);
        }
    });

    const handleSave = () => {
         updateProfile.mutate(formData);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6 w-full animate-pulse mt-4 pb-16">
                 <div className="h-16 w-1/4 bg-[var(--bg-elevated)] rounded-xl"></div>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
                      <div className="flex flex-col gap-6">
                           <div className="h-64 bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)]"></div>
                           <div className="h-32 bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)]"></div>
                      </div>
                      <div className="lg:col-span-2 flex flex-col gap-6">
                           <div className="h-80 bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)]"></div>
                           <div className="h-64 bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)]"></div>
                      </div>
                 </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="w-full flex justify-center py-20 p-8 border border-red-500/20 rounded-2xl bg-red-500/5 mt-4">
                <div className="text-center text-red-500">
                    <p className="font-bold mb-1">Failed to Load</p>
                    <p className="text-sm opacity-80">There was an error generating your profile.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <header className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-display-sm text-[var(--text-primary)] tracking-tight font-bold">
                        Profile Details
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm mt-1 font-medium">
                        Manage your public appearance, bio, and connected socials.
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    {isEditing ? (
                        <>
                            <button 
                                onClick={() => setIsEditing(false)}
                                disabled={updateProfile.isPending}
                                className="px-4 py-2 border border-[var(--border-subtle)] hover:bg-[var(--bg-fill)] rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                            >
                                <X className="h-4 w-4" />
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={updateProfile.isPending}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                            >
                                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Save Changes
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-fill)] text-[var(--text-primary)] px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm font-semibold transition-colors shadow-sm"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Left Column: Avatar & Visibility */}
                 <div className="flex flex-col gap-6">
                      <div className="bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)] p-6 flex flex-col items-center text-center">
                           <div className="relative group mb-4">
                               <div className="h-32 w-32 rounded-full overflow-hidden bg-[var(--bg-secondary)] border-4 border-surface-base flex items-center justify-center relative">
                                    {formData.avatarUrl ? (
                                        <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <Camera className="h-10 w-10 text-[var(--text-tertiary)]" />
                                    )}
                               </div>
                               {isEditing && (
                                   <div className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Camera className="h-6 w-6 text-white mb-1" />
                                        <span className="text-xs text-white font-medium">Update</span>
                                   </div>
                               )}
                           </div>
                           
                           <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">{formData.displayName || "Unknown"}</h2>
                           <p className="text-sm font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">@{formData.handle || "unknown"}</p>
                      </div>

                      <div className="bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)] p-6">
                           <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                               <ShieldAlert className="h-4 w-4 text-emerald-500" />
                               Profile Visibility
                           </h3>
                           
                           <label className="flex items-center justify-between p-4 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-base)] cursor-pointer hover:border-emerald-500/50 transition-colors">
                               <div className="flex flex-col max-w-[200px]">
                                   <span className="font-semibold text-[var(--text-primary)] text-sm flex items-center gap-1.5">
                                       {formData.isPublic ? <Eye className="h-4 w-4 text-emerald-500" /> : <EyeOff className="h-4 w-4 text-[var(--text-tertiary)]" />}
                                       {formData.isPublic ? "Public Profile" : "Private Profile"}
                                   </span>
                                   <span className="text-xs text-[var(--text-secondary)] mt-1">
                                       {formData.isPublic ? "Visible on your custom promoter landing page." : "Hidden from public view."}
                                   </span>
                               </div>
                               <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${formData.isPublic ? 'bg-emerald-500' : 'bg-[var(--bg-secondary)]'}`}>
                                   <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${formData.isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                                    {isEditing && (
                                       <input 
                                           type="checkbox" 
                                           className="absolute inset-0 opacity-0 cursor-pointer"
                                           checked={formData.isPublic}
                                           onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                                       />
                                    )}
                               </div>
                           </label>
                      </div>
                 </div>

                 {/* Right Column: General Info & Socials */}
                 <div className="lg:col-span-2 flex flex-col gap-6">
                      <div className="bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)] p-6">
                          <h3 className="font-bold text-[var(--text-primary)] mb-4">General Information</h3>
                          
                          <div className="flex flex-col gap-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  <div className="flex flex-col gap-2">
                                       <label className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Display Name</label>
                                       {isEditing ? (
                                           <input 
                                               type="text" 
                                               value={formData.displayName || ""}
                                               onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                               className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500 transition-colors"
                                           />
                                       ) : (
                                           <div className="w-full bg-[var(--bg-base)] border border-transparent rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] font-medium">{formData.displayName}</div>
                                       )}
                                  </div>
                                  <div className="flex flex-col gap-2">
                                       <label className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Unique Handle</label>
                                       {isEditing ? (
                                            <div className="flex items-center w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg overflow-hidden focus-within:border-emerald-500 transition-colors">
                                                <span className="pl-3 pr-1 text-[var(--text-tertiary)] text-sm border-r border-[var(--border-subtle)] py-2 bg-[var(--bg-secondary)]">@</span>
                                                <input 
                                                    type="text" 
                                                    value={formData.handle || ""}
                                                    onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
                                                    className="w-full bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                                                />
                                            </div>
                                       ) : (
                                           <div className="w-full bg-[var(--bg-base)] border border-transparent rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] font-medium">@{formData.handle}</div>
                                       )}
                                  </div>
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                  <label className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Bio & Background</label>
                                  {isEditing ? (
                                      <textarea 
                                          value={formData.bio || ""}
                                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                          rows={4}
                                          className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                                          placeholder="Share your story and the type of events you promote..."
                                      />
                                  ) : (
                                      <div className="w-full bg-[var(--bg-base)] border border-transparent rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] leading-relaxed">{formData.bio}</div>
                                  )}
                              </div>
                          </div>
                      </div>

                      <div className="bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)] p-6">
                           <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                <LinkIcon className="h-4 w-4" />
                                Social Connections
                           </h3>
                           
                           <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                                        <Instagram className="h-5 w-5 text-pink-500" />
                                    </div>
                                    <div className="flex-1">
                                        {isEditing ? (
                                            <input 
                                                type="url"
                                                placeholder="https://instagram.com/yourhandle"
                                                value={formData.socialLinks?.instagram || ""}
                                                onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, instagram: e.target.value }})}
                                                className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                                            />
                                        ) : (
                                             formData.socialLinks?.instagram ? (
                                                 <a href={formData.socialLinks.instagram} target="_blank" rel="noreferrer" className="text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors">{formData.socialLinks.instagram}</a>
                                             ) : <span className="text-sm text-[var(--text-tertiary)] italic">Not connected</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                                        <Twitter className="h-5 w-5 text-sky-500" />
                                    </div>
                                    <div className="flex-1">
                                        {isEditing ? (
                                            <input 
                                                type="url"
                                                placeholder="https://twitter.com/yourhandle"
                                                value={formData.socialLinks?.twitter || ""}
                                                onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, twitter: e.target.value }})}
                                                className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                                            />
                                        ) : (
                                             formData.socialLinks?.twitter ? (
                                                 <a href={formData.socialLinks.twitter} target="_blank" rel="noreferrer" className="text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors">{formData.socialLinks.twitter}</a>
                                             ) : <span className="text-sm text-[var(--text-tertiary)] italic">Not connected</span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                                        <Globe className="h-5 w-5 text-[var(--text-secondary)]" />
                                    </div>
                                    <div className="flex-1">
                                        {isEditing ? (
                                            <input 
                                                type="url"
                                                placeholder="https://yourwebsite.com"
                                                value={formData.socialLinks?.website || ""}
                                                onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, website: e.target.value }})}
                                                className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                                            />
                                        ) : (
                                             formData.socialLinks?.website ? (
                                                 <a href={formData.socialLinks.website} target="_blank" rel="noreferrer" className="text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors">{formData.socialLinks.website}</a>
                                             ) : <span className="text-sm text-[var(--text-tertiary)] italic">Not connected</span>
                                        )}
                                    </div>
                                </div>
                           </div>
                      </div>
                 </div>
            </div>
        </div>
    );
}
