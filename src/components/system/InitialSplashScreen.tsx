
import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export const InitialSplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden">
      {/* Background gradients for premium feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse decoration-delay-1000" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative flex flex-col items-center"
      >
        <div className="w-24 h-24 mb-8 relative">
          <motion.div 
            animate={{ 
              rotate: 360,
              borderRadius: ["25%", "50%", "25%"] 
            }}
            transition={{ 
              rotate: { duration: 4, repeat: Infinity, ease: "linear" },
              borderRadius: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-[0_0_40px_rgba(79,70,229,0.3)]"
          />
          <div className="absolute inset-2 bg-slate-900 rounded-lg flex items-center justify-center border border-white/5">
            <span className="text-3xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
              F
            </span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-xl font-semibold tracking-tight text-slate-100 mb-1">
            Projeto Flaito
          </h2>
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm font-medium">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Sincronizando ambiente...</span>
          </div>
        </motion.div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-12 left-0 right-0 text-center"
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
          Decision Intelligence Platform
        </p>
      </motion.div>
    </div>
  );
};
