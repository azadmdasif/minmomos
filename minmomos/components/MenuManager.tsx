
import React, { useState, useEffect } from 'react';
import { MenuItem, PreparationType, Size, Category, CentralMaterial, RecipeRequirement } from '../types';
import { fetchMenuItems, upsertMenuItem, deleteMenuItem, getCentralInventory } from '../utils/storage';
import { MENU_ITEMS } from '../constants';
import { supabase } from '../utils/supabase';

const PREP_TYPES: PreparationType[] = ['steamed', 'fried', 'normal', 'peri-peri', 'chilli'];
const SIZES: Size[] = ['small', 'medium', 'large'];
const CATEGORIES: Category[] = ['momo', 'side', 'drink', 'combo'];

const MenuManager: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [centralStock, setCentralStock] = useState<CentralMaterial[]>([]);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    loadItems();
    loadCentral();
  }, []);

  const loadItems = async () => {
    setError(null);
    try {
      const { data, error: fetchError } = await fetchMenuItems();
      if (fetchError) {
        if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
          setIsTableMissing(true);
        } else {
          setError(fetchError.message);
        }
      } else {
        setItems(data || []);
        setIsTableMissing(false);
      }
    } catch (e: any) {
      setIsTableMissing(true);
    }
  };

  const loadCentral = async () => {
    const c = await getCentralInventory();
    setCentralStock(c);
  };

  const handleSeedMenu = async () => {
    setIsSeeding(true);
    setError(null);
    try {
      const { error: seedError } = await supabase.from('menu_items').upsert(MENU_ITEMS);
      if (seedError) throw seedError;
      await loadItems();
      alert("SUCCESS: Full Menu Sync Complete.");
    } catch (e: any) {
      setError(`Seed Failed: ${e.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const openAdd = () => {
    setEditingItem({
      id: `item-${Date.now()}`,
      name: '',
      image: '',
      category: 'momo',
      preparations: { steamed: { small: 0, medium: 0, large: 0 } },
      costs: { steamed: { small: 0, medium: 0, large: 0 } },
      recipe: [],
      sizeRecipes: { small: [], medium: [], large: [] }
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (editingItem && editingItem.id && editingItem.name) {
      try {
        const itemToSave = {
          ...editingItem,
          sizeRecipes: editingItem.sizeRecipes || {}
        } as MenuItem;
        
        await upsertMenuItem(itemToSave);
        setIsModalOpen(false);
        await loadItems();
      } catch (e: any) {
        alert("SQL ERROR: Ensure you have run the 'ALTER TABLE' command in Supabase to add the 'sizeRecipes' column.");
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this item?')) return;
    setIsDeleting(id);
    try {
      await deleteMenuItem(id);
      await loadItems();
    } catch (e: any) {
      alert(`Delete Failed: ${e.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const togglePrep = (prep: PreparationType) => {
    if (!editingItem) return;
    const newPreps = { ...(editingItem.preparations || {}) };
    const newCosts = { ...(editingItem.costs || {}) };

    if (newPreps[prep]) {
      delete newPreps[prep];
      delete newCosts[prep];
    } else {
      newPreps[prep] = { small: 0, medium: 0, large: 0 };
      newCosts[prep] = { small: 0, medium: 0, large: 0 };
    }

    setEditingItem({ ...editingItem, preparations: newPreps, costs: newCosts });
  };

  const updateVal = (type: 'price' | 'cost', prep: PreparationType, size: Size, val: string) => {
    if (!editingItem) return;
    const numVal = parseFloat(val) || 0;
    const targetField = type === 'price' ? 'preparations' : 'costs';
    
    const updatedData = { ...(editingItem[targetField] as any) || {} };
    if (!updatedData[prep]) updatedData[prep] = {};
    updatedData[prep][size] = numVal;

    setEditingItem({ ...editingItem, [targetField]: updatedData });
  };

  const addRecipeRow = (size?: Size) => {
    if (!editingItem) return;
    if (size) {
      const sizeRecipes = { ...(editingItem.sizeRecipes || { small: [], medium: [], large: [] }) };
      sizeRecipes[size] = [...(sizeRecipes[size] || []), { materialId: '', quantity: 1 }];
      setEditingItem({ ...editingItem, sizeRecipes });
    } else {
      const recipe = [...(editingItem.recipe || [])];
      recipe.push({ materialId: '', quantity: 1 });
      setEditingItem({ ...editingItem, recipe });
    }
  };

  const updateRecipeRow = (index: number, field: keyof RecipeRequirement, value: string | number, size?: Size) => {
    if (!editingItem) return;
    if (size) {
      const sizeRecipes = { ...(editingItem.sizeRecipes || {}) };
      const currentSizeRecipe = [...(sizeRecipes[size] || [])];
      currentSizeRecipe[index] = { ...currentSizeRecipe[index], [field]: value };
      sizeRecipes[size] = currentSizeRecipe;
      setEditingItem({ ...editingItem, sizeRecipes });
    } else {
      if (!editingItem.recipe) return;
      const recipe = [...editingItem.recipe];
      recipe[index] = { ...recipe[index], [field]: value };
      setEditingItem({ ...editingItem, recipe });
    }
  };

  const removeRecipeRow = (index: number, size?: Size) => {
    if (!editingItem) return;
    if (size) {
      const sizeRecipes = { ...(editingItem.sizeRecipes || {}) };
      sizeRecipes[size] = (sizeRecipes[size] || []).filter((_, i) => i !== index);
      setEditingItem({ ...editingItem, sizeRecipes });
    } else {
      if (!editingItem.recipe) return;
      const recipe = editingItem.recipe.filter((_, i) => i !== index);
      setEditingItem({ ...editingItem, recipe });
    }
  };

  const inputClasses = "w-full p-3 rounded-xl border-2 border-brand-stone bg-white text-brand-brown font-black text-sm focus:border-brand-yellow outline-none transition-all";

  if (isTableMissing) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center text-center bg-brand-cream overflow-y-auto no-scrollbar">
        <div className="max-w-4xl bg-white p-12 rounded-[3rem] shadow-2xl border-4 border-brand-red">
          <h2 className="text-4xl font-black text-brand-brown mb-4 uppercase italic">Schema <span className="text-brand-red">Cache Missing</span></h2>
          <p className="text-brand-brown/60 mb-6 font-bold uppercase tracking-widest text-xs">Run this SQL in Supabase SQL Editor to fix the sizeRecipes error:</p>
          <div className="text-left bg-slate-900 p-8 rounded-3xl mb-8 overflow-x-auto border-4 border-brand-stone">
            <pre className="text-emerald-400 text-[10px] md:text-[11px] font-mono leading-relaxed">
{`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS "sizeRecipes" JSONB DEFAULT '{}'::jsonb;
NOTIFY pgrst, 'reload schema';`}
            </pre>
          </div>
          <button onClick={loadItems} className="bg-brand-brown text-brand-yellow px-12 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest">Refresh After Running SQL</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full bg-brand-cream overflow-y-auto no-scrollbar">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-5xl font-black text-brand-brown tracking-tighter italic uppercase">MENU <span className="text-brand-yellow">COMMAND</span></h2>
          <p className="text-[10px] font-bold text-brand-brown/40 uppercase tracking-[0.4em] mt-2">Recipe & Supply Chain Link</p>
        </div>
        <div className="flex gap-4">
          <button onClick={handleSeedMenu} disabled={isSeeding} className="bg-emerald-600 text-white px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-transform active:scale-95 disabled:opacity-50">
            {isSeeding ? 'Syncing...' : 'Sync Master Items'}
          </button>
          <button onClick={openAdd} className="bg-brand-brown text-brand-yellow px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-transform">Add Master Item</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-12">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-[3rem] p-6 shadow-sm border border-brand-stone group hover:shadow-2xl transition-all flex flex-col">
            <div className="aspect-square rounded-[2rem] overflow-hidden mb-6 bg-brand-cream border border-brand-stone">
               <img src={item.image || 'https://via.placeholder.com/300?text=No+Image'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
            </div>
            <div className="mb-6 px-2">
              <h3 className="text-xl font-black text-brand-brown leading-tight mb-1">{item.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-brand-red px-2 py-0.5 bg-brand-red/5 rounded-full">{item.category}</span>
                {(item.recipe?.length || 0) > 0 || Object.keys(item.sizeRecipes || {}).length > 0 ? (
                    <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">Linked 🔗</span>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="flex-1 py-4 bg-brand-brown text-brand-yellow rounded-2xl text-[10px] font-black uppercase tracking-widest">Edit</button>
              <button onClick={() => handleDelete(item.id)} className="px-5 py-4 rounded-2xl bg-red-50 text-brand-red hover:bg-brand-red hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && editingItem && (
        <div className="fixed inset-0 bg-brand-brown/95 backdrop-blur-3xl flex items-center justify-center z-[110] p-4">
          <div className="bg-brand-cream rounded-[4rem] p-10 w-full max-w-7xl max-h-[95vh] overflow-y-auto border-8 border-brand-yellow shadow-2xl relative no-scrollbar">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-10 right-10 text-brand-red hover:scale-110 transition-transform">
               <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <h3 className="text-4xl font-black text-brand-brown italic mb-10 uppercase tracking-tighter">Item <span className="text-brand-red">Configuration</span></h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-brand-brown/40 tracking-widest ml-4 mb-2 block">Item Name</label>
                  <input className={inputClasses} value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="e.g. Chicken Cheese Combo" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-brand-brown/40 tracking-widest ml-4 mb-2 block">Image URL (Copy-Paste Link)</label>
                  <input className={inputClasses} value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} placeholder="https://source.unsplash.com/..." />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-brand-brown/40 tracking-widest ml-4 mb-2 block">Category</label>
                  <select className={inputClasses} value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value as any})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                  </select>
                </div>

                <div className="pt-4">
                  <button onClick={handleSave} className="w-full py-6 bg-brand-brown text-brand-yellow rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-transform active:scale-95">Update Master Database</button>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-10">
                <div className="bg-white rounded-[2.5rem] border-2 border-brand-stone overflow-hidden shadow-sm">
                   <div className="p-6 bg-brand-brown/5 border-b border-brand-stone flex justify-between items-center">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-brown">Pricing Matrix</h4>
                      <div className="flex gap-2">
                        {PREP_TYPES.map(prep => (
                            <button 
                            key={prep} 
                            onClick={() => togglePrep(prep)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${editingItem.preparations?.[prep] ? 'bg-brand-red border-brand-red text-white shadow-md' : 'bg-white border-brand-stone text-brand-brown/40'}`}
                            >
                            {prep}
                            </button>
                        ))}
                      </div>
                   </div>
                  <table className="w-full text-left">
                    <thead className="bg-brand-brown/5 text-brand-brown text-[9px] font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Preparation</th>
                        <th className="px-6 py-4 text-center">Small (₹)</th>
                        <th className="px-6 py-4 text-center">Med (₹)</th>
                        <th className="px-6 py-4 text-center">Large (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-stone">
                      {Object.keys(editingItem.preparations || {}).map(prep => (
                        <React.Fragment key={prep}>
                          <tr className="bg-brand-cream/30">
                            <td className="px-6 py-4 font-black text-brand-brown uppercase italic text-xs">
                              {prep} <span className="text-[9px] block font-bold text-brand-red not-italic mt-1">SELLING PRICE</span>
                            </td>
                            {SIZES.map(size => (
                              <td key={size} className="px-4 py-2">
                                <input 
                                  type="number" 
                                  className="w-full bg-white border border-brand-stone p-2 rounded-lg text-center font-black text-sm"
                                  value={editingItem.preparations?.[prep as PreparationType]?.[size] || 0}
                                  onChange={e => updateVal('price', prep as PreparationType, size, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-6 py-4 font-black text-brand-brown/40 uppercase italic text-xs">
                              <span className="text-[9px] block font-bold not-italic">INTERNAL COST</span>
                            </td>
                            {SIZES.map(size => (
                              <td key={size} className="px-4 py-2">
                                <input 
                                  type="number" 
                                  className="w-full bg-brand-cream border border-brand-stone p-2 rounded-lg text-center font-bold text-sm text-brand-brown/60"
                                  value={editingItem.costs?.[prep as PreparationType]?.[size] || 0}
                                  onChange={e => updateVal('cost', prep as PreparationType, size, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-10 bg-brand-stone/10 rounded-[4rem] border-4 border-white space-y-10">
                  <header className="flex justify-between items-center px-4">
                    <div>
                      <h4 className="text-2xl font-black text-brand-brown italic uppercase tracking-tighter">Inventory Logic</h4>
                      <p className="text-[10px] font-bold text-brand-brown/40 uppercase tracking-widest mt-1">
                        {editingItem.category === 'combo' ? 'Custom ingredient counts for each combo size.' : 'Standard Momo pieces auto-deduct (4/6/8).'}
                      </p>
                    </div>
                  </header>

                  <div className={`grid gap-10 ${editingItem.category === 'combo' ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
                    {editingItem.category === 'combo' ? (
                      SIZES.map(size => (
                        <div key={size} className="bg-white rounded-[3.5rem] p-8 shadow-2xl flex flex-col min-h-[450px] relative border border-brand-stone/50">
                          <div className="flex justify-between items-center mb-8 px-2">
                             <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full shadow-inner ${size === 'small' ? 'bg-[#10B981]' : size === 'medium' ? 'bg-[#FBBF24]' : 'bg-[#EF4444]'}`}></div>
                                <h5 className="text-sm font-black uppercase text-brand-brown tracking-tighter">{size.toUpperCase()} VARIANT</h5>
                             </div>
                             <button onClick={() => addRecipeRow(size)} className="bg-[#4A2C2A] text-[#FBBF24] px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform active:scale-95">Add Component</button>
                          </div>
                          
                          <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar pb-6 px-1">
                             {(editingItem.sizeRecipes?.[size] || []).map((row, idx) => {
                                const mat = centralStock.find(m => m.id === row.materialId);
                                return (
                                  <div key={idx} className="bg-white border-2 border-brand-stone rounded-[1.8rem] p-4 flex flex-col gap-3 shadow-sm hover:border-brand-yellow transition-all">
                                    <div className="relative">
                                      <select 
                                        className="w-full bg-transparent text-[11px] font-black p-1 outline-none appearance-none pr-8 cursor-pointer" 
                                        value={row.materialId} 
                                        onChange={e => updateRecipeRow(idx, 'materialId', e.target.value, size)}
                                      >
                                        <option value="">Link Material...</option>
                                        {centralStock.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                      </select>
                                      <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between gap-4 pt-2 border-t border-brand-stone/40">
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="number" 
                                          className="w-16 bg-brand-stone/10 rounded-xl p-2 text-center font-black text-xs outline-none focus:ring-2 focus:ring-brand-yellow" 
                                          value={row.quantity} 
                                          onChange={e => updateRecipeRow(idx, 'quantity', parseFloat(e.target.value) || 0, size)} 
                                        />
                                        <span className="text-[9px] font-black text-brand-brown/40 uppercase tracking-widest">{mat?.category === 'MOMO' ? 'pieces' : mat?.unit || 'qty'}</span>
                                      </div>
                                      <button onClick={() => removeRecipeRow(idx, size)} className="p-2 text-brand-red hover:bg-red-50 rounded-full transition-colors">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    </div>
                                  </div>
                                );
                             })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white rounded-[4rem] p-12 border-2 border-brand-stone shadow-2xl">
                        <div className="flex justify-between items-center mb-10">
                           <h5 className="text-sm font-black uppercase text-brand-brown tracking-tighter">Master Ingredient List</h5>
                           <button onClick={() => addRecipeRow()} className="bg-brand-brown text-brand-yellow px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform active:scale-95">Add Link</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(editingItem.recipe || []).map((row, idx) => {
                             const mat = centralStock.find(m => m.id === row.materialId);
                             return (
                               <div key={idx} className="flex flex-col gap-4 bg-brand-stone/5 p-6 rounded-[2.5rem] border-2 border-brand-stone hover:border-brand-yellow transition-all">
                                  <div className="relative">
                                    <select className="w-full bg-transparent text-xs font-black p-1 outline-none appearance-none pr-8 cursor-pointer" value={row.materialId} onChange={e => updateRecipeRow(idx, 'materialId', e.target.value)}>
                                      <option value="">Bulk Material...</option>
                                      {centralStock.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between pt-4 border-t border-brand-stone/50">
                                    <div className="flex items-center gap-3">
                                      <input type="number" className="w-20 bg-white rounded-xl p-3 text-center font-black text-xs shadow-inner" value={row.quantity} onChange={e => updateRecipeRow(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                                      <span className="text-[10px] font-black text-brand-brown/30 uppercase tracking-widest">{mat?.unit || 'unit'}</span>
                                    </div>
                                    <button onClick={() => removeRecipeRow(idx)} className="text-brand-red p-3 hover:bg-red-50 rounded-full transition-all">
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                               </div>
                             );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManager;
