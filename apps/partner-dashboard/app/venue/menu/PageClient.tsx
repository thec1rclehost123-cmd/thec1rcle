'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  imageUrl: string;
  dietaryTags: string[];
  available: boolean;
  displayOrder: number;
  variants: Array<{ id: string; name: string; pricePaise: number }>;
}

interface MenuSection {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
  items: MenuItem[];
}

interface VenueMenu {
  name: string;
  description: string;
  currency: string;
  published: boolean;
  sections: MenuSection[];
}

const EMPTY_MENU: VenueMenu = {
  name: 'Food & Drinks Menu',
  description: '',
  currency: 'INR',
  published: false,
  sections: [],
};

function newId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function move<T>(values: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= values.length) return values;
  const next = [...values];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function VenueMenuManagement() {
  const { profile, user } = useDashboardAuth();
  const venueId = profile?.activeMembership?.partnerId || '';
  const [menu, setMenu] = useState<VenueMenu>(EMPTY_MENU);
  const [activeSectionId, setActiveSectionId] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const menuQuery = useQuery({
    queryKey: ['venue-structured-menu', venueId],
    enabled: Boolean(venueId && user),
    queryFn: async ({ signal }) => {
      const token = await user?.getIdToken();
      const response = await fetch('/api/partners/venues/menu', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to load the venue menu');
      }
      return (payload?.menu || EMPTY_MENU) as VenueMenu;
    },
  });

  useEffect(() => {
    if (!menuQuery.data) return;
    setMenu(menuQuery.data);
    setActiveSectionId((current) => current || menuQuery.data.sections[0]?.id || '');
    setDirty(false);
  }, [menuQuery.data]);

  const activeSection = useMemo(
    () => menu.sections.find((section) => section.id === activeSectionId) || null,
    [activeSectionId, menu.sections],
  );

  const updateMenu = (updater: (current: VenueMenu) => VenueMenu) => {
    setMenu(updater);
    setDirty(true);
    setSaveError('');
  };

  const addSection = () => {
    const id = newId('section');
    updateMenu((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id,
          name: `Section ${current.sections.length + 1}`,
          displayOrder: current.sections.length,
          active: true,
          items: [],
        },
      ],
    }));
    setActiveSectionId(id);
  };

  const updateSection = (sectionId: string, patch: Partial<MenuSection>) => {
    updateMenu((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section,
      ),
    }));
  };

  const removeSection = (sectionId: string) => {
    updateMenu((current) => ({
      ...current,
      sections: current.sections.filter((section) => section.id !== sectionId),
    }));
    const next = menu.sections.find((section) => section.id !== sectionId);
    setActiveSectionId(next?.id || '');
  };

  const reorderSection = (sectionId: string, direction: -1 | 1) => {
    updateMenu((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      return { ...current, sections: move(current.sections, index, direction) };
    });
  };

  const addItem = () => {
    if (!activeSection) return;
    updateSection(activeSection.id, {
      items: [
        ...activeSection.items,
        {
          id: newId('item'),
          name: 'New item',
          description: '',
          pricePaise: 0,
          imageUrl: '',
          dietaryTags: [],
          available: true,
          displayOrder: activeSection.items.length,
          variants: [],
        },
      ],
    });
  };

  const updateItem = (itemId: string, patch: Partial<MenuItem>) => {
    if (!activeSection) return;
    updateSection(activeSection.id, {
      items: activeSection.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  };

  const removeItem = (itemId: string) => {
    if (!activeSection) return;
    updateSection(activeSection.id, {
      items: activeSection.items.filter((item) => item.id !== itemId),
    });
  };

  const reorderItem = (itemId: string, direction: -1 | 1) => {
    if (!activeSection) return;
    const index = activeSection.items.findIndex((item) => item.id === itemId);
    updateSection(activeSection.id, { items: move(activeSection.items, index, direction) });
  };

  const saveMenu = async (published: boolean) => {
    if (!user || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/partners/venues/menu', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...menu, published }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to save the menu');
      }
      setMenu(payload.menu);
      setDirty(false);
      setSavedAt(new Date());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the menu');
    } finally {
      setSaving(false);
    }
  };

  if (menuQuery.isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (menuQuery.isError) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="font-semibold text-red-200">
          {menuQuery.error instanceof Error ? menuQuery.error.message : 'Unable to load menu'}
        </p>
        <button className="mt-4 btn btn-secondary" onClick={() => menuQuery.refetch()}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            <span
              className={`rounded-full border px-3 py-1 ${
                menu.published
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
              }`}
            >
              {menu.published ? 'Published' : 'Draft'}
            </span>
            {dirty ? <span className="text-amber-300">Unsaved changes</span> : null}
            {savedAt ? (
              <span className="text-text-tertiary">Saved {savedAt.toLocaleTimeString()}</span>
            ) : null}
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-text-primary">
            <Utensils className="h-8 w-8" />
            Digital Menu Manager
          </h1>
          <p className="mt-2 text-sm text-text-tertiary">
            Structured sections and items are saved to the public venue menu.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            disabled={saving || (!dirty && !menu.published)}
            onClick={() => saveMenu(false)}
            className="btn btn-secondary"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button disabled={saving} onClick={() => saveMenu(true)} className="btn btn-primary">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Publish Changes
          </button>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
          {saveError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-3xl border border-border-subtle bg-surface-elevated p-5">
          <label className="mb-4 block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-text-tertiary">
              Menu name
            </span>
            <input
              value={menu.name}
              onChange={(event) =>
                updateMenu((current) => ({ ...current, name: event.target.value }))
              }
              className="w-full rounded-xl border border-border-subtle bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="mb-5 block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-text-tertiary">
              Description
            </span>
            <textarea
              value={menu.description}
              onChange={(event) =>
                updateMenu((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
              className="w-full rounded-xl border border-border-subtle bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary">
              Sections
            </p>
            <button onClick={addSection} className="rounded-lg p-2 hover:bg-surface-secondary">
              <Plus className="h-4 w-4 text-emerald-400" />
            </button>
          </div>
          <div className="space-y-2">
            {menu.sections.map((section, index) => (
              <div
                key={section.id}
                className={`rounded-xl border p-3 ${
                  activeSectionId === section.id
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-border-subtle bg-surface-secondary'
                }`}
              >
                <button
                  onClick={() => setActiveSectionId(section.id)}
                  className="w-full text-left text-sm font-bold text-text-primary"
                >
                  {section.name}
                  <span className="ml-2 text-xs font-medium text-text-tertiary">
                    {section.items.length}
                  </span>
                </button>
                <div className="mt-2 flex gap-1">
                  <button disabled={index === 0} onClick={() => reorderSection(section.id, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={index === menu.sections.length - 1}
                    onClick={() => reorderSection(section.id, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeSection(section.id)}
                    className="ml-auto text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {menu.sections.length === 0 ? (
              <button
                onClick={addSection}
                className="w-full rounded-xl border border-dashed border-border-subtle p-6 text-sm font-semibold text-text-tertiary"
              >
                Add your first section
              </button>
            ) : null}
          </div>
        </aside>

        <main className="rounded-3xl border border-border-subtle bg-surface-elevated p-6">
          {!activeSection ? (
            <div className="flex min-h-80 items-center justify-center text-sm text-text-tertiary">
              Create a section to begin adding menu items.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  value={activeSection.name}
                  onChange={(event) =>
                    updateSection(activeSection.id, { name: event.target.value })
                  }
                  className="flex-1 rounded-xl border border-border-subtle bg-surface-secondary px-4 py-3 text-xl font-black text-text-primary"
                />
                <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                  <input
                    type="checkbox"
                    checked={activeSection.active}
                    onChange={(event) =>
                      updateSection(activeSection.id, { active: event.target.checked })
                    }
                  />
                  Visible
                </label>
                <button onClick={addItem} className="btn btn-primary">
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>

              {activeSection.items.length === 0 ? (
                <button
                  onClick={addItem}
                  className="w-full rounded-2xl border border-dashed border-border-subtle py-16 text-sm font-semibold text-text-tertiary"
                >
                  No items yet. Add the first item.
                </button>
              ) : (
                <div className="space-y-3">
                  {activeSection.items.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-2xl border border-border-subtle bg-surface-secondary p-4 md:grid-cols-[1.2fr_2fr_120px_1fr_auto]"
                    >
                      <input
                        value={item.name}
                        onChange={(event) => updateItem(item.id, { name: event.target.value })}
                        placeholder="Item name"
                        className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm font-bold text-text-primary"
                      />
                      <input
                        value={item.description}
                        onChange={(event) =>
                          updateItem(item.id, { description: event.target.value })
                        }
                        placeholder="Description"
                        className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm text-text-primary"
                      />
                      <input
                        type="number"
                        min={0}
                        value={item.pricePaise / 100}
                        onChange={(event) =>
                          updateItem(item.id, {
                            pricePaise: Math.max(
                              0,
                              Math.round(Number(event.target.value || 0) * 100),
                            ),
                          })
                        }
                        aria-label={`${item.name} price in rupees`}
                        className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm text-text-primary"
                      />
                      <input
                        value={item.dietaryTags.join(', ')}
                        onChange={(event) =>
                          updateItem(item.id, {
                            dietaryTags: event.target.value
                              .split(',')
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Tags"
                        className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm text-text-primary"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-text-secondary">
                          <input
                            type="checkbox"
                            checked={item.available}
                            onChange={(event) =>
                              updateItem(item.id, { available: event.target.checked })
                            }
                            className="mr-1"
                          />
                          Available
                        </label>
                        <button disabled={index === 0} onClick={() => reorderItem(item.id, -1)}>
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          disabled={index === activeSection.items.length - 1}
                          onClick={() => reorderItem(item.id, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button onClick={() => removeItem(item.id)} className="text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
