import { useEffect, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import {
  ChartCanvas,
  Chart,
  CandlestickSeries,
  XAxis,
  YAxis,
  CrossHairCursor,
  MouseCoordinateX,
  MouseCoordinateY,
  EdgeIndicator,
  LineSeries,
  CurrentCoordinate,
  discontinuousTimeScaleProvider,
} from "react-financial-charts";
import { format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, Tooltip, CartesianGrid } from "recharts";

const DURATION_OPTIONS = [
  { label: "60 Days", value: 60 },
  { label: "1 Month", value: 30 },
  { label: "3 Months", value: 90 },
  { label: "6 Months", value: 180 },
  { label: "1 Year", value: 365 },
];

const PREDICT_OPTIONS = [
  { label: "Next Day", value: "day" },
  { label: "Next Month", value: "month" },
];

function formatDate(date) {
  if (!date) return "";
  if (typeof date === "string" || typeof date === "number") date = new Date(date);
  return format(date, "MMM dd");
}

function StockData({ width = 900, ratio = 1 }) {
  const location = useLocation();
  const initialSymbol = location.state?.symbol || "AAPL";
  const [symbol, setSymbol] = useState(initialSymbol);
  const [search, setSearch] = useState(initialSymbol);
  const [duration, setDuration] = useState(90);
  const [records, setRecords] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [predictHorizon, setPredictHorizon] = useState("day");
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState("candlestick");
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      setPrediction(null);
      try {
        const res = await axios.get(`http://127.0.0.1:5000/stock/data/${symbol}`, {
          params: { limit: duration, days: duration },
        });
        if (res.data.success) {
          setRecords(
            res.data.data.records.map((r) => ({
              ...r,
              date: new Date(r.date),
              open: r.open,
              high: r.high,
              low: r.low,
              close: r.close,
            }))
          );
          setStatistics(res.data.data.statistics);
        } else {
          setRecords([]);
          setStatistics(null);
          setError(res.data.message || "No data found.");
        }
      } catch (err) {
        setRecords([]);
        setStatistics(null);
        setError("Failed to fetch stock data.");
      }
      setLoading(false);
    }
    fetchData();
  }, [symbol, duration]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setSymbol(search.trim().toUpperCase());
    setPrediction(null);
    setError("");
  };

  const handlePredict = async () => {
    setPredicting(true);
    setPrediction(null);
    setError("");
    try {
      const res = await axios.get(
        `http://127.0.0.1:5000/stock/predict/${symbol}?horizon=${predictHorizon}`
      );
      if (res.data.success) {
        setPrediction(res.data.prediction);
      } else {
        setError(res.data.message || "Prediction failed.");
      }
    } catch {
      setError("Prediction failed.");
    }
    setPredicting(false);
  };

  const handleChartToggle = () => {
    setChartType(chartType === "candlestick" ? "line" : "candlestick");
  };

  // Prepare data for react-financial-charts
  const chartData = records.map((r) => ({
    date: r.date,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));

  // Add predicted data point for chart
  let chartDataWithPrediction = [...chartData];
  if (prediction && chartData.length > 0) {
    const lastDate = chartData[chartData.length - 1].date;
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + (predictHorizon === "day" ? 1 : 30));
    chartDataWithPrediction.push({
      date: nextDate,
      open: null,
      high: null,
      low: null,
      close: prediction.predicted_close,
      predicted: true,
    });
  }

  // For ChartCanvas width
  const chartWidth = Math.min(width, 1200);

  // Prepare xScaleProvider for react-financial-charts
  const xScaleProvider = discontinuousTimeScaleProvider.inputDateAccessor((d) => d.date);
  const { data, xScale, xAccessor, displayXAccessor } = xScaleProvider(chartDataWithPrediction);

  return (
    <div className="p-4 md:p-8 bg-gray-950 min-h-screen text-white">
      {/* Search and Controls */}
      <form
        className="flex flex-col md:flex-row gap-4 items-center mb-6"
        onSubmit={handleSearch}
      >
        <input
          type="text"
          className="px-4 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none w-full md:w-64 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
          placeholder="Enter Stock Symbol (e.g. AAPL)"
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
        />
        <select
          className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
          value={predictHorizon}
          onChange={(e) => setPredictHorizon(e.target.value)}
        >
          {PREDICT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold shadow transition-all duration-200 transform hover:scale-105"
        >
          Search
        </button>
        <button
          type="button"
          className={`px-5 py-2 rounded font-semibold shadow transition-all duration-200 transform hover:scale-105 ${
            predicting
              ? "bg-green-400"
              : "bg-green-600 hover:bg-green-700"
          }`}
          onClick={handlePredict}
          disabled={predicting}
        >
          {predicting ? "Predicting..." : "Predict"}
        </button>
        <button
          type="button"
          className="px-5 py-2 rounded bg-gray-700 hover:bg-gray-800 font-semibold shadow transition-all duration-200 transform hover:scale-105"
          onClick={handleChartToggle}
        >
          {chartType === "candlestick" ? "Show Line Chart" : "Show Candlestick"}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-800 text-red-100 rounded shadow">
          {error}
        </div>
      )}

      {/* Stock Title */}
      <h1 className="text-3xl font-bold mb-4">{symbol} Stock Data</h1>

      {/* Statistics */}
      {statistics && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Statistics (Last {duration} Days)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm md:text-base">
            <div className="bg-gray-800 rounded p-3 shadow">
              Current:{" "}
              <span className="font-bold">
                ${statistics.price_stats?.current}
              </span>
            </div>
            <div className="bg-gray-800 rounded p-3 shadow">
              Highest:{" "}
              <span className="font-bold">
                ${statistics.price_stats?.highest}
              </span>
            </div>
            <div className="bg-gray-800 rounded p-3 shadow">
              Lowest:{" "}
              <span className="font-bold">
                ${statistics.price_stats?.lowest}
              </span>
            </div>
            <div className="bg-gray-800 rounded p-3 shadow">
              Avg Close:{" "}
              <span className="font-bold">
                ${statistics.price_stats?.average}
              </span>
            </div>
            <div className="bg-gray-800 rounded p-3 shadow">
              Volume Avg:{" "}
              <span className="font-bold">
                {statistics.volume_stats?.average?.toLocaleString()}
              </span>
            </div>
            <div className="bg-gray-800 rounded p-3 shadow">
              Positive Days:{" "}
              <span className="font-bold">
                {statistics.performance_stats?.positive_days}
              </span>
            </div>
            <div className="bg-gray-800 rounded p-3 shadow">
              Negative Days:{" "}
              <span className="font-bold">
                {statistics.performance_stats?.negative_days}
              </span>
            </div>
            <div className="bg-gray-800 rounded p-3 shadow">
              Change:{" "}
              <span
                className={`font-bold ${
                  statistics.price_stats?.change > 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {statistics.price_stats?.change} (
                {statistics.price_stats?.change_percent}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Prediction */}
      {prediction && (
        <div className="mb-6 p-4 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-300 rounded-lg flex flex-col md:flex-row items-center gap-4 shadow animate-pulse">
          <h2 className="text-lg font-semibold mb-2 md:mb-0 text-gray-900">
            LSTM Prediction (
            {PREDICT_OPTIONS.find((opt) => opt.value === predictHorizon)?.label}
            ):
          </h2>
          <div className="text-xl font-bold text-gray-900">
            ${prediction.predicted_close}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-2">
          {chartType === "candlestick"
            ? "Candlestick Chart"
            : "Line Chart (Close Price)"}
        </h2>
        <div className="w-full bg-gray-900 rounded shadow p-2">
          {chartType === "candlestick" && data.length > 0 && (
            <ChartCanvas
              height={400}
              width={chartWidth}
              ratio={ratio}
              margin={{ left: 70, right: 70, top: 20, bottom: 40 }}
              seriesName={symbol}
              data={data}
              xScale={xScale}
              xAccessor={xAccessor}
              displayXAccessor={displayXAccessor}
              xExtents={[
                xAccessor(data[0]),
                xAccessor(data[data.length - 1]),
              ]}
            >
              <Chart id={1} yExtents={(d) => [d.high, d.low, d.close, d.open]}>
                <XAxis
                  axisAt="bottom"
                  orient="bottom"
                  tickFormat={formatDate}
                  ticks={Math.min(10, chartDataWithPrediction.length)}
                  stroke="#fff"
                  tickStroke="#fff"
                  fontSize={12}
                />
                <YAxis
                  axisAt="left"
                  orient="left"
                  stroke="#fff"
                  tickStroke="#fff"
                  fontSize={12}
                />
                <MouseCoordinateX displayFormat={formatDate} />
                <MouseCoordinateY displayFormat={(v) => `$${v.toFixed(2)}`} />
                <CandlestickSeries
                  stroke={(d) =>
                    d.close > d.open ? "#16a34a" : "#dc2626"
                  }
                  wickStroke={(d) =>
                    d.close > d.open ? "#16a34a" : "#dc2626"
                  }
                  fill={(d) =>
                    d.predicted
                      ? "#facc15"
                      : d.close > d.open
                      ? "#16a34a"
                      : "#dc2626"
                  }
                  opacity={(d) => (d.predicted ? 1 : 0.8)}
                />
                {/* Predicted point as a gold line */}
                {prediction && (
                  <LineSeries
                    yAccessor={(d) => (d.predicted ? d.close : null)}
                    stroke="#facc15"
                    strokeWidth={3}
                    highlightOnHover={false}
                  />
                )}
                <EdgeIndicator
                  itemType="last"
                  orient="right"
                  edgeAt="right"
                  yAccessor={(d) => d.close}
                  fill="#3b82f6"
                />
                <CurrentCoordinate yAccessor={(d) => d.close} fill="#3b82f6" />
              </Chart>
              <CrossHairCursor stroke="#fff" />
            </ChartCanvas>
          )}
          {chartType === "line" && chartDataWithPrediction.length > 0 && (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartDataWithPrediction}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: "#fff", fontSize: 12 }}
                  minTickGap={10}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: "#fff", fontSize: 12 }}
                />
                <Tooltip
                  labelFormatter={formatDate}
                  formatter={(value, name) => [
                    `$${value}`,
                    name === "close" ? "Close" : name,
                  ]}
                />
                <CartesianGrid stroke="#444" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* Predicted point */}
                {prediction && (
                  <Line
                    type="monotone"
                    dataKey={(d) => (d.predicted ? d.close : null)}
                    stroke="#facc15"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export default StockData;