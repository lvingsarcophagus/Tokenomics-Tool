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

// Helper function to generate distinct colors for the pie chart
const generateChartColors = (numColors: number): string[] => {
  const baseColors = [
    'rgba(54, 162, 235, 0.8)',  // Blue
    'rgba(255, 99, 132, 0.8)',  // Red
    'rgba(75, 192, 192, 0.8)',  // Green
    'rgba(255, 206, 86, 0.8)',  // Yellow
    'rgba(153, 102, 255, 0.8)', // Purple
    'rgba(255, 159, 64, 0.8)',  // Orange
    'rgba(199, 199, 199, 0.8)', // Grey
    'rgba(233, 30, 99, 0.8)',   // Pink
    'rgba(0, 150, 136, 0.8)',   // Teal
    'rgba(121, 85, 72, 0.8)',   // Brown
  ];
  if (numColors <= baseColors.length) {
    return baseColors.slice(0, numColors);
  }
  const colors = [...baseColors];
  for (let i = baseColors.length; i < numColors; i++) {
    const baseColorIndex = i % baseColors.length;
    const color = baseColors[baseColorIndex].replace(/0.8\)/, `${(0.7 - (i / numColors) * 0.2).toFixed(1)})`);
    colors.push(color);
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
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#e5e7eb',
          boxWidth: 15,
          padding: 15,
        }
      },
      title: {
        display: true,
        text: 'Top Wallet Distribution',
        color: '#e5e7eb',
        font: {
          size: 18,
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            const originalLabel = context.chart.data.labels[context.dataIndex];
            const percentage = context.parsed;

            label += `${originalLabel} (${percentage.toFixed(2)}%)`;
            return label;
          }
        }
      }
    },
  };


  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-gray-800 shadow-2xl rounded-lg p-6 sm:p-8">

        <header className="mb-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-teal-400">
            Tokenomics Scam Detector
          </h1>
        </header>

        <section className="mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <input
              type="text"
              placeholder="Enter token contract address or name..."
              className="flex-grow w-full sm:w-auto bg-gray-700 text-white border border-gray-600 rounded-lg py-3 px-4 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition duration-150 disabled:opacity-50"
              value={tokenIdentifier}
              onChange={(e) => setTokenIdentifier(e.target.value)}
              disabled={isLoading}
            />
            <button
              className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-150 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleAnalysis}
              disabled={isLoading}
            >
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </section>

        {isLoading && (
          <div className="text-center my-8">
            <p className="text-xl text-teal-300">Analyzing token... Please wait.</p>
          </div>
        )}

        {error && (
          <div className="my-8 p-4 bg-red-800 border border-red-600 text-red-100 rounded-lg shadow-lg">
            <h3 className="font-bold text-lg mb-2">Error</h3>
            <p>{error}</p>
          </div>
        )}

        {analysisResult && !error && (
          <>
            <div className="text-center mb-6">
                 <button
                    onClick={handleDownloadPdf}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transition duration-150 transform hover:scale-105 disabled:opacity-50"
                    disabled={isLoading || !analysisResult || analysisResult.riskScore === null}
                >
                    Download PDF Report
                </button>
            </div>

            <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-700 p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold text-teal-300 mb-4">Risk Score</h2>
                <p className={`text-5xl font-bold text-center ${
                  analysisResult.riskScore !== null && analysisResult.riskScore > 70 ? 'text-red-500' :
                  analysisResult.riskScore !== null && analysisResult.riskScore > 40 ? 'text-orange-400' :
                  'text-green-400'
                }`}>
                  {analysisResult.riskScore !== null ? analysisResult.riskScore : '-'} / 100
                </p>
                <p className="text-sm text-gray-400 text-center mt-2">(Higher score indicates higher potential risk)</p>
              </div>

              <div className="bg-gray-700 p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold text-teal-300 mb-4">Analysis Breakdown</h2>
                {analysisResult.breakdown ? (
                  <ul className="space-y-3 text-gray-300">
                    <li><strong>Wallet Concentration ({analysisResult.breakdown.walletConcentration.score}/100):</strong> <span className="float-right">{analysisResult.breakdown.walletConcentration.topWalletsPercentage?.toFixed(2)}% by top holders</span></li>
                    <li><strong>Liquidity Analysis ({analysisResult.breakdown.liquidityAnalysis.score}/100):</strong> <span className="float-right">Ratio: {analysisResult.breakdown.liquidityAnalysis.ratio?.toFixed(2)}%</span></li>
                    <li><strong>Supply Dynamics ({analysisResult.breakdown.supplyDynamics.score}/100):</strong> <span className="float-right">{analysisResult.breakdown.supplyDynamics.isMintable ? "Mintable" : "Fixed/Limited"}</span></li>
                    <li><strong>Trading Volume ({analysisResult.breakdown.tradingVolume.score}/100):</strong> <span className="float-right">{analysisResult.breakdown.tradingVolume.washTradingDetected ? "Wash trading suspected" : "Looks normal"}</span></li>
                  </ul>
                ) : <p>No breakdown data available.</p>}
              </div>
            </section>

            {analysisResult.breakdown && (
                 <section className="mb-8 bg-gray-700 p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-semibold text-teal-300 mb-4">Detailed Insights</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                        <p><strong>Wallet Concentration:</strong> {analysisResult.breakdown.walletConcentration.details}</p>
                        <p><strong>Liquidity Analysis:</strong> {analysisResult.breakdown.liquidityAnalysis.details}</p>
                        <p><strong>Supply Dynamics:</strong> {analysisResult.breakdown.supplyDynamics.details}</p>
                        <p><strong>Trading Volume:</strong> {analysisResult.breakdown.tradingVolume.details}</p>
                    </div>
                 </section>
            )}

            {analysisResult.redFlags && analysisResult.redFlags.length > 0 && (
              <section className="mb-8 bg-gray-700 p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold text-red-400 mb-4">Identified Red Flags</h2>
                <ul className="list-disc list-inside space-y-2 text-red-300">
                  {analysisResult.redFlags.map((flag, index) => (
                    <li key={index}>{flag}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="bg-gray-700 p-6 rounded-lg shadow-lg min-h-[300px] sm:min-h-[400px]">
              <h2 className="text-2xl font-semibold text-teal-300 mb-4 text-center">Token Distribution Visualization</h2>
              <div className="w-full h-64 sm:h-80 md:h-96">
                {chartData ? (
                  <Pie data={chartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400">
                      {isLoading ? 'Loading chart data...' : analysisResult && (!analysisResult.walletDistribution || analysisResult.walletDistribution.length === 0) ? 'No wallet distribution data to display.' : 'Wallet distribution data will appear here once analysis is complete.'}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <footer className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Disclaimer: This tool is for educational purposes only. Always conduct your own thorough research.
          </p>
        </footer>

      </div>
    </div>
  );
}
