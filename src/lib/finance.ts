export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type PaymentMethodDef = {
  id: string;
  name: string;
  kind: string;
  fee_pct: number;
  fee_fixed: number;
  installment_fee_pct: number;
  anticipation_pct: number;
  receive_days: number;
};

/** Gross -> fee -> net for a single payment. */
export function calcPayment(amount: number, m: PaymentMethodDef, installments = 1, anticipate = false) {
  const extra = installments > 1 ? Number(m.installment_fee_pct) * (installments - 1) : 0;
  const pct = Number(m.fee_pct) + extra + (anticipate ? Number(m.anticipation_pct) : 0);
  const fee = amount > 0 ? round2((amount * pct) / 100 + Number(m.fee_fixed)) : 0;
  const receiveDays = anticipate ? 1 : Number(m.receive_days) * (m.kind === "credit" && !anticipate ? 1 : 1);
  return { gross: round2(amount), fee, net: round2(amount - fee), receiveDays };
}

export type CommissionRuleSource = "service_professional" | "service" | "product" | "professional_default";
export type CommissionRule = { pct: number; fixed: number; source: CommissionRuleSource };

export function resolveCommissionRule(opts: {
  override?: { commission_pct: number | null; commission_fixed: number | null } | null;
  service?: { commission_pct: number | null; commission_fixed: number | null } | null;
  productPct?: number | null;
  professionalDefaultPct: number;
}): CommissionRule {
  const o = opts.override;
  if (o && (o.commission_pct != null || o.commission_fixed != null))
    return { pct: Number(o.commission_pct ?? 0), fixed: Number(o.commission_fixed ?? 0), source: "service_professional" };
  const s = opts.service;
  if (s && (s.commission_pct != null || s.commission_fixed != null))
    return { pct: Number(s.commission_pct ?? 0), fixed: Number(s.commission_fixed ?? 0), source: "service" };
  if (opts.productPct != null) return { pct: Number(opts.productPct), fixed: 0, source: "product" };
  return { pct: Number(opts.professionalDefaultPct), fixed: 0, source: "professional_default" };
}

/** Commission over the net item value (after discount). Fixed value is per item unit. */
export function calcCommission(base: number, rule: { pct: number; fixed: number }, quantity = 1, share = 1) {
  return round2((base * rule.pct) / 100 * share + rule.fixed * quantity * share);
}

/** Spreads a sale-level discount proportionally across items (cent-exact). */
export function distributeDiscount(totals: number[], discount: number): number[] {
  const sum = totals.reduce((a, b) => a + b, 0);
  if (sum <= 0 || discount <= 0) return totals.map(() => 0);
  let acc = 0;
  return totals.map((t, i) => {
    if (i === totals.length - 1) return round2(discount - acc);
    const d = round2((t / sum) * discount);
    acc = round2(acc + d);
    return d;
  });
}

export type CashMove = { type: string; method_kind: string; amount: number };
export function expectedCash(opening: number, moves: CashMove[]) {
  return round2(
    moves
      .filter((m) => m.method_kind === "cash")
      .reduce((acc, m) => acc + (m.type === "withdrawal" || m.type === "expense" ? -Math.abs(m.amount) : m.amount), opening),
  );
}

export function validatePayments(total: number, payments: { amount: number }[]) {
  const paid = round2(payments.reduce((a, p) => a + p.amount, 0));
  if (payments.some((p) => !(p.amount > 0))) return "Valores de pagamento devem ser maiores que zero";
  if (paid !== round2(total)) return `Pagamentos (${paid.toFixed(2)}) diferem do total (${round2(total).toFixed(2)})`;
  return null;
}
