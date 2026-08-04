import React, { useState, useEffect } from 'react';
import api from '../api'
import { Loader2, ExternalLink, Calendar, TrendingUp } from 'lucide-react';
import { GlassCard, staggerContainer, Skeleton } from './UI';
import { motion } from 'framer-motion';
import { useGlobal } from '../context/GlobalContext';

export const NewsView = ({ portfolios, activePortfolioId }) => {
    const { t } = useGlobal();
    const [newsData, setNewsData] = useState({ news: {}, sentiments: {}, aggregate: null });
    const [loading, setLoading] = useState(false);
    const [tickerToName, setTickerToName] = useState({});

    useEffect(() => {
        if (activePortfolioId) fetchNews();
    }, [activePortfolioId]);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${import.meta.env.VITE_API_URL}/portfolio/${activePortfolioId}?t=${Date.now()}`);
            const items = res.data || [];

            if (items.length === 0) {
                setNewsData({ news: {}, sentiments: {}, aggregate: null });
                setLoading(false);
                return;
            }

            const assetsPayload = items.map(i => ({ ticker: i.asset.ticker, name: i.asset.name }));
            const mapping = {};
            items.forEach(i => { if (i.asset?.ticker) mapping[i.asset.ticker] = i.asset.name || i.asset.ticker; });
            setTickerToName(mapping);

            const newsRes = await api.post(`${import.meta.env.VITE_API_URL}/portfolio/news`, { assets: assetsPayload });
            setNewsData(newsRes.data);
        } catch (e) {
            console.error("News Error:", e);
        } finally {
            setLoading(false);
        }
    };

    const allNews = Object.entries(newsData.news).flatMap(([ticker, items]) =>
        items.map(item => ({ ...item, ticker, sentiment: newsData.sentiments[ticker] }))
    );

    // badge = [background classes, border class]
    const getBadge = (color) => {
        switch (color) {
            case 'very_green': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
            case 'green': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
            case 'red': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
            case 'orange': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
            default: return 'bg-surface-2 text-ink-2';
        }
    };

    if (!activePortfolioId) {
        return <div className="text-center py-20 text-ink-3 font-bold">{t('news.select_portfolio')}</div>;
    }

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8">
            {/* Header Sentiment Summary */}
            {newsData.aggregate && (
                <GlassCard className="flex flex-col md:flex-row items-center justify-between gap-6 !p-8">
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-card ${getBadge(newsData.aggregate.color)}`}>
                            <TrendingUp size={32} />
                        </div>
                        <div>
                            <div className="text-subhead font-semibold text-ink-3">{t('news.sentiment')}</div>
                            <div className="text-largetitle font-semibold text-ink mt-1">{newsData.aggregate.label}</div>
                            <div className="text-footnote font-bold text-ink-3 mt-1">
                                {t('news.score')}: <span className="text-ink-2">{newsData.aggregate.score}/100</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right hidden md:block">
                        <div className="text-footnote font-bold text-ink-3">{t('news.analyzed')}</div>
                        <div className="text-title1 font-semibold text-ink">{allNews.length}</div>
                    </div>
                </GlassCard>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className="bg-surface rounded-card shadow-card p-4 space-y-2.5">
                            <Skeleton className="h-3.5 w-24" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/5" />
                        </div>
                    ))}
                </div>
            ) : Object.keys(newsData.news).length === 0 ? (
                <div className="text-center py-20 text-ink-3 font-bold">{t('news.none')}</div>
            ) : (
                <div className="space-y-12">
                    {Object.entries(newsData.news).map(([ticker, items]) => {
                        if (items.length === 0) return null;
                        const sentiment = newsData.sentiments[ticker];

                        return (
                            <div key={ticker} className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-brand text-white rounded-control flex items-center justify-center font-semibold text-subhead shadow-card">
                                            {ticker.substring(0, 2)}
                                        </div>
                                        <div>
                                            <h2 className="text-title2 font-semibold text-ink tracking-tight">{tickerToName[ticker] || ticker}</h2>
                                            <div className="text-footnote font-bold text-ink-3">{ticker}</div>
                                        </div>
                                    </div>

                                    {sentiment && (
                                        <div className={`flex items-center gap-3 px-4 py-2 rounded-control ${getBadge(sentiment.color)}`}>
                                            <div className="text-right">
                                                <div className="text-caption2 font-semibold opacity-80">{t('news.rsi')}</div>
                                                <div className="text-subhead font-semibold">{sentiment.label} ({sentiment.score})</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {items.map((item, idx) => (
                                        <GlassCard key={idx} className="flex flex-col group h-full">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-caption2 font-bold text-ink-3 uppercase truncate">{item.publisher}</span>
                                                <span className="text-ink-3">•</span>
                                                <span className="text-caption2 font-bold text-ink-3 flex items-center gap-1 shrink-0">
                                                    <Calendar size={10} /> {new Date(item.time).toLocaleDateString() !== 'Invalid Date' ? new Date(item.time).toLocaleDateString() : 'Recent'}
                                                </span>
                                            </div>

                                            <h3 className="text-subhead font-bold text-ink leading-snug mb-4 line-clamp-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {item.title}
                                            </h3>

                                            <div className="mt-auto pt-4 border-t border-line">
                                                <a href={item.link} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center justify-between text-caption2 font-semibold text-brand hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                                                    {t('news.read')} <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        </GlassCard>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </motion.div>
    );
};
