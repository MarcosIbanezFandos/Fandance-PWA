import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, ExternalLink, Calendar, TrendingUp } from 'lucide-react';
import { GlassCard, staggerContainer } from './UI';
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
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/portfolio/${activePortfolioId}?t=${Date.now()}`);
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

            const newsRes = await axios.post(`${import.meta.env.VITE_API_URL}/portfolio/news`, { assets: assetsPayload });
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
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        }
    };

    if (!activePortfolioId) {
        return <div className="text-center py-20 text-slate-400 font-bold">{t('news.select_portfolio')}</div>;
    }

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8">
            {/* Header Sentiment Summary */}
            {newsData.aggregate && (
                <GlassCard className="flex flex-col md:flex-row items-center justify-between gap-6 !p-8">
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${getBadge(newsData.aggregate.color)}`}>
                            <TrendingUp size={32} />
                        </div>
                        <div>
                            <div className="text-sm font-black text-slate-400 uppercase tracking-widest">{t('news.sentiment')}</div>
                            <div className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">{newsData.aggregate.label}</div>
                            <div className="text-xs font-bold text-slate-400 mt-1">
                                {t('news.score')}: <span className="text-slate-700 dark:text-slate-300">{newsData.aggregate.score}/100</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right hidden md:block">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('news.analyzed')}</div>
                        <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{allNews.length}</div>
                    </div>
                </GlassCard>
            )}

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>
            ) : Object.keys(newsData.news).length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-bold">{t('news.none')}</div>
            ) : (
                <div className="space-y-12">
                    {Object.entries(newsData.news).map(([ticker, items]) => {
                        if (items.length === 0) return null;
                        const sentiment = newsData.sentiments[ticker];

                        return (
                            <div key={ticker} className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-lg">
                                            {ticker.substring(0, 2)}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{tickerToName[ticker] || ticker}</h2>
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{ticker}</div>
                                        </div>
                                    </div>

                                    {sentiment && (
                                        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl ${getBadge(sentiment.color)}`}>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black uppercase tracking-widest opacity-80">{t('news.rsi')}</div>
                                                <div className="text-sm font-black">{sentiment.label} ({sentiment.score})</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {items.map((item, idx) => (
                                        <GlassCard key={idx} className="flex flex-col group h-full">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase truncate">{item.publisher}</span>
                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
                                                    <Calendar size={10} /> {new Date(item.time).toLocaleDateString() !== 'Invalid Date' ? new Date(item.time).toLocaleDateString() : 'Recent'}
                                                </span>
                                            </div>

                                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mb-4 line-clamp-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {item.title}
                                            </h3>

                                            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <a href={item.link} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center justify-between text-[10px] font-black text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors uppercase tracking-widest">
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
