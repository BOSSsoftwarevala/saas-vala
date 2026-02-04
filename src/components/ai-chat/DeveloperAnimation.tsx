import { motion } from 'framer-motion';

export function DeveloperAnimation() {
  return (
    <div className="relative w-full h-72 md:h-80 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1f2e] via-[#0f1419] to-[#1a1f2e] border border-primary/20">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `
          linear-gradient(to right, hsl(var(--primary)) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--primary)) 1px, transparent 1px)
        `,
        backgroundSize: '30px 30px'
      }} />

      {/* Floating Code Particles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-primary/20 font-mono text-xs select-none"
          style={{
            left: `${10 + (i * 12)}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.1, 0.4, 0.1],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.3,
          }}
        >
          {['{ }', '< />', '( )', '[ ]', '=> ', '# ', '$ ', '::'][i]}
        </motion.div>
      ))}

      {/* Main Scene Container */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Glow Effect Behind Character */}
        <motion.div
          className="absolute w-48 h-48 rounded-full bg-primary/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Developer Character */}
        <div className="relative">
          {/* Monitor/Screen */}
          <motion.div
            className="relative w-64 md:w-80 h-40 md:h-48 rounded-xl bg-gradient-to-br from-[#2a2f3e] to-[#1a1f2e] border-2 border-[#3a4050] shadow-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Screen Bezel */}
            <div className="absolute inset-2 rounded-lg bg-[#0d1117] overflow-hidden">
              {/* Terminal Header */}
              <div className="h-6 bg-[#1a1f2e] flex items-center px-2 gap-1.5">
                <motion.div 
                  className="w-2.5 h-2.5 rounded-full bg-red-500"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div 
                  className="w-2.5 h-2.5 rounded-full bg-yellow-500"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div 
                  className="w-2.5 h-2.5 rounded-full bg-green-500"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
                />
                <span className="ml-2 text-[8px] text-muted-foreground/50 font-mono">saas-vala-deploy.ts</span>
              </div>

              {/* Code Lines */}
              <div className="p-2 space-y-1">
                {[
                  { width: '70%', color: 'bg-purple-400/60', delay: 0 },
                  { width: '85%', color: 'bg-blue-400/60', delay: 0.3 },
                  { width: '60%', color: 'bg-green-400/60', delay: 0.6 },
                  { width: '75%', color: 'bg-orange-400/60', delay: 0.9 },
                  { width: '50%', color: 'bg-pink-400/60', delay: 1.2 },
                  { width: '65%', color: 'bg-cyan-400/60', delay: 1.5 },
                ].map((line, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: line.delay, duration: 0.3 }}
                  >
                    <span className="text-[8px] text-muted-foreground/30 w-3 font-mono">{i + 1}</span>
                    <motion.div
                      className={`h-2 rounded-sm ${line.color}`}
                      style={{ width: 0 }}
                      animate={{ width: line.width }}
                      transition={{ 
                        delay: line.delay + 0.2, 
                        duration: 0.8,
                        repeat: Infinity,
                        repeatDelay: 4,
                      }}
                    />
                  </motion.div>
                ))}
                
                {/* Blinking Cursor */}
                <motion.div 
                  className="flex items-center gap-2 mt-1"
                >
                  <span className="text-[8px] text-muted-foreground/30 w-3 font-mono">7</span>
                  <motion.div
                    className="w-1.5 h-3 bg-primary rounded-sm"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                </motion.div>
              </div>
            </div>

            {/* Screen Glow */}
            <motion.div 
              className="absolute inset-0 rounded-xl"
              style={{ boxShadow: '0 0 60px -20px hsl(var(--primary))' }}
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>

          {/* Keyboard */}
          <motion.div
            className="relative w-56 md:w-64 h-8 mx-auto -mt-1 rounded-b-lg bg-gradient-to-b from-[#3a4050] to-[#2a2f3e] border-x-2 border-b-2 border-[#3a4050]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {/* Key Rows */}
            <div className="absolute inset-1 flex gap-0.5 justify-center items-center">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-3 md:w-4 h-3 rounded-sm bg-[#4a5060] shadow-inner"
                  animate={{ 
                    y: i % 3 === 0 ? [0, -2, 0] : [0, 0, 0],
                    backgroundColor: i % 3 === 0 
                      ? ['#4a5060', '#6a70a0', '#4a5060']
                      : '#4a5060'
                  }}
                  transition={{ 
                    duration: 0.15,
                    delay: i * 0.08,
                    repeat: Infinity,
                    repeatDelay: 0.5 + (i % 4) * 0.1,
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Typing Hands (Simplified cute style) */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-8">
            {/* Left Hand */}
            <motion.div
              className="relative"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 0.2 }}
            >
              <div className="w-10 h-6 bg-gradient-to-b from-[#f5d0c5] to-[#e8b8a8] rounded-t-full rounded-b-lg shadow-lg" />
              <div className="absolute -top-1 left-1 flex gap-0.5">
                {[...Array(4)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-3 bg-gradient-to-b from-[#f5d0c5] to-[#e8b8a8] rounded-full"
                    animate={{ scaleY: i === 1 ? [1, 0.8, 1] : 1 }}
                    transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 0.3 }}
                  />
                ))}
              </div>
            </motion.div>

            {/* Right Hand */}
            <motion.div
              className="relative"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 0.35, delay: 0.15 }}
            >
              <div className="w-10 h-6 bg-gradient-to-b from-[#f5d0c5] to-[#e8b8a8] rounded-t-full rounded-b-lg shadow-lg" />
              <div className="absolute -top-1 left-1 flex gap-0.5">
                {[...Array(4)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-3 bg-gradient-to-b from-[#f5d0c5] to-[#e8b8a8] rounded-full"
                    animate={{ scaleY: i === 2 ? [1, 0.8, 1] : 1 }}
                    transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 0.4 }}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Status Badges */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <motion.div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 backdrop-blur-sm"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div 
            className="w-2 h-2 rounded-full bg-green-500"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-[10px] text-green-400 font-medium">Auto Deploying...</span>
        </motion.div>

        <motion.div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 backdrop-blur-sm"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <span className="text-[10px]">🚀</span>
          <span className="text-[10px] text-primary font-medium">SaaS VALA AI</span>
        </motion.div>
      </div>

      {/* Decorative Elements */}
      <motion.div
        className="absolute top-4 right-4 text-2xl"
        animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ✨
      </motion.div>
      <motion.div
        className="absolute top-8 left-6 text-xl"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      >
        💻
      </motion.div>
      <motion.div
        className="absolute bottom-12 right-8 text-xl"
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      >
        ⚙️
      </motion.div>
    </div>
  );
}
