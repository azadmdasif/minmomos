
import React from 'react';
import { OrderItem, PaymentMethod, OrderType } from '../types';
import PrintReceipt from './PrintReceipt';
import { TANDOORI_MAYO_ORDER_ITEM } from '../constants';

interface BillPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod) => void;
  orderItems: OrderItem[];
  billNumber: number | null;
  branchName: string | null;
  onAddItem: (items: OrderItem[]) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  isSaving?: boolean;
  orderType?: OrderType;
  tableId?: string;
  customerPhone?: string;
}

const BillPreviewModal: React.FC<BillPreviewModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  orderItems, 
  billNumber, 
  branchName, 
  onAddItem, 
  onUpdateQuantity,
  isSaving = false,
  orderType,
  tableId,
  customerPhone
}) => {
  if (!isOpen) {
    return null;
  }
  
  const hasMayo = orderItems.some(item => item.menuItemId === TANDOORI_MAYO_ORDER_ITEM.menuItemId && !item.parentItemId);

  const handleToggleMayo = () => {
    if (isSaving) return;
    if (hasMayo) {
      const mayoItem = orderItems.find(item => item.menuItemId === TANDOORI_MAYO_ORDER_ITEM.menuItemId && !item.parentItemId);
      if(mayoItem) {
        onUpdateQuantity(mayoItem.id, 0);
      }
    } else {
      onAddItem([{...TANDOORI_MAYO_ORDER_ITEM, quantity: 1}]);
    }
  };

  const paymentMethods: PaymentMethod[] = ['Cash', 'UPI', 'Card'];

  return (
    <div 
      className="fixed inset-0 bg-brand-brown/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-brand-cream rounded-3xl shadow-2xl w-full max-w-sm text-brand-brown overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 text-center italic">Receipt <span className="text-brand-red">Preview</span></h2>
          <div className="bg-white rounded-xl p-2 max-h-80 overflow-y-auto shadow-inner border border-brand-stone">
            <PrintReceipt 
              orderItems={orderItems} 
              billNumber={billNumber} 
              branchName={branchName} 
              orderType={orderType}
              tableId={tableId}
              customerPhone={customerPhone}
            />
          </div>
          <div className="pt-4">
            <h3 className="text-[10px] font-black text-center text-stone-400 uppercase tracking-widest mb-2">Suggested Side</h3>
            <label 
              htmlFor={`mayo-addon-preview`}
              onClick={(e) => { e.preventDefault(); handleToggleMayo(); }}
              className={`w-full flex items-center gap-2 cursor-pointer text-left p-3 rounded-xl bg-brand-brown/5 hover:bg-brand-brown/10 transition-colors ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div 
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150 border ${hasMayo ? 'bg-brand-yellow border-brand-brown' : 'bg-white border-stone-200'}`}
                  aria-hidden="true"
              >
                  {hasMayo && (
                    <svg className="w-3 h-3 text-brand-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
              </div>
              <span className="font-bold text-brand-brown text-xs">
                Tandoori Mayo (+₹10)
              </span>
              <input type="checkbox" id={`mayo-addon-preview`} checked={hasMayo} readOnly className="sr-only" />
            </label>
          </div>
        </div>
        <div className="bg-brand-brown p-6 space-y-3">
            <p className="text-center font-black uppercase text-[10px] tracking-widest text-white/40 mb-2">
              {isSaving ? 'Syncing...' : 'Select Payment Mode'}
            </p>
            <div className="grid grid-cols-1 gap-3">
                 {paymentMethods.map(method => (
                     <button 
                        key={method}
                        onClick={() => onConfirm(method)} 
                        disabled={isSaving}
                        className="bg-brand-yellow hover:bg-brand-yellow/90 text-brand-brown font-black py-4 px-4 rounded-xl transition-all shadow-lg text-xs uppercase tracking-widest disabled:opacity-50"
                    >
                        {method} Payment
                    </button>
                 ))}
            </div>
            <button 
              onClick={onClose} 
              disabled={isSaving}
              className="w-full text-white/50 hover:text-white font-bold py-2 text-xs uppercase tracking-widest transition-colors mt-2"
            >
                Edit Cart
            </button>
        </div>
      </div>
    </div>
  );
};

export default BillPreviewModal;
