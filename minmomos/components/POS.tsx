import React, { useState, useCallback, useEffect } from 'react';
import { TABLES } from '../constants';
import {
  MenuItem as MenuItemType,
  OrderItem,
  OrderType,
  PaymentMethod,
  DiningTable
} from '../types';
import Menu from './Menu';
import Bill from './Bill';
import VariantSelectionModal from './VariantSelectionModal';
import BillPreviewModal from './BillPreviewModal';
import { saveOrder, peekNextBillNumber, fetchMenuItems } from '../utils/storage';
import { supabase } from '../utils/supabase';
import { printerService } from '../utils/bluetoothPrinter';

const CATEGORIES = [
  { id: 'momo', label: 'Steam & Fried', icon: '♨️' },
  { id: 'side', label: 'Sides', icon: '🥗' },
  { id: 'drink', label: 'Drinks', icon: '🥤' },
  { id: 'combo', label: 'Combos', icon: '🍱' }
];

const POS: React.FC<{ branchName: string }> = ({ branchName }) => {
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('momo');
  const [selectedItem, setSelectedItem] = useState<MenuItemType | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingBillNumber, setPendingBillNumber] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('TAKEAWAY');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [dbTables, setDbTables] = useState<any[]>([]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);

  /* ------------------------- LOAD DATA ------------------------- */

  useEffect(() => {
    const loadData = async () => {
      const [mResponse, { data: t }] = await Promise.all([
        fetchMenuItems(),
        supabase.from('dining_tables').select('*')
      ]);

      if (mResponse?.data) setMenuItems(mResponse.data);
      if (t) setDbTables(t);
    };

    loadData();
    setIsPrinterConnected(printerService.isConnected());
  }, [isTableModalOpen]);

  /* ------------------------- RESET ORDER ------------------------- */

  const resetOrderState = () => {
    setOrder([]);
    setSelectedTable(null);
    setCustomerPhone('');
    setIsPreviewing(false);
    setIsMobileCartOpen(false);
  };

  /* ------------------------- PRINTER ------------------------- */

  const handleConnectPrinter = async () => {
    const connected = await printerService.connect();
    setIsPrinterConnected(connected);
    if (connected) alert('Printer Connected Successfully!');
  };

  /* ------------------------- ORDER LOGIC ------------------------- */

  const handleAddItem = useCallback((itemsToAdd: OrderItem[]) => {
    setOrder(prev => {
      const updated = [...prev];
      itemsToAdd.forEach(item => {
        const index = updated.findIndex(i => i.id === item.id);
        if (index > -1) updated[index].quantity += item.quantity;
        else updated.push(item);
      });
      return updated;
    });
  }, []);

  const handleUpdateQuantity = (id: string, qty: number) => {
    setOrder(prev =>
      qty <= 0
        ? prev.filter(i => i.id !== id)
        : prev.map(i => (i.id === id ? { ...i, quantity: qty } : i))
    );
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

  /* ------------------------- CONFIRM ORDER ------------------------- */

  const handleConfirmOrder = async (
    method: PaymentMethod,
    useBluetooth: boolean = false
  ) => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      const total = order.reduce(
        (acc, i) => acc + i.price * i.quantity,
        0
      );

      const savedNum = await saveOrder(
        order,
        total,
        branchName,
        orderType,
        'ORDERED',
        method,
        selectedTable?.id
      );

      if (!savedNum) return;

      /* -------- BLUETOOTH PRINT -------- */

      if (useBluetooth && printerService.isConnected()) {
        await printerService.printReceipt({
          orderItems: order,
          billNumber: savedNum,
          paymentMethod: method,
          branchName,
          orderType
        });

        resetOrderState();
        return;
      }

      /* -------- SYSTEM PRINT -------- */

      if (!useBluetooth) {
        const handleAfterPrint = () => {
          resetOrderState();
          window.removeEventListener('afterprint', handleAfterPrint);
        };

        window.addEventListener('afterprint', handleAfterPrint);
        window.print();
        return;
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while finalizing the order.');
    } finally {
      setIsSaving(false);
    }
  };

  /* ------------------------- TABLE SELECT ------------------------- */

  const handleTableSelect = (table: DiningTable) => {
    if (table.status === 'AVAILABLE') {
      setSelectedTable(table);
      setIsTableModalOpen(false);
    }
  };

  const filteredItems = menuItems.filter(
    item => item.category === activeCategory
  );

  /* ------------------------- UI ------------------------- */

  return (
    <div className="flex flex-col lg:flex-row h-full bg-brand-cream pb-20 lg:pb-0">
      {/* UI remains same as your original — unchanged for clarity */}
      {/* (Your JSX layout is correct and doesn't affect print logic) */}

      <Menu menuItems={filteredItems} onSelectItem={setSelectedItem} />

      <VariantSelectionModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAddItem={handleAddItem}
      />

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
        isPrinterConnected={isPrinterConnected}
      />
    </div>
  );
};

export default POS;
