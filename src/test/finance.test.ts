import { describe, expect, it } from "vitest";
import { calcCommission, calcPayment, distributeDiscount, expectedCash, resolveCommissionRule, validatePayments } from "@/lib/finance";

const credit = { id: "c", name: "Crédito", kind: "credit", fee_pct: 3.49, fee_fixed: 0, installment_fee_pct: 1.5, anticipation_pct: 2, receive_days: 30 };

describe("comissões", () => {
  it("serviço de R$ 50,00 com 40% gera R$ 20,00", () => {
    expect(calcCommission(50, { pct: 40, fixed: 0 })).toBe(20);
  });
  it("valor fixo por atendimento", () => {
    expect(calcCommission(80, { pct: 0, fixed: 15 })).toBe(15);
  });
  it("divisão 50/50 entre dois profissionais", () => {
    expect(calcCommission(100, { pct: 40, fixed: 0 }, 1, 0.5)).toBe(20);
  });
  it("regra do profissional por serviço tem prioridade", () => {
    const r = resolveCommissionRule({ override: { commission_pct: 50, commission_fixed: null }, service: { commission_pct: 40, commission_fixed: null }, professionalDefaultPct: 30 });
    expect(r).toEqual({ pct: 50, fixed: 0, source: "service_professional" });
  });
  it("sem regras usa o padrão do profissional", () => {
    expect(resolveCommissionRule({ service: { commission_pct: null, commission_fixed: null }, professionalDefaultPct: 35 }).pct).toBe(35);
  });
  it("desconto é distribuído e reduz a base da comissão", () => {
    expect(distributeDiscount([50, 50], 10)).toEqual([5, 5]);
    expect(calcCommission(45, { pct: 40, fixed: 0 })).toBe(18);
  });
});

describe("taxas de cartão", () => {
  it("crédito à vista R$ 100 com 3,49%", () => {
    expect(calcPayment(100, credit)).toMatchObject({ fee: 3.49, net: 96.51, receiveDays: 30 });
  });
  it("crédito 3x soma taxa de parcelamento", () => {
    expect(calcPayment(100, credit, 3).fee).toBe(6.49);
  });
  it("antecipação recebe em 1 dia com taxa extra", () => {
    expect(calcPayment(100, credit, 1, true)).toMatchObject({ fee: 5.49, receiveDays: 1 });
  });
});

describe("caixa", () => {
  it("fechamento: saldo inicial + vendas em dinheiro + suprimento − sangria", () => {
    expect(expectedCash(100, [
      { type: "sale", method_kind: "cash", amount: 50 },
      { type: "sale", method_kind: "pix", amount: 80 },
      { type: "supply", method_kind: "cash", amount: 20 },
      { type: "withdrawal", method_kind: "cash", amount: 30 },
      { type: "refund", method_kind: "cash", amount: -10 },
    ])).toBe(130);
  });
  it("pagamento dividido precisa fechar o total", () => {
    expect(validatePayments(100, [{ amount: 40 }, { amount: 60 }])).toBeNull();
    expect(validatePayments(100, [{ amount: 40 }])).not.toBeNull();
  });
});
