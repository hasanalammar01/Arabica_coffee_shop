import { currency } from "../data/menu.ts";

/** 450000 → "450,000". The currency label is rendered separately so it can be styled smaller. */
export const formatAmount = (lbp: number) => lbp.toLocaleString("en-US");
export const currencyLabel = currency.label;
