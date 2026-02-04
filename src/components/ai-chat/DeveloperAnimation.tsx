import { motion } from 'framer-motion';

export function DeveloperAnimation() {
  return (
    <div className="relative w-full h-80 md:h-96 overflow-hidden rounded-2xl bg-gradient-to-br from-[#2d3748] via-[#1a202c] to-[#2d3748]">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-10 w-32 h-32 bg-primary/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl" />
      </div>

      {/* Main Scene */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative scale-90 md:scale-100">
          
          {/* Desk */}
          <motion.div 
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-4 bg-gradient-to-b from-[#4a5568] to-[#2d3748] rounded-lg shadow-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          />
          
          {/* Monitor Stand */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-6 h-12 bg-gradient-to-b from-[#4a5568] to-[#2d3748] rounded-sm" />
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-14 h-2 bg-[#4a5568] rounded-full" />

          {/* Monitor */}
          <motion.div
            className="relative w-52 h-36 md:w-64 md:h-44 rounded-xl bg-gradient-to-br from-[#3a4050] to-[#2a2f3e] border-4 border-[#4a5568] shadow-2xl mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Screen */}
            <div className="absolute inset-2 rounded-lg bg-[#1e3a5f] overflow-hidden">
              {/* Code on screen */}
              <div className="p-3 space-y-1.5">
                {[
                  { w: '70%', color: 'bg-cyan-400/70' },
                  { w: '55%', color: 'bg-green-400/70' },
                  { w: '80%', color: 'bg-purple-400/70' },
                  { w: '45%', color: 'bg-yellow-400/70' },
                  { w: '65%', color: 'bg-pink-400/70' },
                  { w: '50%', color: 'bg-orange-400/70' },
                ].map((line, i) => (
                  <motion.div
                    key={i}
                    className={`h-2 rounded-sm ${line.color}`}
                    style={{ width: 0 }}
                    animate={{ width: line.w }}
                    transition={{
                      delay: i * 0.15,
                      duration: 0.5,
                      repeat: Infinity,
                      repeatDelay: 3,
                    }}
                  />
                ))}
              </div>
              {/* Screen glow */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-cyan-400/10" />
            </div>
          </motion.div>

          {/* Character */}
          <motion.div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {/* Chair */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-14 bg-[#f6ad55] rounded-t-xl rounded-b-lg" />
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-2 h-6 bg-[#4a5568]" />
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-6">
              <div className="w-3 h-3 bg-[#4a5568] rounded-full" />
              <div className="w-3 h-3 bg-[#4a5568] rounded-full" />
            </div>

            {/* Body */}
            <motion.div 
              className="relative -top-14"
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Torso */}
              <div className="w-16 h-20 bg-[#4299e1] rounded-t-2xl rounded-b-lg mx-auto relative">
                {/* Collar */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-3 bg-[#3182ce] rounded-b-full" />
              </div>

              {/* Arms */}
              <motion.div
                className="absolute top-6 -left-8 w-10 h-4 bg-[#4299e1] rounded-full origin-right"
                animate={{ rotate: [0, 5, 0] }}
                transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 0.2 }}
              />
              <motion.div
                className="absolute top-6 -right-8 w-10 h-4 bg-[#4299e1] rounded-full origin-left"
                animate={{ rotate: [0, -5, 0] }}
                transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 0.3, delay: 0.15 }}
              />

              {/* Hands on keyboard */}
              <motion.div
                className="absolute top-9 -left-10 w-5 h-5 bg-[#fbd38d] rounded-full"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 0.1 }}
              />
              <motion.div
                className="absolute top-9 -right-10 w-5 h-5 bg-[#fbd38d] rounded-full"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 0.15, delay: 0.1 }}
              />

              {/* Head */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                {/* Face */}
                <motion.div 
                  className="w-14 h-16 bg-[#fbd38d] rounded-2xl relative"
                  animate={{ rotate: [-1, 1, -1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Hair */}
                  <div className="absolute -top-3 left-0 right-0 h-8 bg-[#2d3748] rounded-t-2xl" />
                  <div className="absolute -top-1 -left-1 w-4 h-6 bg-[#2d3748] rounded-full" />
                  <div className="absolute -top-1 -right-1 w-4 h-6 bg-[#2d3748] rounded-full" />
                  
                  {/* Glasses */}
                  <div className="absolute top-5 left-1 right-1 flex justify-center gap-1">
                    <motion.div 
                      className="w-5 h-4 border-2 border-[#e2e8f0] rounded-md bg-[#e2e8f0]/10"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <div className="w-1 h-0.5 bg-[#e2e8f0] self-center" />
                    <motion.div 
                      className="w-5 h-4 border-2 border-[#e2e8f0] rounded-md bg-[#e2e8f0]/10"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  
                  {/* Eyes behind glasses */}
                  <div className="absolute top-6 left-3 flex gap-3">
                    <motion.div 
                      className="w-2 h-2 bg-[#2d3748] rounded-full"
                      animate={{ scaleY: [1, 0.1, 1] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    />
                    <motion.div 
                      className="w-2 h-2 bg-[#2d3748] rounded-full"
                      animate={{ scaleY: [1, 0.1, 1] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    />
                  </div>
                  
                  {/* Smile */}
                  <motion.div 
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-2 border-b-2 border-[#c05621] rounded-b-full"
                    animate={{ scaleX: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>
              </div>
            </motion.div>
          </motion.div>

          {/* Keyboard */}
          <motion.div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 translate-y-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="w-28 h-6 bg-gradient-to-b from-[#4a5568] to-[#2d3748] rounded-lg flex items-center justify-center gap-0.5 px-1">
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-3 bg-[#718096] rounded-sm"
                  animate={{
                    y: i % 3 === 0 ? [0, -2, 0] : 0,
                    backgroundColor: i % 3 === 0 ? ['#718096', '#a0aec0', '#718096'] : '#718096',
                  }}
                  transition={{
                    duration: 0.1,
                    delay: i * 0.05,
                    repeat: Infinity,
                    repeatDelay: 0.3 + (i % 4) * 0.1,
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Coffee Cup */}
          <motion.div
            className="absolute bottom-7 right-8"
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: 1 }}
          >
            <div className="w-5 h-6 bg-[#e2e8f0] rounded-b-lg rounded-t-sm relative">
              <div className="absolute -right-1.5 top-1 w-2 h-3 border-2 border-[#e2e8f0] rounded-r-full" />
              {/* Steam */}
              <motion.div
                className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-white/30 rounded-full"
                animate={{ opacity: [0, 0.5, 0], y: [0, -5, -10] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Status Text */}
      <motion.div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <motion.div
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-sm"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.span
            className="text-lg"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }}
          >
            👨‍💻
          </motion.span>
          <span className="text-xs font-medium text-primary">Coding in progress...</span>
        </motion.div>
      </motion.div>

      {/* Floating Elements */}
      <motion.div
        className="absolute top-6 right-8 text-2xl"
        animate={{ y: [0, -8, 0], rotate: [0, 10, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        ✨
      </motion.div>
      <motion.div
        className="absolute top-12 left-8 text-xl"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      >
        💻
      </motion.div>
      <motion.div
        className="absolute bottom-20 right-12 text-lg"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        ⚙️
      </motion.div>
      <motion.div
        className="absolute bottom-24 left-10 text-xl"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        🚀
      </motion.div>
    </div>
  );
}
