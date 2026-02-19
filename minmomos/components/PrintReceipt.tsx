
import React from 'react';
import { OrderItem, PaymentMethod, OrderType } from '../types';

interface PrintReceiptProps {
  orderItems: OrderItem[];
  billNumber?: number | null;
  paymentMethod?: PaymentMethod | null;
  branchName?: string | null;
  date?: string | Date | null;
  orderType?: OrderType;
  tableId?: string;
  customerPhone?: string;
}

const PrintReceipt: React.FC<PrintReceiptProps> = ({ 
  orderItems, 
  billNumber, 
  paymentMethod, 
  branchName, 
  date,
  orderType,
  tableId,
  customerPhone
}) => {
  const total = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const transactionDate = date ? new Date(date) : new Date();
  
  const tableNum = tableId?.split('-')[1];

  const styles: { [key: string]: React.CSSProperties } = {
    container: {
      fontFamily: "'Courier New', Courier, monospace",
      color: '#000',
      backgroundColor: '#fff',
      padding: '4mm',
      fontSize: '10pt',
      lineHeight: '1.2'
    },
    center: { textAlign: 'center' },
    brand: { fontWeight: 'bold', fontSize: '18pt', letterSpacing: '-1px' },
    tagline: { fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '-4px' },
    divider: { borderTop: '1px dashed #000', margin: '8px 0' },
    table: { width: '100%', fontSize: '9pt', borderCollapse: 'collapse' },
    th: { textAlign: 'left', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid #000' },
    total: { display: 'flex', justifySelf: 'flex-end', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14pt', marginTop: '10px' },
    footer: { marginTop: '15px', fontSize: '8pt', textAlign: 'center' },
    metaRow: { display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }
  };

  return (
    <div style={styles.container} id="printable-receipt">
      <div style={styles.center}>
        <div style={styles.brand}>minmomos</div>
        <div style={styles.tagline}>the ultimate momo station</div>
        {branchName && <p style={{fontWeight: 'bold', margin: '5px 0 0 0', fontSize: '9pt'}}>{branchName}</p>}
      </div>
      
      <div style={styles.divider}></div>
      
      <div style={{fontSize: '9pt', fontWeight: 'bold', textAlign: 'center', marginBottom: '4px'}}>
        *** {orderType?.replace('_', ' ') || 'ORDER'} ***
      </div>

      <div style={styles.metaRow}>
        <span>BILL: #{billNumber || '----'}</span>
        <span>{transactionDate.toLocaleDateString()}</span>
      </div>
      <div style={styles.metaRow}>
        <span>TIME: {transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        {tableNum && <span>TABLE: {tableNum}</span>}
      </div>
      {customerPhone && <div style={styles.metaRow}><span>CUST: {customerPhone}</span></div>}
      {paymentMethod && <div style={styles.metaRow}><span>PAYMENT: {paymentMethod}</span></div>}
      
      <div style={styles.divider}></div>
      
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{...styles.th, width: '60%'}}>ITEM</th>
            <th style={{...styles.th, textAlign: 'center'}}>QTY</th>
            <th style={{...styles.th, textAlign: 'right'}}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {orderItems.map((item) => (
            <tr key={item.id}>
              <td style={{padding: '4px 0', verticalAlign: 'top'}}>{item.name}</td>
              <td style={{padding: '4px 0', textAlign: 'center', verticalAlign: 'top'}}>{item.quantity}</td>
              <td style={{padding: '4px 0', textAlign: 'right', verticalAlign: 'top'}}>{(item.price * item.quantity).toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div style={styles.divider}></div>
      
      <div style={styles.total}>
        <span>TOTAL</span>
        <span>₹{total.toFixed(0)}</span>
      </div>
      
      <div style={styles.divider}></div>
      
      <div style={styles.footer}>
        <p>Fresh from the Himalayan Peaks</p>
        <p style={{fontWeight: 'bold', marginTop: '10px'}}>THANK YOU! VISIT AGAIN!</p>
      </div>
    </div>
  );
};

export default PrintReceipt;
