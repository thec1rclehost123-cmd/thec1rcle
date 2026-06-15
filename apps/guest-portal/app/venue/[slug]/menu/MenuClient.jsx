'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search } from 'lucide-react';

function toSectionId(value) {
  return (
    String(value || 'menu')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'menu'
  );
}

function formatPrice(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number') return `₹${value}`;
  return String(value);
}

function normalizeMenuItem(item = {}, categoryLabel = 'Menu') {
  const name = item.name || item.title || item.itemName || item.label;
  if (!name) return null;

  const sectionLabel = item.category || item.section || item.group || categoryLabel;
  return {
    id: item.id || `${sectionLabel}-${name}`,
    name,
    description: item.description || item.subtitle || item.notes || '',
    price: formatPrice(item.price ?? item.amount ?? item.cost),
    isVeg: Boolean(item.isVeg ?? item.veg ?? item.vegetarian),
    sectionId: toSectionId(sectionLabel),
    sectionLabel,
  };
}

function normalizeMenuSections(menu, venue) {
  const rawMenu =
    menu?.menu ||
    menu?.items ||
    venue?.menu ||
    venue?.menuDoc?.menu ||
    venue?.menuDoc?.items ||
    menu;

  if (!rawMenu) return [];

  if (Array.isArray(rawMenu)) {
    const hasSectionShape = rawMenu.some(
      (entry) => Array.isArray(entry?.items) || Array.isArray(entry?.menuItems),
    );

    if (hasSectionShape) {
      return rawMenu
        .map((section, index) => {
          const label =
            section.label ||
            section.name ||
            section.title ||
            section.category ||
            `Section ${index + 1}`;
          const items = (section.items || section.menuItems || [])
            .map((item) => normalizeMenuItem(item, label))
            .filter(Boolean);
          return { id: section.id || toSectionId(label), label, items };
        })
        .filter((section) => section.items.length > 0);
    }

    const items = rawMenu.map((item) => normalizeMenuItem(item)).filter(Boolean);
    return items.length ? [{ id: 'menu', label: 'Menu', items }] : [];
  }

  if (typeof rawMenu === 'object') {
    const nestedSections = rawMenu.sections || rawMenu.categories || rawMenu.groups;
    if (Array.isArray(nestedSections)) return normalizeMenuSections(nestedSections, venue);

    return Object.entries(rawMenu)
      .map(([label, value]) => {
        const items = Array.isArray(value)
          ? value.map((item) => normalizeMenuItem(item, label)).filter(Boolean)
          : [];
        return { id: toSectionId(label), label, items };
      })
      .filter((section) => section.items.length > 0);
  }

  return [];
}

export default function VenueMenuPage({ venue, menu, slug }) {
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');
  const sections = normalizeMenuSections(menu, venue);
  const menuCategories = [
    { id: 'all', label: 'All' },
    ...sections.map((section) => ({ id: section.id, label: section.label })),
  ];
  const normalizedQuery = query.trim().toLowerCase();

  const visibleSections = sections
    .map((section) => {
      const items = section.items.filter((item) => {
        const matchesCategory =
          activeCategory === 'all' ||
          item.sectionId === activeCategory ||
          section.id === activeCategory;
        const matchesVeg = isVegOnly ? item.isVeg : true;
        const matchesQuery = normalizedQuery
          ? `${item.name} ${item.description} ${section.label}`
              .toLowerCase()
              .includes(normalizedQuery)
          : true;
        return matchesCategory && matchesVeg && matchesQuery;
      });
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);

  return (
    <main className="min-h-screen bg-white text-black font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 p-4 flex justify-between items-center px-6 md:px-12">
        <div className="flex items-center gap-4">
          <Link
            href={`/venue/${slug}`}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">{venue.name}</h1>
            <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Menu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Functional Veg Toggle */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setIsVegOnly(!isVegOnly)}
          >
            <div
              className={`w-10 h-5 rounded-full transition-colors relative border ${isVegOnly ? 'bg-emerald-500 border-emerald-600' : 'bg-gray-100 border-gray-200'}`}
            >
              <div
                className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all ${isVegOnly ? 'left-5.5' : 'left-0.5'}`}
              />
            </div>
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${isVegOnly ? 'text-emerald-600' : 'text-gray-400 group-hover:text-black'}`}
            >
              Veg Only
            </span>
          </div>
          <label className="hidden sm:flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-4 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search menu"
              className="w-28 bg-transparent text-xs font-bold uppercase tracking-widest text-gray-700 outline-none placeholder:text-gray-300"
            />
          </label>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Categories */}
        <aside className="hidden md:flex w-24 border-r border-gray-100 min-h-[calc(100vh-73px)] sticky top-[73px] bg-gray-50/50 flex-col items-center py-8 gap-10">
          <div className="text-[9px] font-black uppercase vertical-text tracking-[0.5em] text-gray-300">
            Sections
          </div>
          {sections.slice(0, 6).map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveCategory(section.id)}
              className="flex flex-col items-center gap-2 group"
            >
              <div
                className={`w-10 h-10 rounded-xl border shadow-sm transition-all flex items-center justify-center p-2 ${activeCategory === section.id ? 'bg-black border-black text-white' : 'bg-white border-gray-100 group-hover:shadow-md'}`}
              >
                <span className="text-xs font-black uppercase">{section.label.slice(0, 2)}</span>
              </div>
              <span className="max-w-[72px] truncate text-[8px] font-black uppercase text-gray-400 group-hover:text-black">
                {section.label}
              </span>
            </button>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 p-6 md:p-12 space-y-12">
          {/* Horizontal Switcher */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {menuCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                  activeCategory === cat.id
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-400 border-gray-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {sections.length === 0 ? (
            <section className="rounded-3xl border border-gray-100 bg-gray-50 p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                Menu unavailable
              </p>
              <h2 className="mt-3 text-2xl font-black uppercase tracking-tight">
                This venue has not published a menu yet.
              </h2>
            </section>
          ) : visibleSections.length === 0 ? (
            <section className="rounded-3xl border border-gray-100 bg-gray-50 p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                No matches
              </p>
              <h2 className="mt-3 text-2xl font-black uppercase tracking-tight">
                Try another section or clear the filters.
              </h2>
            </section>
          ) : (
            visibleSections.map((section) => (
              <section
                key={section.id}
                className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-4">
                  {section.label}
                  <span className="h-px flex-1 bg-gray-100" />
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  {section.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start group">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          {/* Veg/Non-Veg Marker */}
                          <div
                            className={`w-3.5 h-3.5 border flex items-center justify-center ${item.isVeg ? 'border-emerald-500' : 'border-red-500'}`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`}
                            />
                          </div>
                          <h3 className="text-[15px] font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                            {item.name}
                          </h3>
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-gray-400 font-medium max-w-xs uppercase tracking-wide">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {item.price && (
                          <p className="text-[13px] font-black text-gray-900">{item.price}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .vertical-text {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </main>
  );
}
