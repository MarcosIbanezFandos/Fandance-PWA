import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, ExternalLink, Globe, Calendar, TrendingUp } from 'lucide-react';
import { GlassCard, staggerContainer, fadeInUp } from './UI';
import { motion } from 'framer-motion';

export const NewsView = ({ portfolios, activePortfolioId }) => {
    const [newsData, setNewsData] = useState({ news: {}, sentiments: {}, aggregate: null });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    const activePortfolio = portfolios.find(p => p.id === activePortfolioId);

    useEffect(() => {
        if (activePortfolioId) fetchNews();
    }, [activePortfolioId]);

    const fetchNews = async () => {
        setLoading(true);
        try {
            // Updated endpoint logic in backend now accepts assets list
            // We first need the assets of the active portfolio
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/portfolio/${activePortfolioId}`);
            const items = res.data || [];

            if (items.length === 0) {
                setNewsData({ news: {}, sentiments: {}, aggregate: null });
                setLoading(false);
                return;
            }

            const assetsPayload = items.map(i => ({
                ticker: i.asset.ticker,
                name: i.asset.name
            }));

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

    // Sort by most recent (mock logic as time string varies, but serves structure)
    // Real implementation would parse 'time' properly. 
    // Backend now returns 'time' field.

    const getBadge = (color) => {
        switch (color) {
            case 'very_green': return 'bg-emerald-100 text-emerald-700';
            case 'green': return 'bg-teal-100 text-teal-700';
            case 'red': return 'bg-rose-100 text-rose-700';
            case 'orange': return 'bg-orange-100 text-orange-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8">
            {/* Header Sentiment Summary */}
            {newsData.aggregate && (
                <GlassCard className="flex flex-col md:flex-row items-center justify-between gap-6 !p-8 bg-gradient-to-r from-white to-slate-50">
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${getBadge(newsData.aggregate.color)}`}>
                            <TrendingUp size={32} />
                        </div>
                        <div>
                            <div className="text-sm font-black text-slate-400 uppercase tracking-widest">Indicador Técnico (RSI) Ponderado</div>
                            <div className="text-3xl font-black text-slate-800 mt-1">{newsData.aggregate.label}</div>
                            <div className="text-xs font-bold text-slate-400 mt-1">
                                Puntuación Global: <span className="text-slate-700">{newsData.aggregate.score}/100</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right hidden md:block">
                        <div className="text-xs font-bold text-slate-400">Noticias analizadas</div>
                        <div className="text-2xl font-black text-slate-800">{allNews.length}</div>
                    </div>
                </GlassCard>
            )}

            {/* News Grid (Masonry-like) */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>
            ) : allNews.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-bold">No hay noticias recientes para tus activos.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allNews.map((item, idx) => (
                        <GlassCard key={idx} className="flex flex-col hover:-translate-y-1 transition-transform duration-300 !p-0 overflow-hidden group h-full">
                            <div className="h-40 bg-slate-100 relative overflow-hidden">
                                {/* Placeholder Image Pattern */}
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-slate-200" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                    <Globe size={80} />
                                </div>
                                <div className="absolute bottom-4 left-4">
                                    <span className="bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                        {item.ticker}
                                    </span>
                                </div>
                            </div>

                            <div className="p-6 flex flex-col flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-2 h-2 rounded-full ${getBadge(item.sentiment?.color).split(' ')[0].replace('bg-', 'bg-')}`} />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{item.publisher}</span>
                                    <span className="text-[10px] text-slate-300">•</span>
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                        <Calendar size={10} /> {new Date(item.time).toLocaleDateString() !== 'Invalid Date' ? new Date(item.time).toLocaleDateString() : 'Reciente'}
                                    </span>
                                </div>

                                <h3 className="text-sm font-bold text-slate-800 leading-relaxed mb-4 line-clamp-3 group-hover:text-indigo-600 transition-colors">
                                    {item.title}
                                </h3>

                                <div className="mt-auto pt-4 border-t border-slate-50">
                                    <a
                                        href={item.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between text-xs font-black text-indigo-500 hover:text-indigo-700 transition-colors"
                                    >
                                        LEER ARTÍCULO <ExternalLink size={14} />
                                    </a>
                                </div>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </motion.div>
    );
};