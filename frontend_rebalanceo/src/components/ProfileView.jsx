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
                    <div className="p-4 bg-indigo-50 rounded-full text-indigo-600"><UserCircle size={32}/></div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Editar Perfil</h2>
                        <p className="text-sm font-bold text-slate-400">Gestiona tu información personal</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre</label>
                            <input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl font-bold text-slate-700 outline-none border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Apellidos</label>
                            <input value={surname} onChange={e=>setSurname(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl font-bold text-slate-700 outline-none border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"/>
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Email</label>
                        <div className="w-full bg-slate-50 p-4 rounded-xl font-bold text-slate-500 cursor-not-allowed border-2 border-slate-100">{session?.user?.email}</div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nueva Contraseña (Opcional)</label>
                        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Dejar vacío para mantener la actual" className="w-full bg-slate-50 p-4 rounded-xl font-bold text-slate-700 outline-none border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"/>
                    </div>

                    <BounceButton onClick={handleUpdate} disabled={loading} className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:shadow-indigo-200 mt-4">
                        {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Guardar Cambios'}
                    </BounceButton>
                </div>
            </GlassCard>
        </motion.div>
    )
}