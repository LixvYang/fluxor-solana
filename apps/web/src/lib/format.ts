import { LAMPORTS_PER_SOL } from "../domain/constants";
import type { Lamports } from "../domain/types";

export function formatAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function formatSol(lamports: Lamports): string {
  const whole = lamports / LAMPORTS_PER_SOL;
  const fraction = lamports % LAMPORTS_PER_SOL;
  const padded = fraction.toString().padStart(9, "0").replace(/0+$/, "");
  return padded ? `${whole}.${padded} SOL` : `${whole} SOL`;
}

export function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}
