import { NextRequest, NextResponse } from "next/server";
import {
  calculateMACD,
  calculateRSI,
  calculateSMA,
  generateSignal,
} from "@/lib/indicators";

const SUPPORTED_ASSETS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
];

const DEFAULT_CURRENCY = "usd";
const DEFAULT_ASSET = SUPPORTED_ASSETS[0];
const MARKET_INTERVAL = "hourly";
const MARKET_DAYS = 7;

type MarketPoint = { time: number; value: number };

const coingeckoUrl = (assetId: string, currency: string) =>
  `https://api.coingecko.com/api/v3/coins/${assetId}/market_chart?vs_currency=${currency}&days=${MARKET_DAYS}&interval=${MARKET_INTERVAL}`;

const toSeries = (prices: Array<[number, number]>): MarketPoint[] =>
  prices.map(([time, value]) => ({ time, value }));

const buildFallbackSeries = () => {
  const now = Date.now();
  const points: MarketPoint[] = [];
  let current = 50000;
  for (let i = MARKET_DAYS * 24; i >= 0; i--) {
    const time = now - i * 60 * 60 * 1000;
    const noise = Math.sin(i / 3) * 120 + Math.cos(i / 5) * 80;
    current = Math.max(20000, current + noise + (Math.random() - 0.5) * 60);
    points.push({ time, value: parseFloat(current.toFixed(2)) });
  }
  return points;
};

const pickAsset = (assetId?: string) => {
  if (!assetId) return DEFAULT_ASSET;
  return SUPPORTED_ASSETS.find((asset) => asset.id === assetId) ?? DEFAULT_ASSET;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const assetParam = searchParams.get("asset") ?? undefined;
  const currency = (searchParams.get("currency") ?? DEFAULT_CURRENCY).toLowerCase();
  const asset = pickAsset(assetParam?.toLowerCase());

  try {
    const response = await fetch(coingeckoUrl(asset.id, currency), {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`Market data request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const prices = Array.isArray(payload?.prices) ? payload.prices : [];
    const series = prices.length ? toSeries(prices) : buildFallbackSeries();

    return NextResponse.json(buildResponse(series, asset, currency));
  } catch (error) {
    console.error("[market-feed] Fallback engaged:", error);
    const series = buildFallbackSeries();
    return NextResponse.json(buildResponse(series, asset, currency, true), {
      headers: { "x-market-fallback": "true" },
    });
  }
}

const buildResponse = (
  series: MarketPoint[],
  asset: (typeof SUPPORTED_ASSETS)[number],
  currency: string,
  fallback = false,
) => {
  const smaShort = calculateSMA(series, 12);
  const smaLong = calculateSMA(series, 48);
  const rsi = calculateRSI(series);
  const macd = calculateMACD(series);
  const signal = generateSignal(series);

  return {
    asset,
    currency,
    fallback,
    meta: {
      fetchedAt: Date.now(),
      rangeHours: series.length,
      disclaimer:
        "Signals are generated algorithmically. Past performance does not guarantee future results.",
    },
    signal,
    series,
    indicators: {
      smaShort,
      smaLong,
      rsi,
      macd,
    },
    supportedAssets: SUPPORTED_ASSETS,
  };
};
