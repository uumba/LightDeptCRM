// ─── Date Helpers ──────────────────────────────────────────────
export function cleanEquipmentName(name) {
  return (name || '').replace(/\s*\(sub\)\s*/gi, ' ').trim() || (name || '');
}

export function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 1;
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function getLast30Days() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start, end };
}

export function isInRange(dateStr, start, end) {
  const date = new Date(dateStr);
  return date >= start && date <= end;
}

export function daysInPeriod(start, end) {
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
}

// ─── Availability ──────────────────────────────────────────────
export function datesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function getReservedQuantity(equipmentId, startDate, endDate, rentals, excludeRentalId) {
  if (!startDate || !endDate) return 0;
  return (rentals || [])
    .filter((r) => r.id !== excludeRentalId && (r.status === 'active' || r.status === 'reserved'))
    .filter((r) => datesOverlap(startDate, endDate, r.start_date, r.end_date))
    .reduce((sum, r) => {
      const item = (r.items || []).find((i) => i.equipment_id === equipmentId);
      return sum + (Number(item?.quantity) || 0);
    }, 0);
}

export function getAvailableQuantity(equipment, startDate, endDate, rentals, excludeRentalId) {
  const total = Number(equipment.quantity) || 1;
  const reserved = getReservedQuantity(equipment.id, startDate, endDate, rentals, excludeRentalId);
  return Math.max(0, total - reserved);
}

// ─── Price Calculation ─────────────────────────────────────────
export function calculateRentalPrice(items, days, discount) {
  const basePrice = (items || []).reduce((sum, item) => {
    return sum + (Number(item.price_per_day) || 0) * (Number(item.quantity) || 0) * days;
  }, 0);
  const discountAmount = basePrice * ((Number(discount) || 0) / 100);
  const finalPrice = basePrice - discountAmount;
  return { basePrice, discountAmount, finalPrice };
}

// ─── Rental Change Log ─────────────────────────────────────────
// Compares old and new rental data, returns human-readable change descriptions
export function buildRentalChangeLog(oldRental, newRental, equipment) {
  const changes = [];
  const eqName = (id) => equipment.find((e) => e.id === id)?.name || 'Unknown';

  // Date changes
  const oldStart = oldRental?.start_date ? new Date(oldRental.start_date).toISOString() : null;
  const newStart = newRental?.start_date ? new Date(newRental.start_date).toISOString() : null;
  if (oldStart !== newStart) {
    changes.push(`Start date: ${oldStart ? new Date(oldStart).toLocaleString() : '—'} → ${newStart ? new Date(newStart).toLocaleString() : '—'}`);
  }

  const oldEnd = oldRental?.end_date ? new Date(oldRental.end_date).toISOString() : null;
  const newEnd = newRental?.end_date ? new Date(newRental.end_date).toISOString() : null;
  if (oldEnd !== newEnd) {
    changes.push(`End date: ${oldEnd ? new Date(oldEnd).toLocaleString() : '—'} → ${newEnd ? new Date(newEnd).toLocaleString() : '—'}`);
  }

  // Items changes
  const oldItems = {};
  (oldRental?.items || []).forEach((i) => { oldItems[i.equipment_id] = Number(i.quantity) || 0; });
  const newItems = {};
  (newRental?.items || []).forEach((i) => { newItems[i.equipment_id] = Number(i.quantity) || 0; });

  const allIds = new Set([...Object.keys(oldItems), ...Object.keys(newItems)]);
  allIds.forEach((id) => {
    const oldQty = oldItems[id] || 0;
    const newQty = newItems[id] || 0;
    if (oldQty === 0 && newQty > 0) {
      changes.push(`Added: ${eqName(id)} (×${newQty})`);
    } else if (oldQty > 0 && newQty === 0) {
      changes.push(`Removed: ${eqName(id)} (×${oldQty})`);
    } else if (oldQty !== newQty) {
      changes.push(`${eqName(id)} quantity: ${oldQty} → ${newQty}`);
    }
  });

  return changes;
}

// ─── Formatting ────────────────────────────────────────────────
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatNumber(amount) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(amount || 0);
}

// ─── Client Tier ───────────────────────────────────────────────
export function getTier(revenue) {
  if (revenue >= 20000) return 'Platinum';
  if (revenue >= 5000) return 'Gold';
  if (revenue >= 1000) return 'Silver';
  return 'Bronze';
}

export function tierColor(tier) {
  switch (tier) {
    case 'Platinum': return 'bg-slate-400/20 text-slate-600 dark:text-slate-300';
    case 'Gold': return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
    case 'Silver': return 'bg-gray-400/20 text-gray-500 dark:text-gray-300';
    case 'Bronze': return 'bg-orange-500/20 text-orange-600 dark:text-orange-400';
    default: return 'bg-muted text-muted-foreground';
  }
}

// ─── Owned Equipment Revenue ───────────────────────────────────
// Revenue earned from owned (non-sub-rental) items only, for a single rental
export function calculateOwnedRevenue(items, days, discount, equipment) {
  const subrentalIds = new Set(
    (equipment || []).filter((e) => e.is_subrental).map((e) => e.id)
  );
  const ownedItems = (items || []).filter((i) => !subrentalIds.has(i.equipment_id));
  const ownedBase = ownedItems.reduce((sum, item) => {
    return sum + (Number(item.price_per_day) || 0) * (Number(item.quantity) || 0) * days;
  }, 0);
  const discountMultiplier = 1 - (Number(discount) || 0) / 100;
  return {
    ownedBase,
    ownedRevenue: ownedBase * discountMultiplier,
    subrentalRevenue: calculateRentalPrice(items, days, discount).finalPrice - ownedBase * discountMultiplier,
  };
}

// ─── Client Stats ──────────────────────────────────────────────
export function getClientStats(clientId, rentals) {
  const clientRentals = (rentals || []).filter(
    (r) => r.client_id === clientId && r.status !== 'cancelled'
  );
  const totalRentals = clientRentals.length;
  const totalRevenue = clientRentals.reduce((sum, r) => {
    const days = daysBetween(r.start_date, r.end_date);
    const { finalPrice } = calculateRentalPrice(r.items, days, r.discount);
    return sum + finalPrice;
  }, 0);
  const avgOrderValue = totalRentals > 0 ? totalRevenue / totalRentals : 0;
  return {
    totalRentals,
    totalRevenue,
    avgOrderValue,
    tier: getTier(totalRevenue),
  };
}

// ─── Equipment Analytics ───────────────────────────────────────
export function getEquipmentAnalytics(equipment, rentals, periodStart, periodEnd) {
  const periodDays = daysInPeriod(periodStart, periodEnd);
  let totalRentalDays = 0;
  let calendarDays = 0;
  let totalRevenue = 0;
  let discountSum = 0;
  let rentalCount = 0;

  rentals.forEach((rental) => {
    if (rental.status === 'cancelled') return;
    if (!rental.is_paid) return;
    if (!isInRange(rental.start_date, periodStart, periodEnd)) return;

    const item = (rental.items || []).find((i) => i.equipment_id === equipment.id);
    if (!item) return;

    const days = daysBetween(rental.start_date, rental.end_date);
    const quantity = Number(item.quantity) || 0;
    const pricePerDay = Number(item.price_per_day) || 0;
    const baseRevenue = pricePerDay * quantity * days;
    const discount = Number(rental.discount) || 0;
    const revenue = baseRevenue * (1 - discount / 100);

    calendarDays += days;
    totalRentalDays += days * quantity;
    totalRevenue += revenue;
    discountSum += discount;
    rentalCount++;
  });

  const qty = Number(equipment.quantity) || 1;
  const availableDays = periodDays * qty;
  const utilisation = availableDays > 0 ? (totalRentalDays / availableDays) * 100 : 0;
  const purchasePricePerUnit = Number(equipment.purchase_price) || 0;
  const totalInvestment = purchasePricePerUnit * qty;
  const roi = totalInvestment > 0 ? (totalRevenue / totalInvestment) * 100 : 0;
  const unitsPaidOff = purchasePricePerUnit > 0 ? Math.floor(totalRevenue / purchasePricePerUnit) : qty;
  const paidOff = unitsPaidOff >= qty;
  const revenuePerDay = totalRentalDays > 0 ? totalRevenue / totalRentalDays : 0;
  const avgDiscount = rentalCount > 0 ? discountSum / rentalCount : 0;

  const status = qty > 1
    ? (paidOff ? 'Paid off' : `${unitsPaidOff} / ${qty} paid off`)
    : (paidOff ? 'Paid off' : 'Not paid off');

  return {
    name: equipment.name,
    rentalDays: totalRentalDays,
    calendarDays,
    revenue: totalRevenue,
    revenuePerDay,
    utilisation,
    roi,
    paidOff,
    avgDiscount,
    status,
  };
}

// ─── Dashboard Stats ───────────────────────────────────────────
export function getDashboardStats(rentals, equipment, clients, periodStart, periodEnd) {
  // Build a set of sub-rental equipment IDs to exclude from general revenue
  const subrentalIds = new Set(
    (equipment || []).filter((e) => e.is_subrental).map((e) => e.id)
  );

  const periodRentals = (rentals || []).filter(
    (r) => isInRange(r.start_date, periodStart, periodEnd) && r.status !== 'cancelled' && r.is_paid
  );

  let totalRevenue = 0;
  let totalRentalDays = 0;
  let totalCalendarDays = 0;
  const equipmentRevenue = {};
  const equipmentDays = {};
  const clientRevenue = {};

  periodRentals.forEach((rental) => {
    const days = daysBetween(rental.start_date, rental.end_date);

    // Split items into owned vs sub-rental
    const ownedItems = (rental.items || []).filter((i) => !subrentalIds.has(i.equipment_id));

    // Revenue from owned items only
    const ownedBase = ownedItems.reduce((sum, item) => {
      return sum + (Number(item.price_per_day) || 0) * (Number(item.quantity) || 0) * days;
    }, 0);
    const discountMultiplier = 1 - (Number(rental.discount) || 0) / 100;
    const ownedRevenue = ownedBase * discountMultiplier;

    totalRevenue += ownedRevenue;
    totalRentalDays += days;
    totalCalendarDays += days;

    // Track per-equipment revenue/days for owned items only
    ownedItems.forEach((item) => {
      const eq = equipment.find((e) => e.id === item.equipment_id);
      const name = eq?.name || 'Unknown';
      const itemRevenue =
        (Number(item.price_per_day) || 0) *
        (Number(item.quantity) || 0) *
        days *
        discountMultiplier;
      equipmentRevenue[name] = (equipmentRevenue[name] || 0) + itemRevenue;
      equipmentDays[name] = (equipmentDays[name] || 0) + days;
    });

    // Client revenue = owned items only
    const client = clients.find((c) => c.id === rental.client_id);
    const clientName = client?.name || 'Unknown';
    clientRevenue[clientName] = (clientRevenue[clientName] || 0) + ownedRevenue;
  });

  const topByRevenue = Object.entries(equipmentRevenue)
    .map(([name, val]) => ({ name, value: val }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topByDays = Object.entries(equipmentDays)
    .map(([name, val]) => ({ name, value: val }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const leastUsed = Object.entries(equipmentDays)
    .map(([name, val]) => ({ name, value: val }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 5);

  const topClients = Object.entries(clientRevenue)
    .map(([name, val]) => ({ name, value: val }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const activeRentals = (rentals || []).filter((r) => r.status === 'active').length;

  const today = new Date().toDateString();
  const returningToday = (rentals || []).filter((r) => {
    return r.status === 'active' && new Date(r.end_date).toDateString() === today;
  }).length;

  return {
    totalRevenue,
    totalRentalDays,
    totalCalendarDays,
    topByRevenue,
    topByDays,
    leastUsed,
    topClients,
    activeRentals,
    returningToday,
  };
}

// ─── Sub-Rental Analytics ─────────────────────────────────────
// Tracks demand for sub-rented equipment to help decide what to purchase
export function getSubrentalAnalytics(equipment, rentals, periodStart, periodEnd) {
  const periodDays = daysInPeriod(periodStart, periodEnd);
  if (!equipment.is_subrental) {
    return {
      name: equipment.name,
      rentalDays: 0,
      rentalCount: 0,
      revenue: 0,
      subrentalCost: 0,
      netResult: 0,
      marginPercentage: 0,
      demandScore: 0,
      utilisation: 0,
      availableDays: 0,
    };
  }

  let totalRentalDays = 0;
  let calendarDays = 0;
  let totalRevenue = 0;
  let subrentalCost = 0;
  let rentalCount = 0;

  (rentals || []).forEach((rental) => {
    if (rental.status === 'cancelled') return;
    if (!rental.is_paid) return;
    if (!isInRange(rental.start_date, periodStart, periodEnd)) return;

    const item = (rental.items || []).find((i) => i.equipment_id === equipment.id);
    if (!item) return;

    const days = daysBetween(rental.start_date, rental.end_date);
    const quantity = Number(item.quantity) || 0;
    const pricePerDay = Number(item.price_per_day) || 0;
    const discount = Number(rental.discount) || 0;
    const revenue = pricePerDay * quantity * days * (1 - discount / 100);
    const cost = (Number(equipment.subrental_cost_per_day) || 0) * quantity * days;

    calendarDays += days;
    totalRentalDays += days * quantity;
    totalRevenue += revenue;
    subrentalCost += cost;
    rentalCount++;
  });

  const netResult = totalRevenue - subrentalCost;
  // Demand score: higher = more frequently rented → higher priority to buy
  const demandScore = totalRentalDays;
  // Margin percentage: profitability ratio
  const marginPercentage = totalRevenue > 0 ? (netResult / totalRevenue) * 100 : 0;
  // Utilisation: how many of the available days were actually rented
  const availableDays = periodDays * (Number(equipment.quantity) || 1);
  const utilisation = availableDays > 0 ? (totalRentalDays / availableDays) * 100 : 0;

  return {
    name: equipment.name,
    rentalDays: totalRentalDays,
    calendarDays,
    rentalCount,
    revenue: totalRevenue,
    subrentalCost,
    netResult,
    marginPercentage,
    demandScore,
    utilisation,
    availableDays,
  };
}

// ─── Period Presets ────────────────────────────────────────────
export function getPeriodRange(preset, customStart, customEnd) {
  const end = new Date();
  switch (preset) {
    case 'week': {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { start, end };
    }
    case '60d': {
      const start = new Date();
      start.setDate(start.getDate() - 60);
      return { start, end };
    }
    case 'year': {
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      return { start, end };
    }
    case 'all': {
      return { start: new Date(2000, 0, 1), end };
    }
    case 'custom': {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    default: {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { start, end };
    }
  }
}

// ─── Category Grouping ─────────────────────────────────────────
export function groupItemsByCategory(items, equipment, categories) {
  const orderMap = {};
  (categories || []).forEach((c) => { orderMap[c.name] = c.sort_order ?? 999; });

  const groups = {};
  (items || []).forEach((item) => {
    const eq = equipment.find((e) => e.id === item.equipment_id);
    const cat = eq?.category || 'Uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  return Object.keys(groups)
    .sort((a, b) => (orderMap[a] ?? 999) - (orderMap[b] ?? 999))
    .map((cat) => ({ category: cat, items: groups[cat] }));
}