
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getOrdersForDateRange, getOrderByBillNumber, deleteOrderByBillNumber, getDeletedOrdersForDateRange, getStations, fetchProcurements, getCentralInventory } from '../utils/storage';
import { CompletedOrder, PaymentMethod, Station, User, CentralMaterial } from '../types';
import PrintReceipt from './PrintReceipt';
import DeleteBillModal from './DeleteBillModal';
import ItemSalesReport from './ItemSalesReport';

const getTodaysDateString = () => new Date().toISOString().split('T')[0];
const getDateString = (date: Date) => date.toISOString().split('T')[0];

interface AnalyticsProps {
  user: User;
}

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';
type ActiveTab = 'active' | 'deleted';
type ReportView = 'revenue' | 'itemSales' | 'comparison' | 'profitability';

const Analytics: React.FC<AnalyticsProps> = ({ user }) => {
  const isAdmin = user.role === 'ADMIN';
  
  const [startDate, setStartDate] = useState<string>(getTodaysDateString());
  const [endDate, setEndDate] = useState<string>(getTodaysDateString());
  const [activePreset, setActivePreset] = useState<DatePreset>('today');
  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  const [reportView, setReportView] = useState<ReportView>('revenue');
  const [selectedStore, setSelectedStore] = useState<string>(isAdmin ? 'All' : (user.stationName || 'All'));
  const [availableStations, setAvailableStations] = useState<Station[]>([]);
  
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [allOrdersRaw, setAllOrdersRaw] = useState<CompletedOrder[]>([]);
  const [deletedOrders, setDeletedOrders] = useState<CompletedOrder[]>([]);
  const [procurements, setProcurements] = useState<any[]>([]);
  const [centralInv, setCentralInv] = useState<CentralMaterial[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [foundOrder, setFoundOrder] = useState<CompletedOrder | null>(null);
  const [searchMessage, setSearchMessage] = useState('');

  // Fixed Costs (Persisted in localStorage for convenience)
  const [salaryRate, setSalaryRate] = useState<number>(Number(localStorage.getItem('momo_salary_rate') || 1200));
  const [rentRate, setRentRate] = useState<number>(Number(localStorage.getItem('momo_rent_rate') || 800));

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<CompletedOrder | null>(null);

  const fetchStaticData = useCallback(async () => {
    if (isAdmin) {
      const [s, c] = await Promise.all([getStations(), getCentralInventory()]);
      setAvailableStations(s);
      setCentralInv(c);
    }
  }, [isAdmin]);

  const fetchOrders = useCallback(async () => {
    const fetchedOrders = await getOrdersForDateRange(startDate, endDate);
    setAllOrdersRaw(fetchedOrders);
    
    // Filter by store - Managers only see their own
    const storeToFilter = isAdmin ? selectedStore : (user.stationName || 'All');
    const filtered = storeToFilter === 'All' 
      ? fetchedOrders 
      : fetchedOrders.filter(o => o.branchName === storeToFilter);
      
    setOrders([...filtered].sort((a, b) => b.billNumber - a.billNumber));
  }, [startDate, endDate, selectedStore, isAdmin, user.stationName]);

  const fetchFinanceData = useCallback(async () => {
    if (!isAdmin) return;
    const pRes = await fetchProcurements(startDate, endDate);
    setProcurements(pRes.data || []);
  }, [isAdmin, startDate, endDate]);

  const fetchDeletedOrders = useCallback(async () => {
    const fetchedOrders = await getDeletedOrdersForDateRange(startDate, endDate);
    const storeToFilter = isAdmin ? selectedStore : (user.stationName || 'All');
    const filtered = storeToFilter === 'All' 
      ? fetchedOrders 
      : fetchedOrders.filter(o => o.branchName === storeToFilter);
    setDeletedOrders([...filtered].sort((a, b) => b.billNumber - a.billNumber));
  }, [startDate, endDate, selectedStore, isAdmin, user.stationName]);

  useEffect(() => {
    fetchStaticData();
  }, [fetchStaticData]);

  useEffect(() => {
    fetchOrders();
    fetchDeletedOrders();
    fetchFinanceData();
  }, [fetchOrders, fetchDeletedOrders, fetchFinanceData]);

  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset);
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'yesterday':
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        start = yesterday;
        end = yesterday;
        break;
      case 'last7':
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 6);
        start = weekAgo;
        end = today;
        break;
      case 'last30':
        const monthAgo = new Date();
        monthAgo.setDate(today.getDate() - 29);
        start = monthAgo;
        end = today;
        break;
    }
    setStartDate(getDateString(start));
    setEndDate(getDateString(end));
  };

  const handleSearch = async () => {
    setFoundOrder(null);
    setSearchMessage('');
    if (!searchTerm.trim()) return;
    const billNum = parseInt(searchTerm, 10);
    if (isNaN(billNum)) {
      setSearchMessage('Please enter a valid bill number.');
      return;
    };
    const order = await getOrderByBillNumber(billNum);
    if (order) {
      setFoundOrder(order);
    } else {
      setSearchMessage(`Bill #${billNum} was not found in the records.`);
    }
  };

  const confirmDelete = async (reason: string) => {
    if (orderToDelete) {
      await deleteOrderByBillNumber(orderToDelete.billNumber, reason);
      setIsDeleteModalOpen(false);
      fetchOrders();
      fetchDeletedOrders();
    }
  };

  const financialData = useMemo(() => {
    let revenue = 0;
    let cogs = 0;
    const breakdown: Record<PaymentMethod, number> = { 'Cash': 0, 'UPI': 0, 'Card': 0 };

    orders.forEach(order => {
      revenue += order.total;
      const orderCogs = order.items.reduce((acc, item) => acc + (item.cost ?? 0) * item.quantity, 0);
      cogs += orderCogs;
      if (order.paymentMethod && order.paymentMethod in breakdown) {
        breakdown[order.paymentMethod as PaymentMethod] += order.total;
      }
    });
    
    const grossProfit = revenue - cogs;
    return { 
      totalRevenue: revenue, 
      totalCogs: cogs,
      grossProfit,
      profitMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      averageOrderValue: orders.length > 0 ? revenue / orders.length : 0,
      paymentBreakdown: breakdown,
      totalOrders: orders.length,
    };
  }, [orders]);

  const pnlData = useMemo(() => {
    if (!isAdmin) return null;

    const indirectCogs = procurements.reduce((acc, p) => {
      const item = centralInv.find(ci => ci.id === p.item_id);
      if (item && (item.category === 'PACKET' || item.category === 'INGREDIENT')) {
        return acc + (p.total_cost || 0);
      }
      return acc;
    }, 0);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const totalSalary = daysCount * salaryRate;
    const totalRent = daysCount * rentRate;
    const fixedCosts = totalSalary + totalRent;
    
    const netProfit = financialData.grossProfit - indirectCogs - fixedCosts;

    return {
      indirectCogs,
      fixedCosts,
      salary: totalSalary,
      rent: totalRent,
      netProfit,
      days: daysCount
    };
  }, [isAdmin, procurements, centralInv, financialData, startDate, endDate, salaryRate, rentRate]);

  const comparisonData = useMemo(() => {
    if (!isAdmin) return [];
    const stores: Record<string, { revenue: number, orders: number, profit: number }> = {};
    allOrdersRaw.forEach(order => {
      if (!stores[order.branchName]) stores[order.branchName] = { revenue: 0, orders: 0, profit: 0 };
      stores[order.branchName].revenue += order.total;
      stores[order.branchName].orders += 1;
      const orderCogs = order.items.reduce((acc, item) => acc + (item.cost ?? 0) * item.quantity, 0);
      stores[order.branchName].profit += (order.total - orderCogs);
    });
    return Object.entries(stores).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.revenue - a.revenue);
  }, [isAdmin, allOrdersRaw]);

  const SummaryCard = ({ title, value, sub, color, textWhite }: any) => (
    <div className={`${color} p-6 lg:p-8 rounded-[2rem] lg:rounded-[3rem] shadow-sm relative overflow-hidden group border border-black/5`}>
      <p className={`text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${textWhite ? 'text-white/60' : 'text-brand-brown/40'}`}>{title}</p>
      <h3 className={`text-3xl lg:text-4xl font-black tracking-tighter ${textWhite ? 'text-white' : 'text-brand-brown'}`}>₹{value.toLocaleString()}</h3>
      <p className={`text-[8px] lg:text-[9px] font-bold uppercase tracking-widest mt-2 ${textWhite ? 'text-white/40' : 'text-brand-brown/60'}`}>{sub}</p>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 h-full bg-brand-cream overflow-y-auto no-scrollbar pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl lg:text-5xl font-black text-brand-brown tracking-tighter italic uppercase leading-none">BUSINESS <span className="text-brand-red">PEAK</span></h2>
            <p className="text-[8px] lg:text-[10px] font-bold text-brand-brown/40 uppercase tracking-[0.4em] mt-2">Intelligence Dashboard</p>
          </div>
          
          <div className="flex flex-col gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-white shadow-xl p-2 rounded-2xl border-4 border-brand-brown">
               <input 
                  type="number" 
                  placeholder="SEARCH BILL #" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="bg-transparent text-[10px] font-black uppercase px-4 py-2 outline-none w-32"
               />
               <button onClick={handleSearch} className="bg-brand-brown text-brand-yellow px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Find</button>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-white/50 p-2 rounded-2xl lg:rounded-3xl border border-brand-stone">
              {(['today', 'yesterday', 'last7', 'last30', 'custom'] as DatePreset[]).map(p => (
                <button key={p} onClick={() => handlePresetChange(p)} className={`px-3 lg:px-4 py-2 text-[8px] lg:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activePreset === p ? 'bg-brand-brown text-brand-yellow shadow-lg' : 'text-brand-brown/40 hover:bg-brand-brown/10'}`}>{p}</button>
              ))}
              {activePreset === 'custom' && (
                <div className="flex items-center gap-2 pl-2 lg:pl-4 border-l border-brand-stone ml-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-[8px] lg:text-[10px] font-black uppercase p-1 outline-none" />
                  <span className="text-brand-brown/20">-</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-[8px] lg:text-[10px] font-black uppercase p-1 outline-none" />
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 bg-white/50 p-2 rounded-2xl lg:rounded-3xl border border-brand-stone w-full lg:w-auto lg:self-end">
                <span className="text-[8px] lg:text-[10px] font-black uppercase text-brand-brown/40 tracking-widest pl-2 lg:pl-4">Filter:</span>
                <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="flex-1 bg-transparent text-[8px] lg:text-[10px] font-black uppercase p-2 outline-none border-0 text-brand-brown font-bold">
                  <option value="All">All Stores</option>
                  {availableStations.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </header>

        {foundOrder && (
          <div className="mb-10 animate-in zoom-in-95 duration-500 relative">
             <div className="bg-white rounded-[3rem] p-10 border-8 border-brand-red shadow-2xl flex flex-col md:flex-row gap-10">
                <div className="flex-1">
                   <div className="flex items-center gap-4 mb-6">
                      <span className="bg-brand-red text-white px-6 py-2 rounded-full font-black text-sm italic">SEARCH RESULT</span>
                      <button onClick={() => setFoundOrder(null)} className="text-brand-brown/20 hover:text-brand-red font-black text-xs uppercase underline">Clear Search</button>
                   </div>
                   <h3 className="text-5xl font-black text-brand-brown tracking-tighter uppercase mb-2">BILL <span className="text-brand-red">#{foundOrder.billNumber}</span></h3>
                   <div className="grid grid-cols-2 gap-4 mt-8">
                      <div className="bg-brand-brown/5 p-4 rounded-2xl">
                         <p className="text-[8px] font-black text-brand-brown/40 uppercase tracking-widest mb-1">Status</p>
                         <p className="font-black text-brand-brown uppercase italic text-sm">{foundOrder.deletionInfo ? 'Voided / Deleted' : foundOrder.status}</p>
                      </div>
                      <div className="bg-brand-brown/5 p-4 rounded-2xl">
                         <p className="text-[8px] font-black text-brand-brown/40 uppercase tracking-widest mb-1">Total Amount</p>
                         <p className="font-black text-brand-red italic text-xl">₹{foundOrder.total.toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="mt-8 space-y-4">
                      {foundOrder.items.map((it, idx) => (
                         <div key={idx} className="flex justify-between items-center border-b border-brand-stone pb-2">
                            <span className="font-black text-brand-brown uppercase text-xs">x{it.quantity} {it.name}</span>
                            <span className="font-bold text-brand-brown/60 text-xs">₹{it.price * it.quantity}</span>
                         </div>
                      ))}
                   </div>
                   {foundOrder.deletionInfo && (
                      <div className="mt-8 p-6 bg-red-50 rounded-2xl border-2 border-brand-red/20">
                         <p className="text-[10px] font-black text-brand-red uppercase mb-2">Deletion Audit</p>
                         <p className="text-xs font-bold text-brand-brown italic">Reason: {foundOrder.deletionInfo.reason}</p>
                         <p className="text-[9px] font-black text-brand-brown/40 uppercase mt-2">At: {new Date(foundOrder.deletionInfo.date).toLocaleString()}</p>
                      </div>
                   )}
                   {!foundOrder.deletionInfo && (
                      <button onClick={() => { setOrderToDelete(foundOrder); setIsDeleteModalOpen(true); }} className="mt-10 w-full py-5 bg-red-100 text-brand-red rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-red hover:text-white transition-all">Void Bill Records</button>
                   )}
                </div>
                <div className="w-full md:w-80 bg-brand-cream rounded-[2rem] p-4 border-2 border-brand-stone shadow-inner">
                   <PrintReceipt 
                    orderItems={foundOrder.items} 
                    billNumber={foundOrder.billNumber} 
                    branchName={foundOrder.branchName} 
                    date={foundOrder.date} 
                    paymentMethod={foundOrder.paymentMethod}
                   />
                </div>
             </div>
          </div>
        )}

        {searchMessage && (
           <div className="mb-10 p-6 bg-brand-red/10 rounded-3xl text-center border-2 border-brand-red/20 text-brand-red font-black text-xs uppercase tracking-widest">
              {searchMessage}
           </div>
        )}
        
        <div className="flex flex-wrap rounded-2xl lg:rounded-[2rem] overflow-hidden border-2 lg:border-4 border-brand-brown shadow-xl mb-10">
          <button onClick={() => setReportView('revenue')} className={`flex-1 min-w-[50%] lg:min-w-0 py-3 lg:py-4 text-[10px] font-black uppercase tracking-widest transition-all ${reportView === 'revenue' ? 'bg-brand-brown text-brand-yellow' : 'bg-white text-brand-brown/40 hover:bg-brand-brown/5'}`}>Revenue</button>
          <button onClick={() => setReportView('itemSales')} className={`flex-1 min-w-[50%] lg:min-w-0 py-3 lg:py-4 text-[10px] font-black uppercase tracking-widest transition-all ${reportView === 'itemSales' ? 'bg-brand-brown text-brand-yellow' : 'bg-white text-brand-brown/40 hover:bg-brand-brown/5'}`}>Items</button>
          {isAdmin && (
            <>
              <button onClick={() => setReportView('comparison')} className={`flex-1 min-w-[50%] lg:min-w-0 py-3 lg:py-4 text-[10px] font-black uppercase tracking-widest transition-all ${reportView === 'comparison' ? 'bg-brand-brown text-brand-yellow' : 'bg-white text-brand-brown/40 hover:bg-brand-brown/5'}`}>Compare</button>
              <button onClick={() => setReportView('profitability')} className={`flex-1 min-w-[50%] lg:min-w-0 py-3 lg:py-4 text-[10px] font-black uppercase tracking-widest transition-all ${reportView === 'profitability' ? 'bg-brand-red text-white' : 'bg-white text-brand-brown/40 hover:bg-brand-brown/5'}`}>P&L</button>
            </>
          )}
        </div>

        {reportView === 'revenue' && (
          <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <SummaryCard title="Total Revenue" value={financialData.totalRevenue} sub={`${financialData.totalOrders} Orders`} color="bg-brand-yellow" />
              <SummaryCard title="Gross Profit" value={financialData.grossProfit} sub="Direct Margin" color="bg-emerald-500" textWhite />
              <SummaryCard title="Order COGS" value={financialData.totalCogs} sub="Materials" color="bg-brand-red" textWhite />
              <SummaryCard title="Avg Ticket" value={financialData.averageOrderValue} sub="Per Order" color="bg-brand-brown" textWhite />
            </div>
            
            <div className="bg-white rounded-2xl lg:rounded-[3rem] p-4 lg:p-10 shadow-xl border border-brand-stone overflow-x-auto">
              <div className="flex justify-between items-center mb-6">
                <div className="flex bg-brand-brown/5 p-1 rounded-2xl">
                  <button onClick={() => setActiveTab('active')} className={`px-4 lg:px-8 py-2 lg:py-3 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-brand-brown text-brand-yellow' : 'text-brand-brown/40'}`}>Active</button>
                  <button onClick={() => setActiveTab('deleted')} className={`px-4 lg:px-8 py-2 lg:py-3 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'deleted' ? 'bg-brand-brown text-brand-yellow' : 'text-brand-brown/40'}`}>Voided</button>
                </div>
              </div>
              <div className="min-w-[600px]">
                <table className="w-full text-left">
                  <thead><tr className="bg-brand-brown/5 text-brand-brown/40 text-[9px] lg:text-[10px] font-black uppercase"><th className="px-4 lg:px-8 py-4">Bill #</th><th className="px-4 lg:px-8 py-4">Date</th><th className="px-4 lg:px-8 py-4">Branch</th><th className="px-4 lg:px-8 py-4 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-brand-stone">
                    {(activeTab === 'active' ? orders : deletedOrders).map(o => (
                      <tr key={o.id} className="hover:bg-brand-cream/50 cursor-pointer" onClick={() => { setSearchTerm(o.billNumber.toString()); handleSearch(); }}><td className="px-4 lg:px-8 py-4 font-black text-xs lg:text-sm">#{o.billNumber}</td><td className="px-4 lg:px-8 py-4 text-[10px] lg:text-xs">{new Date(o.date).toLocaleDateString()}</td><td className="px-4 lg:px-8 py-4 text-[9px] lg:text-[10px] font-bold uppercase">{o.branchName}</td><td className="px-4 lg:px-8 py-4 text-right font-black text-xs lg:text-sm">₹{o.total}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {reportView === 'comparison' && isAdmin && (
          <div className="grid grid-cols-1 gap-4 lg:gap-8 animate-in slide-in-from-bottom-6 duration-700">
            {comparisonData.map((store, idx) => (
              <div key={store.name} className="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[3rem] border-2 border-brand-stone flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-4 lg:gap-8">
                  <span className="text-2xl lg:text-4xl font-black text-brand-brown/10 italic">#{idx + 1}</span>
                  <div>
                    <h4 className="text-lg lg:text-2xl font-black text-brand-brown uppercase leading-none">{store.name}</h4>
                    <p className="text-[8px] lg:text-[10px] font-bold text-brand-brown/40 uppercase tracking-widest mt-1">{store.orders} Orders</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl lg:text-3xl font-black text-brand-brown">₹{store.revenue.toLocaleString()}</span>
                  <p className="text-[8px] lg:text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">₹{store.profit.toLocaleString()} GP</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {reportView === 'profitability' && isAdmin && pnlData && (
          <div className="animate-in fade-in zoom-in-95 duration-700 space-y-6 lg:space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              <div className="bg-white p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[4rem] border-2 lg:border-4 border-brand-stone shadow-xl">
                <h3 className="text-lg lg:text-xl font-black italic text-brand-brown uppercase mb-6 lg:mb-8 underline decoration-brand-yellow decoration-4 lg:decoration-8 underline-offset-4 lg:underline-offset-8">Fixed Cost <span className="text-brand-yellow">Params</span></h3>
                <div className="space-y-4 lg:space-y-6">
                  <div>
                    <label className="text-[8px] lg:text-[10px] font-black uppercase text-brand-brown/40 tracking-widest ml-4 mb-2 block">Daily Salary (₹)</label>
                    <input type="number" value={salaryRate} onChange={e => { const val = Number(e.target.value); setSalaryRate(val); localStorage.setItem('momo_salary_rate', val.toString()); }} className="w-full p-4 lg:p-6 rounded-2xl lg:rounded-3xl border-2 border-brand-stone bg-brand-cream/30 font-black text-lg lg:text-xl text-brand-brown outline-none focus:border-brand-yellow transition-all" />
                  </div>
                  <div>
                    <label className="text-[8px] lg:text-[10px] font-black uppercase text-brand-brown/40 tracking-widest ml-4 mb-2 block">Daily Rent (₹)</label>
                    <input type="number" value={rentRate} onChange={e => { const val = Number(e.target.value); setRentRate(val); localStorage.setItem('momo_rent_rate', val.toString()); }} className="w-full p-4 lg:p-6 rounded-2xl lg:rounded-3xl border-2 border-brand-stone bg-brand-cream/30 font-black text-lg lg:text-xl text-brand-brown outline-none focus:border-brand-yellow transition-all" />
                  </div>
                  <p className="text-[8px] lg:text-[10px] font-bold text-brand-brown/40 uppercase tracking-widest text-center mt-4 italic">Period: {pnlData.days} days</p>
                </div>
              </div>

              <div className="bg-brand-brown rounded-[2.5rem] lg:rounded-[4rem] p-8 lg:p-12 text-brand-cream shadow-2xl relative overflow-hidden">
                <h3 className="text-2xl lg:text-3xl font-black italic text-brand-yellow uppercase mb-8 lg:mb-10 tracking-tighter">Net <span className="text-white">Profit</span></h3>
                <div className="space-y-6 lg:space-y-8">
                  <div className="flex justify-between items-end border-b border-white/10 pb-2 lg:pb-4">
                    <span className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-white/40">Gross Profit</span>
                    <span className="text-xl lg:text-2xl font-black text-brand-yellow">₹{financialData.grossProfit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-white/10 pb-2 lg:pb-4">
                    <span className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-white/40">Indirect COGS</span>
                    <span className="text-xl lg:text-2xl font-black text-brand-red">- ₹{pnlData.indirectCogs.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-white/10 pb-2 lg:pb-4">
                    <span className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-white/40">Fixed Costs</span>
                    <span className="text-xl lg:text-2xl font-black text-brand-red">- ₹{pnlData.fixedCosts.toLocaleString()}</span>
                  </div>
                  <div className="pt-4 flex justify-between items-center">
                    <span className="text-base lg:text-xl font-black uppercase tracking-tighter italic">Net Profit</span>
                    <span className={`text-4xl lg:text-5xl font-black tracking-tighter ${pnlData.netProfit >= 0 ? 'text-emerald-400' : 'text-brand-red'}`}>₹{pnlData.netProfit.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 lg:p-12 rounded-[2.5rem] lg:rounded-[4rem] border border-brand-stone shadow-sm overflow-x-auto">
              <h4 className="text-[10px] lg:text-sm font-black uppercase text-brand-brown/30 tracking-[0.5em] text-center mb-10">Flow Cascade</h4>
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 min-w-[800px] max-w-5xl mx-auto">
                <div className="text-center"><p className="text-[10px] font-black uppercase text-brand-brown/40 mb-2">Revenue</p><p className="text-2xl lg:text-3xl font-black">₹{financialData.totalRevenue.toLocaleString()}</p></div>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-brand-brown/5 rounded-full flex items-center justify-center font-black opacity-20">-</div>
                <div className="text-center"><p className="text-[10px] font-black uppercase text-brand-brown/40 mb-2">Order COGS</p><p className="text-xl lg:text-2xl font-black">₹{financialData.totalCogs.toLocaleString()}</p></div>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-brand-brown/5 rounded-full flex items-center justify-center font-black opacity-20">=</div>
                <div className="text-center"><p className="text-[10px] font-black uppercase text-brand-brown/40 mb-2">Gross Profit</p><p className="text-xl lg:text-2xl font-black text-emerald-600">₹{financialData.grossProfit.toLocaleString()}</p></div>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-brand-brown/5 rounded-full flex items-center justify-center font-black opacity-20">-</div>
                <div className="text-center"><p className="text-[10px] font-black uppercase text-brand-brown/40 mb-2">Ind/Fixed</p><p className="text-xl lg:text-2xl font-black text-brand-red">₹{(pnlData.indirectCogs + pnlData.fixedCosts).toLocaleString()}</p></div>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-brand-brown/5 rounded-full flex items-center justify-center font-black opacity-20">=</div>
                <div className="text-center"><p className="text-[10px] font-black uppercase text-emerald-600 mb-2">Final Result</p><p className="text-3xl lg:text-4xl font-black text-brand-brown">₹{pnlData.netProfit.toLocaleString()}</p></div>
              </div>
            </div>
          </div>
        )}

        {reportView === 'itemSales' && <ItemSalesReport orders={orders} />}
      </div>
      
      <DeleteBillModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete} billNumber={orderToDelete?.billNumber || null} />
    </div>
  );
};

export default Analytics;
