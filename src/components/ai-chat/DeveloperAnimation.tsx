import { motion } from 'framer-motion';
import { Code2, Terminal, Braces, FileCode, GitBranch, Cpu, Database, Cloud, Rocket, Sparkles } from 'lucide-react';

const codeLines = [
  { text: 'const deploy = async () => {', color: 'text-purple-400' },
  { text: '  await analyze(sourceCode);', color: 'text-blue-400' },
  { text: '  const fixes = autoFix(issues);', color: 'text-green-400' },
  { text: '  await upload(server);', color: 'text-orange-400' },
  { text: '  return { status: "live" };', color: 'text-pink-400' },
  { text: '};', color: 'text-purple-400' },
];

const floatingIcons = [
  { Icon: Code2, delay: 0, x: '10%', y: '20%' },
  { Icon: Terminal, delay: 0.5, x: '80%', y: '15%' },
  { Icon: Braces, delay: 1, x: '15%', y: '70%' },
  { Icon: FileCode, delay: 1.5, x: '85%', y: '60%' },
  { Icon: GitBranch, delay: 2, x: '50%', y: '10%' },
  { Icon: Database, delay: 2.5, x: '25%', y: '45%' },
  { Icon: Cloud, delay: 3, x: '75%', y: '40%' },
  { Icon: Cpu, delay: 3.5, x: '60%', y: '75%' },
];

export function DeveloperAnimation() {
  return (
    <div className="relative w-full h-64 md:h-80 overflow-hidden rounded-2xl bg-gradient-to-br from-background via-muted/20 to-background border border-border/50">
      {/* Floating Icons */}
      {floatingIcons.map(({ Icon, delay, x, y }, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{ left: x, top: y }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0.1, 0.3, 0.1],
            scale: [0.8, 1.1, 0.8],
            y: [0, -10, 0],
          }}
          transition={{
            duration: 4,
            delay,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Icon className="h-6 w-6 md:h-8 md:w-8 text-primary/30" />
        </motion.div>
      ))}

      {/* Center Terminal Window */}
      <motion.div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md"
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Terminal Header */}
        <div className="bg-muted/80 backdrop-blur-xl rounded-t-xl px-4 py-2.5 flex items-center gap-2 border border-border/50 border-b-0">
          <div className="flex gap-1.5">
            <motion.div 
              className="w-3 h-3 rounded-full bg-red-500/80"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0 }}
            />
            <motion.div 
              className="w-3 h-3 rounded-full bg-yellow-500/80"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
            />
            <motion.div 
              className="w-3 h-3 rounded-full bg-green-500/80"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
            />
          </div>
          <div className="flex-1 flex items-center justify-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-mono">saas-vala-deploy.ts</span>
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <Cpu className="h-3.5 w-3.5 text-primary/50" />
          </motion.div>
        </div>

        {/* Terminal Body */}
        <div className="bg-[#0d1117]/90 backdrop-blur-xl rounded-b-xl p-4 border border-border/50 border-t-0 font-mono text-sm">
          {/* Code Lines with Typing Effect */}
          {codeLines.map((line, index) => (
            <motion.div
              key={index}
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                duration: 0.3, 
                delay: index * 0.4,
                repeat: Infinity,
                repeatDelay: codeLines.length * 0.4 + 2
              }}
            >
              <span className="text-muted-foreground/50 w-4 text-right text-xs">
                {index + 1}
              </span>
              <motion.span 
                className={`${line.color} text-xs md:text-sm`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ 
                  duration: 0.5, 
                  delay: index * 0.4 + 0.2,
                  repeat: Infinity,
                  repeatDelay: codeLines.length * 0.4 + 2
                }}
              >
                {line.text}
              </motion.span>
            </motion.div>
          ))}

          {/* Blinking Cursor */}
          <motion.div 
            className="flex items-center gap-2 mt-2"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <span className="text-muted-foreground/50 w-4 text-right text-xs">7</span>
            <span className="w-2 h-4 bg-primary/70 rounded-sm" />
          </motion.div>
        </div>

        {/* Status Bar */}
        <motion.div 
          className="mt-3 flex items-center justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <motion.div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div 
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-xs text-green-400 font-medium">Analyzing</span>
          </motion.div>
          
          <motion.div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
          >
            <Rocket className="h-3 w-3 text-primary" />
            <span className="text-xs text-primary font-medium">Auto Deploy</span>
          </motion.div>

          <motion.div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: 1 }}
          >
            <Sparkles className="h-3 w-3 text-purple-400" />
            <span className="text-xs text-purple-400 font-medium">AI Powered</span>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Animated Grid Background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `
          linear-gradient(to right, hsl(var(--primary)) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--primary)) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }} />

      {/* Glow Effects */}
      <motion.div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/5 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
    </div>
  );
}
