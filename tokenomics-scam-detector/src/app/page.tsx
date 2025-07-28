'use client'; // Required for using hooks like useState and event handlers

import { useState } from 'react';

// Chart.js imports
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';

// PDF import
import jsPDF from 'jspdf';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);


// --- Interfaces matching the Edge Function's ResponseData ---
interface WalletDistributionData {
  address: string;
  percentage: number;
}

interface AnalysisCategory {
  score: number;
  details: string;
  [key: string]: any;
}

interface AnalysisBreakdown {
  walletConcentration: AnalysisCategory & { topWalletsPercentage: number; singleWalletMaxPercentage: number };
  liquidityAnalysis: AnalysisCategory & { ratio: number; liquidityUSD: number | string; marketCapUSD: number | string };
  supplyDynamics: AnalysisCategory & { mintingRiskScore: number; isMintable: boolean; reserveScore: number; reserveDetails: string };
  tradingVolume: AnalysisCategory & { volumeToHoldersRatio: number | string; washTradingDetected: boolean; dailyVolumeUSD: number | string; holderCount: number | string };
}

interface AnalysisResponse {
  riskScore: number | null;
  breakdown: AnalysisBreakdown | null;
  walletDistribution: WalletDistributionData[] | null;
  redFlags: string[] | null;
  error: string | null;
}

// Helper function to generate a gradient of colors for the pie chart
const generateChartColors = (numColors: number): string[] => {
  const colors: string[] = [];
  const startColor = { r: 22, g: 163, b: 74 }; // Green-500
  const endColor = { r: 59, g: 130, b: 246 }; // Blue-500

  for (let i = 0; i < numColors; i++) {
    const ratio = i / (numColors - 1);
    const r = Math.round(startColor.r * (1 - ratio) + endColor.r * ratio);
    const g = Math.round(startColor.g * (1 - ratio) + endColor.g * ratio);
    const b = Math.round(startColor.b * (1 - ratio) + endColor.b * ratio);
    colors.push(`rgba(${r}, ${g}, ${b}, 0.8)`);
  }
  return colors;
};


export default function Home() {
  const [tokenIdentifier, setTokenIdentifier] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const handleAnalysis = async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError("Supabase URL or Anon Key is not configured. Please check environment variables.");
      setIsLoading(false); // Ensure loading is stopped
      return;
    }
    if (!tokenIdentifier.trim()) {
      setError("Please enter a token contract address or name.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ tokenIdentifier: tokenIdentifier.trim() }),
      });

      const data: AnalysisResponse = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      setAnalysisResult(data);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch analysis. The token might not be supported or an error occurred.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!analysisResult || analysisResult.riskScore === null) {
      alert("Please analyze a token first to generate a report.");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let currentY = 20;

    const checkY = (neededHeight: number) => {
      if (currentY + neededHeight > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
      }
    };

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Tokenomics Analysis Report", pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;

    if (tokenIdentifier) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Token: ${tokenIdentifier}`, margin, currentY);
      currentY += 7;
    }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Overall Risk Score: ${analysisResult.riskScore} / 100`, margin, currentY);
    currentY += 10;
    doc.setLineWidth(0.3);
    doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2);

    // Analysis Breakdown Section
    if (analysisResult.breakdown) {
      currentY += 8;
      checkY(10);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Analysis Breakdown:", margin, currentY);
      currentY += 8;

      const printCategory = (title: string, categoryData: AnalysisCategory) => {
        checkY(10); // For category title
        doc.setFontSize(14);
        doc.setFont("helvetica", "bolditalic");
        doc.text(title, margin, currentY);
        currentY += 6;

        checkY(6);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Score: ${categoryData.score} / 100`, margin + 5, currentY);
        currentY += 6;

        doc.setFont("helvetica", "normal");
        const detailsText = doc.splitTextToSize(`Details: ${categoryData.details}`, contentWidth - 5);
        checkY(detailsText.length * 5);
        doc.text(detailsText, margin + 5, currentY);
        currentY += detailsText.length * 5 + 3;

        // Print specific metrics for each category
        Object.entries(categoryData).forEach(([key, value]) => {
            if (key !== 'score' && key !== 'details') {
                let formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                let formattedValue = typeof value === 'number' ? value.toFixed(2) : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);

                const metricText = `${formattedKey}: ${formattedValue}`;
                const splitMetricText = doc.splitTextToSize(metricText, contentWidth - 10);
                checkY(splitMetricText.length * 5);
                doc.setFontSize(10);
                doc.text(splitMetricText, margin + 10, currentY);
                currentY += splitMetricText.length * 5 + 2;
            }
        });
        currentY += 4; // Extra space after category
      };

      printCategory("Wallet Concentration", analysisResult.breakdown.walletConcentration);
      printCategory("Liquidity Analysis", analysisResult.breakdown.liquidityAnalysis);
      printCategory("Supply Dynamics", analysisResult.breakdown.supplyDynamics);
      printCategory("Trading Volume", analysisResult.breakdown.tradingVolume);
    }

    // Red Flags Section
    if (analysisResult.redFlags && analysisResult.redFlags.length > 0) {
      currentY += 5;
      checkY(10); // For section title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Identified Red Flags:", margin, currentY);
      currentY += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      analysisResult.redFlags.forEach(flag => {
        const flagText = `- ${flag}`;
        const splitFlag = doc.splitTextToSize(flagText, contentWidth - 5); // Indent slightly for bullet
        checkY(splitFlag.length * 5);
        doc.text(splitFlag, margin + 5, currentY);
        currentY += splitFlag.length * 5 + 2;
      });
    }

    doc.save('tokenomics_analysis_report.pdf');
  };

  // Prepare chart data if results are available
  const chartData = analysisResult?.walletDistribution && analysisResult.walletDistribution.length > 0
    ? {
        labels: analysisResult.walletDistribution.map(item => {
          const addr = item.address;
          return addr.startsWith('0x') && addr.length > 10 ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : addr;
        }),
        datasets: [
          {
            label: '% of Supply',
            data: analysisResult.walletDistribution.map(item => item.percentage),
            backgroundColor: generateChartColors(analysisResult.walletDistribution.length),
            borderColor: generateChartColors(analysisResult.walletDistribution.length).map(color => color.replace('0.8', '1')),
            borderWidth: 1,
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'hsl(var(--muted-foreground))',
          boxWidth: 12,
          padding: 20,
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: false, // Title is now part of the Card component
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'hsl(var(--card))',
        titleColor: 'hsl(var(--foreground))',
        bodyColor: 'hsl(var(--muted-foreground))',
        borderColor: 'hsl(var(--border))',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: function(context: any) {
            const originalLabel = context.chart.data.labels?.[context.dataIndex] ?? '';
            const percentage = context.parsed;
            return `${originalLabel}: ${percentage.toFixed(2)}%`;
          }
        }
      }
    },
    elements: {
      arc: {
        borderWidth: 0,
        hoverBorderColor: 'hsl(var(--foreground))',
        hoverBorderWidth: 2,
      }
    }
  };


  // --- Helper Components ---
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-card text-card-foreground border border-border/50 shadow-lg rounded-2xl p-6 transition-all duration-300 hover:border-border ${className}`}>
      {children}
    </div>
  );

const MetricDisplay = ({ label, value, score, details, icon }: { label: string; value: string | React.ReactNode; score?: number; details?: string; icon: React.ReactNode }) => (
  <div className="flex items-center gap-4">
    <div className="text-teal-400">{icon}</div>
    <div>
      <p className="font-semibold text-gray-300">{label} {score && <span className="text-xs text-gray-500">({score}/100)</span>}</p>
      <p className="text-lg font-bold text-white">{value}</p>
      {details && <p className="text-xs text-gray-400 mt-1">{details}</p>}
    </div>
  </div>
);

const RiskScoreGauge = ({ score }: { score: number | null }) => {
    if (score === null) return null;
    const percentage = (score / 100) * 100;
    const color = score > 70 ? 'text-red-500' : score > 40 ? 'text-orange-400' : 'text-green-400';

    return (
      <div className="relative w-48 h-48 mx-auto">
        <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray={`${(percentage * 339.292) / 100}, 339.292`}
            className={`transition-all duration-1000 ease-out ${color}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${color}`}>{score}</span>
          <span className="text-sm text-gray-400">/ 100</span>
        </div>
      </div>
    );
};

// --- Main Component ---
return (
  <div className="min-h-screen bg-gray-900 text-white font-sans">
    <div className="absolute inset-0 z-0 opacity-10">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-teal-500/20 rounded-full filter blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full filter blur-3xl"></div>
    </div>

    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
      <header className="text-center my-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">
          Tokenomics Scam Detector
        </h1>
        <p className="text-gray-400 mt-2">Enter a token address to analyze its potential risk factors.</p>
      </header>

      {/* Input Section */}
      <section className="mb-8">
        <div className="flex flex-col sm:flex-row items-center gap-4 max-w-2xl mx-auto">
          <input
            type="text"
            placeholder="Enter token contract address or name..."
            className="flex-grow w-full bg-gray-800/60 text-white border-2 border-gray-700 rounded-lg py-3 px-4 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition duration-150 disabled:opacity-50"
            value={tokenIdentifier}
            onChange={(e) => setTokenIdentifier(e.target.value)}
            disabled={isLoading}
          />
          <button
            className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAnalysis}
            disabled={isLoading}
          >
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </section>

      {/* Loading and Error States */}
      {isLoading && (
        <div className="text-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto"></div>
          <p className="text-lg text-teal-300 mt-4">Analyzing token... Please wait.</p>
        </div>
      )}

      {error && (
        <Card className="my-8 max-w-2xl mx-auto border border-red-500/50">
          <div className="flex items-center gap-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            <div>
              <h3 className="font-bold text-lg text-red-400">Analysis Error</h3>
              <p className="text-red-200">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Analysis Results */}
      {analysisResult && !error && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
            <button
              onClick={handleDownloadPdf}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-150 transform hover:scale-105 disabled:opacity-50"
              disabled={isLoading || !analysisResult || analysisResult.riskScore === null}
            >
              Download PDF Report
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Score and Key Metrics */}
            <div className="lg:col-span-1 space-y-8">
              <Card>
                <h2 className="text-2xl font-semibold text-teal-300 mb-4 text-center">Overall Risk Score</h2>
                <RiskScoreGauge score={analysisResult.riskScore} />
                <p className="text-sm text-gray-400 text-center mt-4">(Higher score indicates higher potential risk)</p>
              </Card>

              {analysisResult.redFlags && analysisResult.redFlags.length > 0 && (
                <Card>
                  <h2 className="text-2xl font-semibold text-red-400 mb-4">Identified Red Flags</h2>
                  <ul className="space-y-3">
                    {analysisResult.redFlags.map((flag, index) => (
                      <li key={index} className="flex items-start gap-3 text-red-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            {/* Right Column: Chart and Breakdown */}
            <div className="lg:col-span-2 space-y-8">
              <Card className="min-h-[400px] flex flex-col">
                <h2 className="text-2xl font-semibold text-teal-300 mb-4 text-center">Token Distribution</h2>
                <div className="flex-grow w-full h-80">
                  {chartData ? (
                    <Pie data={chartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-400">
                        {isLoading ? 'Loading chart...' : 'No wallet distribution data to display.'}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {analysisResult.breakdown && (
                <Card>
                  <h2 className="text-2xl font-semibold text-teal-300 mb-6">Detailed Analysis</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <MetricDisplay
                      label="Wallet Concentration"
                      score={analysisResult.breakdown.walletConcentration.score}
                      value={`${analysisResult.breakdown.walletConcentration.topWalletsPercentage?.toFixed(2)}%`}
                      details={analysisResult.breakdown.walletConcentration.details}
                      icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.122-1.28-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.122-1.28.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                    />
                     <MetricDisplay
                      label="Liquidity Analysis"
                      score={analysisResult.breakdown.liquidityAnalysis.score}
                      value={`$${Number(analysisResult.breakdown.liquidityAnalysis.liquidityUSD).toLocaleString()}`}
                      details={analysisResult.breakdown.liquidityAnalysis.details}
                      icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                    />
                    <MetricDisplay
                      label="Supply Dynamics"
                      score={analysisResult.breakdown.supplyDynamics.score}
                      value={analysisResult.breakdown.supplyDynamics.isMintable ? "Mintable" : "Fixed Supply"}
                      details={analysisResult.breakdown.supplyDynamics.details}
                      icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5V4H4zm0 12v5h5v-5H4zM15 4v5h5V4h-5zm0 12v5h5v-5h-5z" /></svg>}
                    />
                    <MetricDisplay
                      label="Trading Volume"
                      score={analysisResult.breakdown.tradingVolume.score}
                      value={analysisResult.breakdown.tradingVolume.washTradingDetected ? "Wash Trading Risk" : "Looks Normal"}
                      details={analysisResult.breakdown.tradingVolume.details}
                      icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
                    />
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="mt-16 text-center">
        <p className="text-sm text-gray-500">
          Disclaimer: This tool is for educational purposes only. Always conduct your own thorough research.
        </p>
      </footer>
    </main>
  </div>
);
}
