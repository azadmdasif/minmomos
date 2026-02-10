import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getOrdersForDateRange, getOrderByBillNumber, deleteOrderByBillNumber, getDeletedOrdersForDateRange } from './storage';
import { CompletedOrder, PaymentMethod } from './types';
import PrintReceipt from './PrintReceipt';
import DeleteBillModal from './DeleteBillModal';
import ItemSalesReport from './ItemSalesReport';

const getTodaysDateString = () => new Date().toISOString().split('T')[0];
const getDateString = (date: Date) => date.toISOString().split('T')[0];

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';
type ActiveTab = 'active' | 'deleted';
type ReportView = 'dashboard' | 'itemSales';

const Analytics: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(getTodaysDateString());
  const [endDate, setEndDate] = useState<string>(getTodaysDateString());
  const [activePreset, setActivePreset] = useState<DatePreset>('today');
  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  const [reportView, setReportView] = useState<ReportView>('dashboard');
  
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [deletedOrders, setDeletedOrders] = useState<CompletedOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [foundOrder, setFoundOrder] = useState<CompletedOrder | null>(null);
  const [searchMessage, setSearchMessage] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<CompletedOrder | null>(null);

  const fetchOrders = useCallback(() => {
    const fetchedOrders = getOrdersForDateRange(startDate, endDate);
    setOrders(fetchedOrders.sort((a, b) => b.billNumber - a.billNumber));
  }, [startDate, endDate]);

  const fetchDeletedOrders = useCallback(() => {
    const fetchedOrders = getDeletedOrdersForDateRange(startDate, endDate);
    setDeletedOrders(fetchedOrders.sort((a, b) => b.billNumber - a.billNumber));
  }, [startDate, endDate]);

  useEffect(() => {
    fetchOrders();
    fetchDeletedOrders();
  }, [fetchOrders, fetchDeletedOrders]);

  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset);
    const today = new Date();
    switch (preset) {
      case 'today':
        setStartDate(getDateString(today));
        setEndDate(getDateString(today));
        break;
      case 'yesterday':
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        setStartDate(getDateString(yesterday));
        setEndDate(getDateString(yesterday));
        break;
      case 'last7':
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 6);
        setStartDate(getDateString(weekAgo));
        setEndDate(getDateString(today));
        break;
      case 'last30':
        const monthAgo = new Date();
        monthAgo.setDate(today.getDate() - 29);
        setStartDate(getDateString(monthAgo));
        setEndDate(getDateString(today));
        break;
      case 'custom':
        break;
    }
  };

  const handleSearch = () => {
    setFoundOrder(null);
    if (!searchTerm.trim()) {
      setSearchMessage('Please enter a bill number.');
      return;
    }
    const billNum = parseInt(searchTerm, 10);
    if (isNaN(billNum)) {
      setSearchMessage('Invalid bill number. Please enter numbers only.');
      return;
    }
    const order = getOrderByBillNumber(billNum);
    if (order) {
      setFoundOrder(order);
      setSearchMessage(order.deletionInfo ? `Bill #${billNum} was found (deleted).` : '');
    } else {
      setSearchMessage(`Bill number #${billNum} was not found.`);
    }
  };

  const handleDeleteClick = (order: CompletedOrder) => {
    setOrderToDelete(order);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = (reason: string) => {
    if (orderToDelete) {
      deleteOrderByBillNumber(orderToDelete.billNumber, reason);
      if (foundOrder && foundOrder.billNumber === orderToDelete.billNumber) {
        setFoundOrder(null);
        setSearchMessage(`Bill #${orderToDelete.billNumber} has been deleted.`);
      }
      setOrderToDelete(null);
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
      const orderCogs = order.items.reduce((acc, item) => {
        return acc + (item.cost ?? 0) * item.quantity;
      }, 0);
      cogs += orderCogs;

      if (order.paymentMethod in breakdown) {
        breakdown[order.paymentMethod] += order.total;
      }
    });
    
    const grossProfit = revenue - cogs;
    const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const avgOrderValue = orders.length > 0 ? revenue / orders.length : 0;

    return { 
      totalRevenue: revenue, 
      totalCogs: cogs,
      grossProfit,
      profitMargin,
      averageOrderValue: avgOrderValue,
      paymentBreakdown: breakdown,
      totalOrders: orders.length,
    };
  }, [orders]);

  const handleExportCSV = useCallback(() => {
    if (orders.length === 0) {
      alert("No active orders to export for the selected period.");
      return;
    }

    const headers = [
      "Bill #", "Date", "Time", "Branch", "Payment Method", "Item Name", 
      "Item Quantity", "Item Price", "Item Cost", "Item Subtotal", "Item Total Cost", "Item Profit"
    ];

    const csvRows = [headers.join(',')];

    orders.forEach(order => {
      const orderDate = new Date(order.date);
      const date = orderDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
      const time = orderDate.toLocaleTimeString('en-US', { hour12: false });

      order.items.forEach(item => {
        const itemCost = item.cost ?? 0;
        const subtotal = item.quantity * item.price;
        const totalCost = item.quantity * itemCost;
        const profit = subtotal - totalCost;
        const row = [
          order.billNumber, date, time, `"${order.branchName.replace(/"/g, '""')}"`,
          order.paymentMethod, `"${item.name.replace(/"/g, '""')}"`, item.quantity,
          item.price.toFixed(2), itemCost.toFixed(2), subtotal.toFixed(2),
          totalCost.toFixed(2), profit.toFixed(2)
        ];
        csvRows.push(row.join(','));
      });
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `Momomaya_Financial_Report_${startDate}_to_${endDate}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  }, [orders, startDate, endDate]);

  const DateFilterButton = ({ preset, label }: { preset: DatePreset, label: string }) => (
    <button onClick={() => handlePresetChange(preset)} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${activePreset === preset ? 'bg-brand-red text-white' : 'bg-brand-brown/10 hover:bg-brand-brown/20 text-brand-brown'}`}>{label}</button>
  );
  
  const ReportTabButton = ({label, isActive, onClick}: {label: string, isActive: boolean, onClick: () => void}) => (
    <button onClick={onClick} className={`py-3 px-6 font-semibold text-base transition-colors ${isActive ? 'border-b-2 border-brand-red text-brand-brown' : 'text-brand-brown/60 hover:text-brand-brown'}`}>
        {label}
    </button>
  );

  return (
    <>
      <div className="p-4 md:p-6 h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-extrabold text-brand-brown mb-4">Reports & Analytics</h2>

          <div className="bg-white p-3 rounded-lg shadow-md mb-6 border border-brand-brown/10">
            <div className="flex flex-wrap items-center gap-2">
              <DateFilterButton preset="today" label="Today" />
              <DateFilterButton preset="yesterday" label="Yesterday" />
              <DateFilterButton preset="last7" label="Last 7 Days" />
              <DateFilterButton preset="last30" label="Last 30 Days" />
              <DateFilterButton preset="custom" label="Custom" />
              {activePreset === 'custom' && (
                <div className="flex items-center gap-2 flex-wrap ml-2 border-l border-brand-brown/20 pl-4">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-brand-brown/5 text-brand-brown rounded-md p-2 border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-red" />
                    <span>to</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-brand-brown/5 text-brand-brown rounded-md p-2 border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-red" />
                </div>
              )}
            </div>
          </div>
          
          <div className="flex border-b border-brand-brown/10">
            <ReportTabButton label="Dashboard" isActive={reportView === 'dashboard'} onClick={() => setReportView('dashboard')} />
            <ReportTabButton label="Item Sales Report" isActive={reportView === 'itemSales'} onClick={() => setReportView('itemSales')} />
          </div>

          {reportView === 'dashboard' && (
            <div className="mt-6">
              <FinancialSummaryCard data={financialData} />

              <div className="bg-white p-4 rounded-lg shadow-md my-6 border border-brand-brown/10">
                <h3 className="text-sm font-medium text-brand-brown/70 mb-2">Revenue by Payment Method</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <PaymentMetric title="Cash" value={`₹${financialData.paymentBreakdown.Cash.toFixed(2)}`} />
                  <PaymentMetric title="UPI" value={`₹${financialData.paymentBreakdown.UPI.toFixed(2)}`} />
                  <PaymentMetric title="Card" value={`₹${financialData.paymentBreakdown.Card.toFixed(2)}`} />
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-md mb-6 border border-brand-brown/10">
                <h3 className="text-lg font-semibold mb-2">Find a Bill</h3>
                <div className="flex gap-2">
                  <input type="search" placeholder="Enter Bill Number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="flex-grow bg-brand-brown/5 text-brand-brown rounded-md p-2 border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-red" />
                  <button onClick={handleSearch} className="bg-brand-red hover:bg-brand-red/90 text-white font-bold py-2 px-4 rounded-lg transition-colors">Search</button>
                </div>
                {searchMessage && <p className="text-sm mt-2 text-brand-yellow-dark">{searchMessage}</p>}
                {foundOrder && (
                  <div className="mt-4 p-4 bg-brand-cream rounded-lg border border-brand-brown/10">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-lg">Found Bill #{foundOrder.billNumber}</h4>
                          <p className="text-xs text-brand-brown/70">Branch: {foundOrder.branchName}</p>
                        </div>
                        {!foundOrder.deletionInfo && (
                          <button onClick={() => handleDeleteClick(foundOrder)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-md text-sm">Delete Bill</button>
                        )}
                    </div>
                    {foundOrder.deletionInfo && (
                        <div className="bg-red-100 border border-red-300 text-red-800 p-2 rounded-md mb-2 text-sm">
                            <p><strong>Deleted on:</strong> {new Date(foundOrder.deletionInfo.date).toLocaleString()}</p>
                            <p><strong>Reason:</strong> {foundOrder.deletionInfo.reason}</p>
                        </div>
                    )}
                    <div className="bg-white rounded p-2 mx-auto w-fit shadow-inner">
                      <PrintReceipt orderItems={foundOrder.items} billNumber={foundOrder.billNumber} paymentMethod={foundOrder.paymentMethod} branchName={foundOrder.branchName} />
                    </div>
                  </div>
                )}
              </div>
              
               <div className="flex justify-between items-center border-b border-brand-brown/10 mb-4">
                  <div className="flex">
                    <TabButton label="Active Orders" isActive={activeTab === 'active'} onClick={() => setActiveTab('active')} />
                    <TabButton label="Deleted Bills" isActive={activeTab === 'deleted'} onClick={() => setActiveTab('deleted')} />
                  </div>
                  <button
                    onClick={handleExportCSV}
                    disabled={orders.length === 0}
                    className="bg-brand-yellow hover:bg-brand-yellow/90 text-brand-brown font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:bg-brand-yellow/50 disabled:cursor-not-allowed"
                  >
                    Export CSV
                  </button>
              </div>

              {activeTab === 'active' ? (
                  <ActiveOrdersList orders={orders} onDeleteClick={handleDeleteClick} />
                ) : (
                  <DeletedOrdersList orders={deletedOrders} />
              )}
            </div>
          )}
          
          {reportView === 'itemSales' && (
            <ItemSalesReport orders={orders} />
          )}

        </div>
      </div>
      <DeleteBillModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete} billNumber={orderToDelete?.billNumber || null} />
    </>
  );
};

const TabButton = ({label, isActive, onClick}: {label: string, isActive: boolean, onClick: () => void}) => (
    <button onClick={onClick} className={`py-2 px-4 font-semibold text-sm transition-colors ${isActive ? 'border-b-2 border-brand-red text-brand-brown' : 'text-brand-brown/60 hover:text-brand-brown'}`}>
        {label}
    </button>
)

const FinancialSummaryCard = ({ data }: { data: ReturnType<typeof useMemo> extends { financialData: infer T } ? T : any }) => (
  <div className="bg-white p-6 rounded-lg shadow-md border border-brand-brown/10">
    <h3 className="text-lg font-semibold mb-4 text-brand-brown">Financial Summary</h3>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
      <Metric title="Total Revenue" value={`₹${data.totalRevenue.toFixed(2)}`} />
      <Metric title="Total COGS" value={`₹${data.totalCogs.toFixed(2)}`} />
      <Metric title="Gross Profit" value={`₹${data.grossProfit.toFixed(2)}`} isProfit />
      <Metric title="Profit Margin" value={`${data.profitMargin.toFixed(1)}%`} isProfit />
      <Metric title="Total Orders" value={data.totalOrders.toString()} />
    </div>
  </div>
);

const Metric = ({ title, value, isProfit = false }: { title: string, value: string, isProfit?: boolean }) => (
  <div>
    <h4 className="text-sm font-medium text-brand-brown/70 whitespace-nowrap">{title}</h4>
    <p className={`text-3xl font-extrabold ${isProfit ? 'text-green-600' : 'text-brand-brown'}`}>{value}</p>
  </div>
);

const ActiveOrdersList = ({ orders, onDeleteClick }: { orders: CompletedOrder[], onDeleteClick: (order: CompletedOrder) => void}) => (
  <div className="bg-white rounded-lg shadow-md p-4 border border-brand-brown/10">
    <h3 className="text-lg font-semibold mb-4 border-b border-brand-brown/10 pb-2">Orders for Selected Period</h3>
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-brand-brown/5 text-xs text-brand-brown/60 uppercase">
          <tr>
            <th scope="col" className="px-4 py-3">Bill #</th>
            <th scope="col" className="px-4 py-3">Date & Time</th>
            <th scope="col" className="px-4 py-3 text-right">Total</th>
            <th scope="col" className="px-4 py-3 text-center">Items</th>
            <th scope="col" className="px-4 py-3">Payment</th>
            <th scope="col" className="px-4 py-3">Branch</th>
            <th scope="col" className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id} className="border-b border-brand-brown/10 hover:bg-brand-brown/5">
              <td className="px-4 py-3 font-medium text-brand-brown">#{order.billNumber}</td>
              <td className="px-4 py-3">{new Date(order.date).toLocaleString()}</td>
              <td className="px-4 py-3 text-right font-semibold">₹{order.total.toFixed(2)}</td>
              <td className="px-4 py-3 text-center">{order.items.reduce((acc, item) => acc + item.quantity, 0)}</td>
              <td className="px-4 py-3">{order.paymentMethod}</td>
              <td className="px-4 py-3">{order.branchName}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onDeleteClick(order)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p className="text-center py-8 text-brand-brown/60">No active orders found for this date range.</p>}
    </div>
  </div>
);

const DeletedOrdersList = ({ orders }: { orders: CompletedOrder[] }) => (
  <div className="bg-white rounded-lg shadow-md p-4 border border-brand-brown/10">
    <h3 className="text-lg font-semibold mb-4 border-b border-brand-brown/10 pb-2">Deleted Bills for Selected Period</h3>
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-brand-brown/5 text-xs text-brand-brown/60 uppercase">
          <tr>
            <th scope="col" className="px-4 py-3">Bill #</th>
            <th scope="col" className="px-4 py-3">Original Date</th>
            <th scope="col" className="px-4 py-3 text-right">Total</th>
            <th scope="col" className="px-4 py-3">Deleted At</th>
            <th scope="col" className="px-4 py-3">Reason</th>
            <th scope="col" className="px-4 py-3">Branch</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id} className="border-b border-brand-brown/10 hover:bg-brand-brown/5 opacity-70">
              <td className="px-4 py-3 font-medium text-brand-brown">#{order.billNumber}</td>
              <td className="px-4 py-3">{new Date(order.date).toLocaleString()}</td>
              <td className="px-4 py-3 text-right font-semibold">₹{order.total.toFixed(2)}</td>
              <td className="px-4 py-3">{order.deletionInfo ? new Date(order.deletionInfo.date).toLocaleString() : 'N/A'}</td>
              <td className="px-4 py-3 max-w-xs truncate" title={order.deletionInfo?.reason}>{order.deletionInfo?.reason}</td>
              <td className="px-4 py-3">{order.branchName}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p className="text-center py-8 text-brand-brown/60">No deleted bills found for this date range.</p>}
    </div>
  </div>
);

const PaymentMetric = ({ title, value }: { title: string; value: string }) => (
  <div className="bg-brand-brown/5 p-3 rounded-md">
    <h4 className="text-xs font-medium text-brand-brown/70">{title}</h4>
    <p className="text-xl font-semibold text-brand-brown">{value}</p>
  </div>
);

export default Analytics;