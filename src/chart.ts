import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration, Chart as ChartJSChart, Plugin } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { categoryColor, categoryEmoji } from './categories.js';
import { formatAmount } from './format.js';
import type { CategoryTotal, DailyExpense } from './transactions.js';

const WIDTH = 900;
const HEIGHT = 560;
const BG = '#15171c';
const CARD_BG = '#1d2026';

const FONT_FAMILY = "'Noto Sans', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";

const renderer = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: BG,
  plugins: { modern: [ChartDataLabels as unknown as Plugin] },
  chartCallback: (ChartJS) => {
    ChartJS.defaults.color = '#e8e8e8';
    ChartJS.defaults.font.family = FONT_FAMILY;
    ChartJS.defaults.font.size = 14;
    ChartJS.defaults.set('plugins.datalabels', { color: '#ffffff' });
  },
});

const trendRenderer = new ChartJSNodeCanvas({
  width: WIDTH,
  height: 360,
  backgroundColour: BG,
  plugins: { modern: [ChartDataLabels as unknown as Plugin] },
  chartCallback: (ChartJS) => {
    ChartJS.defaults.color = '#e8e8e8';
    ChartJS.defaults.font.family = FONT_FAMILY;
    ChartJS.defaults.font.size = 14;
  },
});

const centerTextPlugin = (text: string, subtitle: string): Plugin => ({
  id: 'centerText',
  afterDraw(chart: ChartJSChart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.fillText(text, cx, cy - 8);
    ctx.fillStyle = '#a0a0a0';
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.fillText(subtitle, cx, cy + 18);
    ctx.restore();
  },
});

export async function renderCategoryDonut(
  title: string,
  data: CategoryTotal[],
  totalKopecks: number,
  currencySymbol: string,
  _daily?: DailyExpense[],
  _from?: Date,
  _tz?: string,
): Promise<Buffer> {
  const labels = data.map((d) => `${categoryEmoji(d.category)} ${d.category}`);
  const values = data.map((d) => d.total / 100);
  const colors = data.map((d) => categoryColor(d.category));
  const totalLabel = formatAmount(totalKopecks, currencySymbol);

  const cfg: ChartConfiguration<'doughnut'> = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: CARD_BG,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: false,
      cutout: '62%',
      layout: { padding: { top: 16, right: 24, bottom: 24, left: 24 } },
      plugins: {
        legend: {
          position: 'right',
          align: 'center',
          labels: {
            color: '#e8e8e8',
            font: { size: 14 },
            padding: 12,
            boxWidth: 18,
            boxHeight: 18,
            usePointStyle: false,
          },
        },
        title: {
          display: true,
          text: title,
          color: '#ffffff',
          font: { size: 18, weight: 'bold' },
          padding: { top: 12, bottom: 4 },
        },
        subtitle: {
          display: true,
          text: `Итого: ${totalLabel}`,
          color: '#9ad29a',
          font: { size: 14 },
          padding: { top: 0, bottom: 12 },
        },
        tooltip: { enabled: false },
        datalabels: {
          color: '#ffffff',
          font: { size: 13, weight: 'bold' },
          formatter(value: number) {
            if (totalKopecks <= 0) return '';
            const pct = (value * 100) / (totalKopecks / 100);
            if (pct < 6) return '';
            return `${pct.toFixed(0)}%`;
          },
        },
      },
    },
    plugins: [centerTextPlugin(totalLabel, `${data.length} категорий`)],
  };

  return await renderer.renderToBuffer(cfg, 'image/png');
}

export async function renderEmpty(title: string): Promise<Buffer> {
  const cfg: ChartConfiguration<'doughnut'> = {
    type: 'doughnut',
    data: {
      labels: ['Нет данных'],
      datasets: [{ data: [1], backgroundColor: ['#2a2a2a'], borderWidth: 0 }],
    },
    options: {
      responsive: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: title,
          color: '#ffffff',
          font: { size: 18, weight: 'bold' },
        },
        subtitle: {
          display: true,
          text: 'За этот период трат пока нет',
          color: '#888',
          font: { size: 14 },
        },
        tooltip: { enabled: false },
        datalabels: { display: false },
      },
    },
  };
  return await renderer.renderToBuffer(cfg, 'image/png');
}

/** Renders a vertical bar chart of daily expenses for the given range. */
export async function renderDailyBar(
  title: string,
  daily: DailyExpense[],
  currencySymbol: string,
): Promise<Buffer> {
  const labels = daily.map((d) => formatDayLabel(d.day));
  const values = daily.map((d) => d.total / 100);

  const cfg: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: '#4a7bff',
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: false,
      layout: { padding: { top: 16, right: 24, bottom: 16, left: 16 } },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: title,
          color: '#ffffff',
          font: { size: 18, weight: 'bold' },
          padding: { top: 8, bottom: 12 },
        },
        tooltip: { enabled: false },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#e8e8e8',
          font: { size: 12, weight: 'bold' },
          formatter(value: number) {
            if (value <= 0) return '';
            return formatAmount(Math.round(value * 100), currencySymbol);
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#c8c8c8', font: { size: 13 } },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#888', font: { size: 12 } },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
      },
    },
  };

  return await trendRenderer.renderToBuffer(cfg, 'image/png');
}

function formatDayLabel(yyyyMmDd: string): string {
  const [, m, d] = yyyyMmDd.split('-');
  const months = [
    'янв',
    'фев',
    'мар',
    'апр',
    'май',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ];
  return `${Number(d)} ${months[Number(m) - 1] ?? ''}`;
}
