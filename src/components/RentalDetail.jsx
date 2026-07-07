import { Fragment, useState } from 'react';
import { daysBetween, calculateRentalPrice, calculateOwnedRevenue, formatCurrency, groupItemsByCategory } from '@/lib/calc';
import RentalHistoryTab from './RentalHistoryTab';

const STATUS_STYLES = {
  active: 'bg-primary/15 text-primary dark:text-yellow-300',
  completed: 'bg-green-500/15 text-green-600 dark:text-green-400',
  reserved: 'bg-accent/20 text-yellow-700 dark:text-yellow-300',
  cancelled: 'bg-destructive/15 text-destructive dark:text-red-400',
};

export default function RentalDetail({ rental, client, equipment, categories = [] }) {
  const days = daysBetween(rental.start_date, rental.end_date);
  const { basePrice, discountAmount, finalPrice } = calculateRentalPrice(
    rental.items, days, rental.discount
  );
  const grouped = groupItemsByCategory(rental.items, equipment, categories);
  const hasSubrental = (rental.items || []).some((i) => equipment.find((e) => e.id === i.equipment_id)?.is_subrental);
  const { ownedRevenue, subrentalRevenue } = calculateOwnedRevenue(rental.items, days, rental.discount, equipment);
  const [tab, setTab] = useState('details');

  return (
    <div className="space-y-5">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setTab('details')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'details' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          History
        </button>
      </div>

      {tab === 'history' ? (
        <RentalHistoryTab rentalId={rental.id} />
      ) : (
      <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Client</div>
          <div className="text-sm font-medium text-foreground">{client?.name || 'Unknown'}</div>
          {client?.contact && (
            <div className="text-xs text-muted-foreground mt-0.5">{client.contact}</div>
          )}
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status</div>
          <span className={`badge ${STATUS_STYLES[rental.status] || 'bg-muted text-muted-foreground'}`}>
            {rental.status}
          </span>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Start</div>
          <div className="text-sm text-foreground">{new Date(rental.start_date).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">End</div>
          <div className="text-sm text-foreground">{new Date(rental.end_date).toLocaleString()}</div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Equipment</div>
        {(!rental.items || rental.items.length === 0) ? (
          <div className="text-sm text-muted-foreground py-3 text-center bg-secondary/30 rounded-lg">
            No equipment in this rental
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Price/Day</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <Fragment key={group.category}>
                    <tr>
                      <td colSpan={4} className="bg-secondary/60 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        {group.category}
                      </td>
                    </tr>
                    {group.items.map((item, i) => {
                      const eq = equipment.find((e) => e.id === item.equipment_id);
                      return (
                        <tr key={i}>
                          <td className="font-medium">{eq?.name || 'Unknown'}</td>
                          <td className="text-right">{item.quantity}</td>
                          <td className="text-right">{formatCurrency(item.price_per_day)}</td>
                          <td className="text-right font-medium">
                            {formatCurrency((item.price_per_day || 0) * (item.quantity || 0) * days)}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-secondary/40 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-medium">{days} day{days !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Base Price</span>
          <span className="font-medium">{formatCurrency(basePrice)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Discount ({rental.discount || 0}%)</span>
          <span className="font-medium text-destructive">−{formatCurrency(discountAmount)}</span>
        </div>
        <div className="h-px bg-border my-1" />
        <div className="flex justify-between">
          <span className="font-bold">Final Price</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(finalPrice)}</span>
        </div>
        {hasSubrental && (
          <>
            <div className="h-px bg-border my-1" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Owned Equipment Revenue</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(ownedRevenue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sub-Rental Revenue</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(subrentalRevenue)}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className={`badge ${rental.is_paid ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
          {rental.is_paid ? 'Paid' : 'Unpaid'}
        </span>
      </div>

      {rental.notes && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</div>
          <div className="text-sm text-foreground whitespace-pre-wrap bg-secondary/30 rounded-lg p-3">
            {rental.notes}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}