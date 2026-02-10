
import React, { useState, useCallback, useEffect } from 'react';
import { TABLES } from '../constants';
import { MenuItem as MenuItemType, OrderItem, OrderType, PaymentMethod, DiningTable } from '../types';
import Menu from './Menu';
import Bill from './Bill';
import VariantSelectionModal from './VariantSelectionModal';
import BillPreviewModal from './BillPreviewModal';
import { saveOrder, peekNextBillNumber, fetchMenuItems } from '../utils/storage';
import { supabase } from '../utils/supabase';

const CATEGORIES = [
  { id: 'momo', label: 'Steam & Fried', icon: '♨️' },
  { id: 'side', label: 'Sides', icon: '🥗' },
  { id: 'drink', label: 'Drinks', icon: '🥤' },
  { id: 'combo', label: 'Combos', icon: '🍱' }
];

const POS: React.FC<{ branchName: string }> = ({ branchName }) => {
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('momo');
  const [selectedItem, setSelectedItem] = useState<MenuItemType | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingBillNumber, setPendingBillNumber] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('TAKEAWAY');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [dbTables, setDbTables] = useState<DiningTable[]>([]);
  const [customerPhone, setCustomerPhone] = useState('');

  const filteredItems = Array.isArray(menuItems) ? menuItems.filter(item => item.category === activeCategory) : [];

  useEffect(() => {
    const loadData = async () => {
      const [mResponse, { data: t }] = await Promise.all([
        fetchMenuItems(),
        supabase.from('dining_tables').select('*')
      ]);
      
      if (mResponse.data) {
        setMenuItems(mResponse.data);
      }
      
      if (t) setDbTables(t as DiningTable[]);
    };
    loadData();
  }, [isTableModalOpen]);

  const handleAddItem = useCallback((itemsToAdd: OrderItem[]) => {
    setOrder((prev) => {
      const newOrder = [...prev];
      itemsToAdd.forEach(item => {
        const idx = newOrder.findIndex(i => i.id === item.id);
        if (idx > -1) newOrder[idx].quantity += item.quantity;
        else newOrder.push(item);
      });
      return newOrder;
    });
  }, []);

  const handleUpdateQuantity = (id: string, qty: number) => {
    setOrder(prev => qty <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const handleFinalize = async () => {
    if (orderType === 'DINE_IN' && !selectedTable) {
      setIsTableModalOpen(true);
      return;
    }
    const nextNum = await peekNextBillNumber();
    setPendingBillNumber(nextNum);
    setIsPreviewing(true);
  };

  const handleConfirmOrder = async (method: PaymentMethod) => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      const total = order.reduce((acc, i) => acc + i.price * i.quantity, 0);
      const savedNum = await saveOrder(
        order, 
        total, 
        branchName, 
        orderType, 
        'ORDERED', 
        method, 
        selectedTable?.id
      );
      
      if (savedNum) {
        setOrder([]);
        setSelectedTable(null);
        setCustomerPhone('');
        setIsPreviewing(false);
        setTimeout(() => window.print(), 100);
      }
    } catch (err) {
      alert("An error occurred while finalizing the order.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTableSelect = (table: DiningTable) => {
    if (table.status === 'AVAILABLE') {
      setSelectedTable(table);
      setIsTableModalOpen(false);
    }
  };

  return (
    <div className="flex h-full bg-brand-cream">
      {/* Category Picker */}
      <div className="w-24 lg:w-32 bg-white border-r border-stone-200 flex flex-col p-3 gap-3 shadow-sm z-10">
        <div className="text-[10px] font-black uppercase text-stone-400 tracking-widest text-center mb-2">Menu</div>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex flex-col items-center justify-center aspect-square p-2 rounded-2xl transition-all duration-300 border-2 ${
              activeCategory === cat.id ? 'bg-brand-yellow border-brand-yellow text-brand-brown shadow-lg' : 'bg-white border-stone-100 text-stone-400 hover:border-brand-yellow/30'
            }`}
          >
            <span className="text-xl mb-1">{cat.icon}</span>
            <span className="text-[9px] font-black uppercase tracking-tighter text-center leading-none">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Item Grid */}
      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8">
             <div>
                <h2 className="text-3xl font-black text-brand-brown tracking-tighter italic uppercase">Local <span className="text-brand-red">Favorites</span></h2>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Flavor Station: {branchName}</p>
             </div>
             <div className="flex gap-3">
               {orderType === 'DINE_IN' && (
                 <button 
                  onClick={() => setIsTableModalOpen(true)}
                  className="px-4 py-1.5 bg-brand-yellow text-brand-brown rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-transform"
                 >
                   {selectedTable ? `Table ${selectedTable.number}` : 'Select Table'}
                 </button>
               )}
               <div className="px-4 py-1.5 bg-brand-brown/5 text-brand-brown rounded-full text-[10px] font-black uppercase tracking-widest">
                 {filteredItems.length} Available
               </div>
             </div>
          </div>
          <Menu menuItems={filteredItems} onSelectItem={setSelectedItem} />
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 bg-brand-brown border-l border-brand-brown/10 flex flex-col shadow-2xl relative z-10">
        <div className="p-4 border-b border-white/5 bg-brand-brown/90">
          <div className="flex bg-black/20 p-1 rounded-2xl mb-4">
            {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as OrderType[]).map(type => (
              <button
                key={type}
                onClick={() => {
                  setOrderType(type);
                  if (type !== 'DINE_IN') setSelectedTable(null);
                }}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                  orderType === type ? 'bg-brand-yellow text-brand-brown shadow-md scale-[1.02]' : 'text-brand-cream/40 hover:text-brand-cream/60'
                }`}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-brand-cream/40 tracking-[0.2em]">Customer Contact</label>
            <input 
              type="tel"
              placeholder="Enter Phone Number..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl p-3 text-sm font-bold text-brand-cream outline-none focus:border-brand-yellow transition-colors placeholder:text-white/20"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <Bill 
            orderItems={order} 
            onUpdateQuantity={handleUpdateQuantity} 
            onClear={() => { setOrder([]); setSelectedTable(null); setCustomerPhone(''); }} 
            onPreview={handleFinalize}
            branchName={branchName}
            onAddItem={handleAddItem}
          />
        </div>
      </div>

      {/* Table Selection Modal */}
      {isTableModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-brand-cream rounded-[3rem] shadow-2xl w-full max-w-4xl p-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-3xl font-black text-brand-brown italic uppercase">Seating <span className="text-brand-red">Plan</span></h3>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Assign Base Camp</p>
              </div>
              <button onClick={() => setIsTableModalOpen(false)} className="text-brand-brown/40 hover:text-brand-brown transition-colors">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l18 18" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 overflow-y-auto pr-2 no-scrollbar">
              {TABLES.map(table => {
                const dbTable = dbTables.find(dt => dt.id === table.id);
                const status = dbTable?.status || 'AVAILABLE';
                return (
                  <button
                    key={table.id}
                    disabled={status !== 'AVAILABLE'}
                    onClick={() => handleTableSelect({ ...table, status })}
                    className={`aspect-square rounded-3xl p-4 flex flex-col items-center justify-center border-4 transition-all ${
                      selectedTable?.id === table.id ? 'bg-brand-yellow border-brand-yellow text-brand-brown shadow-xl scale-105' :
                      status === 'AVAILABLE' ? 'bg-white border-brand-stone text-brand-brown hover:border-brand-yellow/30' :
                      'bg-stone-200 border-stone-300 text-stone-400 cursor-not-allowed grayscale'
                    }`}
                  >
                    <span className="text-3xl font-black">{table.number}</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest mt-1">{status}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <VariantSelectionModal item={selectedItem} onClose={() => setSelectedItem(null)} onAddItem={handleAddItem} />
      <BillPreviewModal 
        isOpen={isPreviewing} 
        onClose={() => setIsPreviewing(false)} 
        onConfirm={handleConfirmOrder} 
        orderItems={order}
        billNumber={pendingBillNumber}
        branchName={branchName}
        onAddItem={handleAddItem}
        onUpdateQuantity={handleUpdateQuantity}
        isSaving={isSaving}
        orderType={orderType}
        tableId={selectedTable?.id}
        customerPhone={customerPhone}
      />
    </div>
  );
};

export default POS;
