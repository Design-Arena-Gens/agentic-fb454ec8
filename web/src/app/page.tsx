"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { TooltipItem } from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";

type MarketPoint = { time: number; value: number };

type ApiResponse = {
  asset: { id: string; symbol: string; name: string };
  currency: string;
  fallback: boolean;
  meta: { fetchedAt: number; rangeHours: number; disclaimer: string };
  signal: {
    action: "BUY" | "SELL" | "HOLD";
    confidence: number;
    summary: string;
    bulletPoints: string[];
    indicators: {
      short: number;
      long: number;
      rsi: number;
      macd: number;
      macdSignal: number;
      histogram: number;
      price: number;
    };
  };
  series: MarketPoint[];
  indicators: {
    smaShort: Array<number | null>;
    smaLong: Array<number | null>;
    rsi: Array<number | null>;
    macd: {
      macdLine: number[];
      signalLine: number[];
      histogram: number[];
    };
  };
  supportedAssets: Array<{ id: string; symbol: string; name: string }>;
};

const ASSET_PRESETS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
];

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend, Filler);

const fetcher = (url: string) =>
  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      console.error("[market-fetch]", error);
      throw error;
    });

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
  month: "short",
  day: "2-digit",
});

export default function Home() {
  const [asset, setAsset] = useState("bitcoin");
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    `/api/market?asset=${asset}`,
    fetcher,
    { refreshInterval: 60_000 },
  );

  const assetOptions = data?.supportedAssets ?? ASSET_PRESETS;

  const chartData = useMemo(() => {
    if (!data) return null;
    const labels = data.series.map((point) => new Date(point.time));

    return {
      labels,
      datasets: [
        {
          label: `${data.asset.symbol} Price`,
          data: data.series.map((point) => ({ x: new Date(point.time), y: point.value })),
          borderColor: "rgba(59, 130, 246, 1)",
          backgroundColor: "rgba(59, 130, 246, 0.15)",
          pointRadius: 0,
          fill: true,
          tension: 0.35,
        },
        {
          label: "Short-Term Momentum",
          data: data.indicators.smaShort.map((value, index) => ({
            x: labels[index],
            y: value ?? null,
          })),
          borderColor: "rgba(251, 191, 36, 1)",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: "Long-Term Trend",
          data: data.indicators.smaLong.map((value, index) => ({
            x: labels[index],
            y: value ?? null,
          })),
          borderColor: "rgba(16, 185, 129, 0.9)",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.25,
        },
      ],
    };
  }, [data]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: { boxWidth: 14, padding: 12 },
        },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          callbacks: {
            label: (context: TooltipItem<"line">) => {
              const prefix = context.dataset.label ? `${context.dataset.label}: ` : "";
              return `${prefix}${formatter.format(context.parsed.y ?? 0)}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "time" as const,
          time: { unit: "day" as const },
          ticks: { maxRotation: 0 },
          grid: { display: false },
        },
        y: {
          ticks: {
            callback: (value: string | number) =>
              typeof value === "number" ? formatter.format(value) : value,
          },
          grid: { color: "rgba(148, 163, 184, 0.15)" },
        },
      },
    }),
    [],
  );

  const statusColor =
    data?.signal.action === "BUY"
      ? "bg-gradient-to-r from-green-500 to-emerald-500"
      : data?.signal.action === "SELL"
        ? "bg-gradient-to-r from-rose-500 to-red-500"
        : "bg-gradient-to-r from-slate-500 to-gray-600";

  const confidenceAngle = ((data?.signal.confidence ?? 0) / 100) * 180;

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-white/5 p-8 shadow-2xl backdrop-blur md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.35em] text-slate-300">QuantumFlow</p>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
              AI Crypto Execution Desk
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
              Live market intelligence that fuses momentum analytics, multi-horizon trend discovery,
              and adaptive risk signals to surface decisive buy or sell actions.
            </p>
          </div>
          <div className="flex gap-3">
            {assetOptions.map((item) => (
              <button
                key={item.id}
                onClick={() => setAsset(item.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  asset === item.id
                    ? "border-blue-400/80 bg-blue-500/20 text-blue-100 shadow"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10"
                }`}
              >
                {item.symbol}
              </button>
            ))}
          </div>
        </header>

        <main className="grid grid-cols-1 gap-8 lg:grid-cols-[1.8fr_1fr]">
          <section className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-white/5 p-8 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-300">
                  {data
                    ? `${data.asset.name} · ${data.asset.symbol} / ${data.currency.toUpperCase()}`
                    : "Loading market feed"}
                </p>
                <h2 className="text-2xl font-semibold">
                  {data ? formatter.format(data.signal.indicators.price) : "—"}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${statusColor}`}>
                  <span className="font-semibold tracking-wide">{data?.signal.action ?? "…"}</span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                    {data ? `${Math.round(data.signal.confidence)}%` : "—"}
                  </span>
                </div>
                <button
                  onClick={() => mutate()}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                >
                  Refresh
                </button>
              </div>
            </div>
            <div className="relative h-80 w-full overflow-hidden rounded-2xl border border-white/5 bg-black/30 p-4">
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
                  <span className="animate-pulse text-sm text-slate-300">
                    calibrating inference engine…
                  </span>
                </div>
              )}
              {error && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/60 p-6 text-center text-sm text-rose-200">
                  <span>Market feed unavailable.</span>
                  <span className="text-xs text-slate-400">
                    {error instanceof Error ? error.message : "Unexpected error"}
                  </span>
                </div>
              )}
              {chartData && <Line data={chartData} options={chartOptions} />}
              {!chartData && !isLoading && !error && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                  Awaiting signal data…
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InsightCard
                title="Signal Synopsis"
                description={data?.signal.summary ?? "Awaiting live signal synthesis."}
                bullets={data?.signal.bulletPoints ?? []}
              />
              <IndicatorPanel data={data} />
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-2xl backdrop-blur">
              <div className="text-sm uppercase tracking-[0.35em] text-slate-300">Confidence</div>
              <div className="mt-6 flex items-center justify-center">
                <ConfidenceGauge value={data?.signal.confidence ?? 0} angle={confidenceAngle} />
              </div>
              <p className="mt-6 text-sm leading-relaxed text-slate-300">
                Confidence synthesizes momentum, volatility, and macro flow factors. Higher scores
                indicate stronger directional conviction but always incorporate disciplined risk
                management.
              </p>
            </div>

            <div className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-transparent p-6 text-amber-100 shadow-lg backdrop-blur">
              <h3 className="text-sm uppercase tracking-[0.35em] text-amber-200">Caution</h3>
              <p className="mt-3 text-sm leading-relaxed">
                AI-generated insights accelerate execution but do not eliminate risk. Validate signals
                with your strategy and manage exposure accordingly. Historical performance does not
                guarantee future outcomes.
              </p>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-2xl backdrop-blur">
              <h3 className="text-sm uppercase tracking-[0.35em] text-slate-300">Feed Metadata</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-200">
                <li className="flex justify-between">
                  <span>Updated</span>
                  <span>
                    {data ? timeFormatter.format(new Date(data.meta.fetchedAt)) : "Not available"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Window</span>
                  <span>{data ? `${data.meta.rangeHours} hrs` : "—"}</span>
                </li>
                <li className="flex justify-between">
                  <span>Source</span>
                  <span>{data?.fallback ? "Synthetic Fallback" : "CoinGecko Spot"}</span>
                </li>
              </ul>
            </div>
          </aside>
        </main>

        <footer className="pb-6 text-center text-xs text-slate-400">
          QuantumFlow Alpha · Adaptive AI-driven trading signals. Zero guarantees — disciplined risk
          is mandatory.
        </footer>
      </div>
    </div>
  );
}

type InsightCardProps = {
  title: string;
  description: string;
  bullets: string[];
};

const InsightCard = ({ title, description, bullets }: InsightCardProps) => (
  <div className="h-full rounded-2xl border border-white/5 bg-slate-950/40 p-5">
    <h3 className="text-sm uppercase tracking-[0.35em] text-slate-300">{title}</h3>
    <p className="mt-3 text-sm text-slate-200">{description}</p>
    <ul className="mt-4 space-y-2 text-sm text-slate-300">
      {bullets.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

const IndicatorPanel = ({ data }: { data?: ApiResponse | undefined }) => {
  if (!data) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-5 text-sm text-slate-300">
        Loading indicator stack…
      </div>
    );
  }

  const stats = [
    {
      label: "RSI",
      value: data.signal.indicators.rsi.toFixed(1),
      hint:
        data.signal.indicators.rsi < 30
          ? "Oversold bias"
          : data.signal.indicators.rsi > 70
            ? "Overbought stretch"
            : "Neutral zone",
    },
    {
      label: "MACD Δ",
      value: (data.signal.indicators.macd - data.signal.indicators.macdSignal).toFixed(2),
      hint:
        data.signal.indicators.macd > data.signal.indicators.macdSignal
          ? "Bullish tempo"
          : "Bearish fade",
    },
    {
      label: "Trend Spread",
      value: (data.signal.indicators.short - data.signal.indicators.long).toFixed(2),
      hint:
        data.signal.indicators.short > data.signal.indicators.long
          ? "Upside acceleration"
          : "Downside pressure",
    },
    {
      label: "Confidence",
      value: `${Math.round(data.signal.confidence)}%`,
      hint: "Composite conviction",
    },
  ];

  return (
    <div className="h-full rounded-2xl border border-white/5 bg-slate-950/40 p-5">
      <h3 className="text-sm uppercase tracking-[0.35em] text-slate-300">Indicator Stack</h3>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/5 bg-white/5 px-3 py-4">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{stat.label}</div>
            <div className="mt-2 text-lg font-semibold text-white">{stat.value}</div>
            <div className="mt-1 text-[0.7rem] uppercase tracking-[0.2em] text-blue-200">
              {stat.hint}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ConfidenceGauge = ({ value, angle }: { value: number; angle: number }) => (
  <div className="relative flex h-40 w-40 items-center justify-center">
    <div className="absolute inset-0 rounded-full border border-white/10 bg-white/5" />
    <div
      className="absolute bottom-1/2 left-1/2 h-20 w-1 origin-bottom bg-gradient-to-t from-blue-500 via-sky-300 to-white shadow-[0_0_12px_rgba(56,189,248,0.55)]"
      style={{ transform: `translateX(-50%) rotate(${angle - 90}deg)` }}
    />
    <div className="absolute inset-5 rounded-full border border-white/10 bg-slate-950/70 backdrop-blur" />
    <div className="relative flex flex-col items-center justify-center gap-1">
      <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Confidence</span>
      <span className="text-2xl font-semibold text-blue-100">{Math.round(value)}%</span>
      <span className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">
        Composite Score
      </span>
    </div>
  </div>
);
