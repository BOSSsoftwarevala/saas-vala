import { Upload, Server, Wrench, Zap, Shield, Code, LayoutDashboard, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

const item: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24
    }
  }
};

const floatingAnimation = {
  y: [-8, 8, -8],
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: "easeInOut" as const
  }
};

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  const navigate = useNavigate();
  
  const capabilities = [
    {
      icon: Upload,
      title: 'Unlimited Upload',
      description: 'Any size ZIP, PHP, JS projects',
      gradient: 'from-primary to-orange-400'
    },
    {
      icon: Wrench,
      title: 'Auto Fix',
      description: 'AI-powered code analysis & repair',
      gradient: 'from-secondary to-cyan-400'
    },
    {
      icon: Server,
      title: 'One-Click Deploy',
      description: 'Deploy without a developer',
      gradient: 'from-purple-500 to-accent'
    },
    {
      icon: Zap,
      title: 'Addon Integration',
      description: 'Payments, wallets, language packs',
      gradient: 'from-yellow-500 to-orange-500'
    },
    {
      icon: Shield,
      title: 'Security Scan',
      description: 'Malware & backdoor detection',
      gradient: 'from-green-500 to-emerald-400'
    },
    {
      icon: Code,
      title: 'Smart Upgrade',
      description: 'Modernize legacy code safely',
      gradient: 'from-pink-500 to-rose-400'
    }
  ];

  const suggestions = [
    { text: 'Help me upload and analyze my PHP project', icon: Upload },
    { text: 'Deploy my application to a client server', icon: Server },
    { text: 'Scan my source code for security issues', icon: Shield },
    { text: 'Add payment integration to my SaaS app', icon: Zap }
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 min-h-[calc(100vh-8rem)] overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/3 rounded-full blur-3xl" />
      </div>

      {/* Logo & Title */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10 text-center relative z-10"
      >
        <motion.div
          animate={floatingAnimation}
          className="relative inline-block"
        >
          <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20 rounded-3xl blur-xl opacity-60" />
          <img 
            src={saasValaLogo} 
            alt="SaaS VALA" 
            className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover mx-auto border-2 border-primary/30 shadow-2xl shadow-primary/20"
          />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 400 }}
            className="absolute -bottom-2 -right-2 bg-gradient-to-br from-primary to-orange-400 rounded-full p-2 shadow-lg"
          >
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </motion.div>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-3xl md:text-4xl font-display font-bold mt-6 mb-2"
        >
          <span className="text-gradient-primary">SaaS VALA</span>{' '}
          <span className="text-foreground">AI</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground text-lg md:text-xl font-medium"
        >
          Internal Power Version
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-3 mt-4"
        >
          <span className="text-sm text-muted-foreground px-3 py-1.5 rounded-full bg-muted/50 border border-border">
            Better than Lovable
          </span>
          <span className="text-sm text-muted-foreground px-3 py-1.5 rounded-full bg-muted/50 border border-border">
            No File Limits
          </span>
          <span className="text-sm text-muted-foreground px-3 py-1.5 rounded-full bg-muted/50 border border-border hidden sm:block">
            No Developer Required
          </span>
        </motion.div>
      </motion.div>

      {/* Capabilities Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-w-3xl mb-10 relative z-10"
      >
        {capabilities.map((cap, index) => (
          <motion.div
            key={index}
            variants={item}
            whileHover={{ 
              scale: 1.03,
              transition: { type: "spring", stiffness: 400, damping: 25 }
            }}
            className="group p-4 md:p-5 rounded-2xl bg-card/50 border border-border hover:border-primary/40 transition-all duration-300 cursor-pointer relative overflow-hidden"
          >
            {/* Hover gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${cap.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
            
            <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${cap.gradient} mb-3 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
              <cap.icon className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
              {cap.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {cap.description}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Suggestions */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-2xl relative z-10"
      >
        <p className="text-sm text-muted-foreground mb-4 text-center font-medium flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Try asking
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSuggestionClick(suggestion.text)}
              className="group flex items-center gap-3 p-4 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border hover:border-primary/40 text-left transition-all duration-300"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors">
                <suggestion.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-foreground group-hover:text-primary transition-colors flex-1">
                {suggestion.text}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" />
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Dashboard Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Button 
          variant="outline" 
          onClick={() => navigate('/saas-ai-dashboard')}
          className="mt-8 gap-2 group hover:border-primary/50 hover:bg-primary/5"
        >
          <LayoutDashboard className="h-4 w-4 group-hover:text-primary transition-colors" />
          <span className="group-hover:text-primary transition-colors">Open Project Dashboard</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </motion.div>

      {/* Footer */}
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-8 text-xs text-muted-foreground"
      >
        Powered by <span className="font-semibold text-gradient-primary">SoftwareVala™</span>
      </motion.p>
    </div>
  );
}
