
import { OrderItem, PaymentMethod, OrderType } from '../types';

// Standard ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

export class BluetoothPrinter {
  private device: any = null;
  private characteristic: any = null;

  /**
   * Safely checks if the Web Bluetooth API is supported in the current context.
   */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
  }

  async connect(): Promise<boolean> {
    const bluetooth = (navigator as any).bluetooth;
    
    // Safety check for Web Bluetooth API availability
    if (!bluetooth) {
      console.error('Web Bluetooth API is not available in this browser or context.');
      alert('Bluetooth Printing requires a secure (HTTPS) connection and a supported browser (Chrome, Edge, or Android). If you are in a preview/development environment, this API may be disabled.');
      return false;
    }

    try {
      // Use acceptAllDevices to be more compatible with various printer brands that use different primary service UUIDs.
      // We list common printing services in optionalServices so we can access them after connecting.
      this.device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Generic Printer Service
          '0000ff00-0000-1000-8000-00805f9b34fb', // Common Chinese Printer Service
          '4953434d-5432-4c45-4b45-595359534254'  // Some older Bluetooth printers
        ]
      });

      if (!this.device) return false;

      const server = await this.device.gatt?.connect();
      if (!server) return false;

      const services = await server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          // Look for a characteristic that supports writing data
          if (char.properties.write || char.properties.writeWithoutResponse) {
            this.characteristic = char;
            console.log('Printer connected and ready for data.');
            return true;
          }
        }
      }
      
      alert("Connected to device, but no compatible printing characteristic was found.");
      return false;
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        console.log('User cancelled the device selection dialog.');
      } else {
        console.error('Bluetooth connection failed:', error);
        alert(`Bluetooth Error: ${error.message}`);
      }
      return false;
    }
  }

  isConnected(): boolean {
    return !!this.characteristic && !!this.device?.gatt?.connected;
  }

  private encode(text: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(text);
  }

  private async write(data: Uint8Array) {
    if (!this.characteristic) return;
    
    // Thermal printers have small buffers. We send data in chunks to prevent buffer overflow.
    const CHUNK_SIZE = 20;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      await this.characteristic.writeValue(chunk);
    }
  }

  async printReceipt(params: {
    orderItems: OrderItem[];
    billNumber: number;
    paymentMethod: PaymentMethod;
    branchName: string;
    orderType: OrderType;
  }) {
    if (!this.characteristic) throw new Error('Printer not connected');

    const { orderItems, billNumber, paymentMethod, branchName, orderType } = params;
    const total = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const date = new Date().toLocaleString();

    let commands: number[] = [
      ESC, 0x40, // Initialize printer
      ESC, 0x61, 0x01, // Center align
      ESC, 0x45, 0x01, // Bold on
    ];

    // Header Content
    const header = [
      ...Array.from(this.encode('minmomos\n')),
      ESC, 0x45, 0x00, // Bold off
      ...Array.from(this.encode('the ultimate momo station\n')),
      ...Array.from(this.encode(`${branchName}\n`)),
      ...Array.from(this.encode('--------------------------------\n')),
      ...Array.from(this.encode(`*** ${orderType} ***\n\n`)),
    ];
    commands.push(...header);

    // Meta Info
    commands.push(ESC, 0x61, 0x00); // Left align
    commands.push(...Array.from(this.encode(`BILL: #${billNumber}\n`)));
    commands.push(...Array.from(this.encode(`DATE: ${date}\n`)));
    commands.push(...Array.from(this.encode(`PAY : ${paymentMethod}\n`)));
    commands.push(...Array.from(this.encode('--------------------------------\n')));

    // Items Header (58mm/32chars wide)
    commands.push(ESC, 0x45, 0x01); // Bold on
    commands.push(...Array.from(this.encode('ITEM              QTY    TOTAL  \n')));
    commands.push(ESC, 0x45, 0x00); // Bold off

    orderItems.forEach(item => {
      // Formatting: Name(18) Qty(5) Total(7)
      const name = item.name.substring(0, 17).padEnd(18, ' ');
      const qty = item.quantity.toString().padStart(3, ' ').padEnd(5, ' ');
      const price = (item.price * item.quantity).toFixed(0).padStart(7, ' ');
      commands.push(...Array.from(this.encode(`${name}${qty}${price}\n`)));
    });

    commands.push(...Array.from(this.encode('--------------------------------\n')));

    // Total Section
    commands.push(ESC, 0x61, 0x02); // Right align
    commands.push(ESC, 0x45, 0x01); // Bold on
    commands.push(...Array.from(this.encode(`TOTAL: RS ${total.toFixed(0)}\n`)));
    commands.push(ESC, 0x45, 0x00); // Bold off

    // Footer Content
    commands.push(ESC, 0x61, 0x01); // Center align
    commands.push(LF, LF);
    commands.push(...Array.from(this.encode('Fresh from the Peak!\n')));
    commands.push(...Array.from(this.encode('THANK YOU! VISIT AGAIN!\n')));
    commands.push(LF, LF, LF, LF, LF); // Feed paper for cutting

    await this.write(new Uint8Array(commands));
  }
}

export const printerService = new BluetoothPrinter();
