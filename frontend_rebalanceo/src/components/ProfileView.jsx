import React, { useState } from 'react';
import { Loader2, UserCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { GlassCard, BounceButton, fadeInUp } from './UI';
import { motion } from 'framer-motion';

export const ProfileView = ({ session, onUpdateUser }) => {
    const [name, setName] = useState(session?.user?.user_metadata?.first_name || '');
    const [surname, setSurname] = useState(session?.user?.user_metadata?.last_name || '');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdate = async () => {
        setLoading(true);
        try {
            const updates = { data: { first_name: name, last_name: surname } };
            if (password) updates.password = password;
            const { data, error } = await supabase.auth.updateUser(updates);
            if (error) throw error;
            onUpdateUser(data.user);
            alert("Perfil actualizado correctamente");
            setPassword('');
        } catch (error) { alert("Error: " + error.message) }
        finally { setLoading(false) }
    }

    return (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="max-w-2xl mx-auto">
            <GlassCard className="!p-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-brand-soft rounded-full text-brand"><UserCircle size={32}/></div>
                    <div>
                        <h2 className="text-title1 font-semibold text-ink">Editar Perfil</h2>
                        <p className="text-subhead font-bold text-ink-3">Gestiona tu información personal</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-caption2 font-semibold text-ink-3 block mb-2">Nombre</label>
                            <input value={name} onChange={e=>setName(e.target.value)} className="w-full h-12 px-3.5 bg-surface-2 rounded-field outline-none text-body text-ink placeholder:text-ink-3 focus:bg-surface-3 transition-colors"/>
                        </div>
                        <div>
                            <label className="text-caption2 font-semibold text-ink-3 block mb-2">Apellidos</label>
                            <input value={surname} onChange={e=>setSurname(e.target.value)} className="w-full h-12 px-3.5 bg-surface-2 rounded-field outline-none text-body text-ink placeholder:text-ink-3 focus:bg-surface-3 transition-colors"/>
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-caption2 font-semibold text-ink-3 block mb-2">Email</label>
                        <div className="w-full h-12 px-3.5 bg-surface-2 rounded-field outline-none text-body text-ink placeholder:text-ink-3 focus:bg-surface-3 transition-colors">{session?.user?.email}</div>
                    </div>

                    <div>
                        <label className="text-caption2 font-semibold text-ink-3 block mb-2">Nueva Contraseña (Opcional)</label>
                        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Dejar vacío para mantener la actual" className="w-full h-12 px-3.5 bg-surface-2 rounded-field outline-none text-body text-ink placeholder:text-ink-3 focus:bg-surface-3 transition-colors"/>
                    </div>

                    <BounceButton onClick={handleUpdate} disabled={loading} className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-control font-semibold uppercase text-footnote shadow-card hover: mt-4">
                        {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Guardar Cambios'}
                    </BounceButton>
                </div>
            </GlassCard>
        </motion.div>
    )
}