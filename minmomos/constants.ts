
import { MenuItem, OrderItem, DiningTable } from './types';

export const SIZE_PIECES: Record<string, number> = {
  small: 4,
  medium: 6,
  large: 8,
  normal: 1 // For sides/drinks that don't follow the 4-6-8 rule
};

export const RAW_MATERIALS_LIST = [
  // Bulk Momos (Units in Pieces)
  { id: 'momo-veg', name: 'Veg Momo (Bulk)', unit: 'pcs' },
  { id: 'momo-chicken', name: 'Chicken Momo (Bulk)', unit: 'pcs' },
  { id: 'momo-paneer', name: 'Paneer Momo (Bulk)', unit: 'pcs' },
  { id: 'momo-kurkure', name: 'Kurkure Momo (Bulk)', unit: 'pcs' },
  { id: 'momo-tandoori', name: 'Tandoori Momo (Bulk)', unit: 'pcs' },
  
  // Consumables
  { id: 'pkt-oil', name: 'Refined Cooking Oil', unit: 'ltr' },
  { id: 'pkt-mayo', name: 'Mayonnaise', unit: 'pkt' },
  { id: 'pkt-fries', name: 'French Fries (Bulk)', unit: 'pkt' },
];

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'chicken-momo',
    name: 'Chicken Momo',
    image: 'https://static.toiimg.com/thumb/60275824.cms?imgsize=1041917&width=800&height=800',
    category: 'momo',
    preparations: {
      steamed: { small: 60, medium: 90, large: 120 },
      fried: { small: 70, medium: 100, large: 130 },
    },
    costs: {
      steamed: { small: 25, medium: 35, large: 45 },
      fried: { small: 30, medium: 40, large: 50 },
    },
    recipe: [{ materialId: 'momo-chicken', quantity: 1 }]
  },
  {
    id: 'veg-momo',
    name: 'Veg Momo',
    image: 'https://cdn1.foodviva.com/static-content/food-images/snacks-recipes/veg-momos/veg-momos.jpg',
    category: 'momo',
    preparations: {
      steamed: { small: 40, medium: 60, large: 80 },
      fried: { small: 50, medium: 70, large: 90 },
    },
    costs: {
      steamed: { small: 18, medium: 25, large: 32 },
      fried: { small: 22, medium: 30, large: 38 },
    },
    recipe: [{ materialId: 'momo-veg', quantity: 1 }]
  }
];

export const BRANCHES = ['Main Station'];

export const TABLES: DiningTable[] = Array.from({ length: 8 }, (_, i) => ({
  id: `table-${i + 1}`,
  number: (i + 1).toString(),
  capacity: 4,
  status: 'AVAILABLE'
}));

export const FRIES_ADD_ON_ITEM: OrderItem = {
  id: 'fries-side',
  menuItemId: 'fries',
  name: 'Extra Fries',
  price: 30,
  cost: 10,
  quantity: 1,
};

export const TANDOORI_MAYO_ORDER_ITEM: OrderItem = {
  id: 'mayo-dip-addon',
  menuItemId: 'mayo-dip',
  name: 'Extra Mayo Dip',
  price: 10,
  cost: 2,
  quantity: 1,
};
