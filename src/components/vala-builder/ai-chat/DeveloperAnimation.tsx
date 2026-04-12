import { motion } from 'framer-motion';

// Cartoon developer animation v3 - Enhanced MaxMotion style with realistic details
export function DeveloperAnimation() {
  return (
    <div className="relative w-full h-80 md:h-96 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#1e293b] border border-primary/20 shadow-2xl shadow-primary/10">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-blue-500/15 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Main Scene */}
      <div className="absolute inset-0 flex items-end justify-center pb-6">
        <div className="relative scale-[0.85] md:scale-100">
          
          {/* Floor/Desk Surface */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[340px] h-3 bg-gradient-to-b from-[#5a4a3a] to-[#3d3328] rounded-lg shadow-xl" />
          
          {/* Desk Legs */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex justify-between w-[300px]">
            <div className="w-4 h-8 bg-gradient-to-b from-[#4a3f32] to-[#2d2620] rounded-b-md -translate-y-[-3px]" />
            <div className="w-4 h-8 bg-gradient-to-b from-[#4a3f32] to-[#2d2620] rounded-b-md -translate-y-[-3px]" />
          </div>

          {/* Desk Top Surface */}
          <motion.div 
            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[320px] h-5 bg-gradient-to-b from-[#6b5a48] via-[#5a4a3a] to-[#4a3d30] rounded-lg shadow-lg border-t border-[#8a7560]/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          />

          {/* Office Chair */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {/* Chair Back */}
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-24 h-28 bg-gradient-to-b from-[#1a1a2e] to-[#16162a] rounded-t-2xl rounded-b-lg border-2 border-[#2a2a4a] shadow-lg">
              {/* Chair back cushion lines */}
              <div className="absolute top-4 left-3 right-3 space-y-3">
                <div className="h-1 bg-[#2a2a4a] rounded-full" />
                <div className="h-1 bg-[#2a2a4a] rounded-full" />
                <div className="h-1 bg-[#2a2a4a] rounded-full" />
              </div>
            </div>
            
            {/* Chair Seat */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-28 h-6 bg-gradient-to-b from-[#1a1a2e] to-[#12121f] rounded-lg border border-[#2a2a4a] shadow-md" />
            
            {/* Chair Stem */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-10 bg-gradient-to-b from-[#4a4a5a] to-[#3a3a4a] rounded-sm" />
            
            {/* Chair Base */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-20 h-2 bg-[#3a3a4a] rounded-full" />
            
            {/* Chair Wheels */}
            <div className="absolute top-11 left-1/2 -translate-x-1/2 flex justify-between w-24">
              <div className="w-4 h-4 bg-[#2a2a3a] rounded-full border border-[#3a3a4a] shadow-sm" />
              <div className="w-4 h-4 bg-[#2a2a3a] rounded-full border border-[#3a3a4a] shadow-sm" />
              <div className="w-4 h-4 bg-[#2a2a3a] rounded-full border border-[#3a3a4a] shadow-sm" />
            </div>
          </motion.div>

          {/* Monitor Stand */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-8 h-16 bg-gradient-to-b from-[#5a5a6a] to-[#3a3a4a] rounded-sm shadow-md" />
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-16 h-3 bg-gradient-to-b from-[#5a5a6a] to-[#4a4a5a] rounded-full shadow-sm" />

          {/* Monitor */}
          <motion.div
            className="relative w-56 h-40 md:w-72 md:h-48 rounded-xl bg-gradient-to-br from-[#3a4050] to-[#2a2f3e] border-[5px] border-[#4a5060] shadow-2xl mb-24"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Monitor bezel highlight */}
            <div className="absolute inset-0 rounded-lg border-t-2 border-l border-[#5a5a6a]/30" />
            
            {/* Screen */}
            <div className="absolute inset-1.5 rounded-lg bg-gradient-to-br from-[#1a2a40] to-[#0d1a2d] overflow-hidden">
              {/* IDE header bar */}
              <div className="h-5 bg-[#1e2d3d] flex items-center px-2 gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-[6px] text-gray-400 font-mono">main.tsx - SaaS VALA</span>
              </div>
              
              {/* Code lines */}
              <div className="p-2 space-y-1.5">
                {[
                  { w: '65%', color: 'bg-purple-400/80', indent: 0 },
                  { w: '50%', color: 'bg-cyan-400/80', indent: 8 },
                  { w: '75%', color: 'bg-green-400/70', indent: 8 },
                  { w: '40%', color: 'bg-yellow-400/70', indent: 16 },
                  { w: '60%', color: 'bg-pink-400/70', indent: 16 },
                  { w: '45%', color: 'bg-orange-400/70', indent: 8 },
                  { w: '55%', color: 'bg-blue-400/70', indent: 0 },
                ].map((line, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-2"
                    style={{ paddingLeft: line.indent }}
                  >
                    <span className="text-[6px] text-gray-500 font-mono w-3">{i + 1}</span>
                    <motion.div
                      className={`h-2 rounded-sm ${line.color}`}
                      style={{ width: 0 }}
                      animate={{ width: line.w }}
                      transition={{
                        delay: i * 0.12,
                        duration: 0.4,
                        repeat: Infinity,
                        repeatDelay: 4,
                      }}
                    />
                  </motion.div>
                ))}
              </div>
              
              {/* Screen glow effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-cyan-400/5" />
            </div>
            
            {/* Monitor logo */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-[#5a5a6a] rounded-full" />
          </motion.div>

          {/* Mechanical Keyboard */}
          <motion.div
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {/* Keyboard base */}
            <div className="w-36 h-12 bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] rounded-lg border border-[#3a3a4a] shadow-lg relative">
              {/* Keyboard top edge highlight */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4a4a5a] via-[#5a5a6a] to-[#4a4a5a] rounded-t-lg" />
              
              {/* Key rows */}
              <div className="absolute top-2 left-2 right-2 space-y-1.5">
                {/* Row 1 */}
                <div className="flex gap-0.5 justify-center">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={`r1-${i}`}
                      className="w-2.5 h-2.5 bg-gradient-to-b from-[#4a4a5a] to-[#3a3a4a] rounded-[2px] border-b border-[#2a2a3a]"
                      animate={{
                        y: i === 3 || i === 7 ? [0, -1, 0] : 0,
                        backgroundColor: i === 3 || i === 7 ? ['#4a4a5a', '#6a6a7a', '#4a4a5a'] : '#4a4a5a',
                      }}
                      transition={{
                        duration: 0.1,
                        delay: i * 0.08,
                        repeat: Infinity,
                        repeatDelay: 0.8 + (i % 3) * 0.2,
                      }}
                    />
                  ))}
                </div>
                {/* Row 2 */}
                <div className="flex gap-0.5 justify-center">
                  {[...Array(11)].map((_, i) => (
                    <motion.div
                      key={`r2-${i}`}
                      className="w-2.5 h-2.5 bg-gradient-to-b from-[#4a4a5a] to-[#3a3a4a] rounded-[2px] border-b border-[#2a2a3a]"
                      animate={{
                        y: i === 5 || i === 2 ? [0, -1, 0] : 0,
                      }}
                      transition={{
                        duration: 0.1,
                        delay: 0.2 + i * 0.06,
                        repeat: Infinity,
                        repeatDelay: 0.6 + (i % 4) * 0.15,
                      }}
                    />
                  ))}
                </div>
                {/* Row 3 - Spacebar row */}
                <div className="flex gap-0.5 justify-center items-center">
                  <div className="w-2 h-2 bg-gradient-to-b from-[#4a4a5a] to-[#3a3a4a] rounded-[2px]" />
                  <div className="w-2 h-2 bg-gradient-to-b from-[#4a4a5a] to-[#3a3a4a] rounded-[2px]" />
                  <motion.div 
                    className="w-12 h-2 bg-gradient-to-b from-[#4a4a5a] to-[#3a3a4a] rounded-[2px] border-b border-[#2a2a3a]"
                    animate={{ y: [0, -0.5, 0] }}
                    transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 1.5 }}
                  />
                  <div className="w-2 h-2 bg-gradient-to-b from-[#4a4a5a] to-[#3a3a4a] rounded-[2px]" />
                  <div className="w-2 h-2 bg-gradient-to-b from-[#4a4a5a] to-[#3a3a4a] rounded-[2px]" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Mouse */}
          <motion.div
            className="absolute bottom-10 right-16"
            animate={{ x: [0, 2, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-5 h-8 bg-gradient-to-b from-[#4a4a5a] to-[#2a2a3a] rounded-t-full rounded-b-lg border border-[#5a5a6a]/30">
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-3 bg-[#3a3a4a] rounded-full" />
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-[#6a6a7a] rounded-full" />
            </div>
          </motion.div>

          {/* Character - Developer */}
          <motion.div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {/* Body container with breathing animation */}
            <motion.div 
              className="relative"
              animate={{ y: [0, -1, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Torso */}
              <div className="w-20 h-24 bg-gradient-to-b from-[#3b82f6] to-[#2563eb] rounded-t-3xl rounded-b-xl mx-auto relative shadow-lg">
                {/* Shirt collar */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#1e40af]" />
                {/* Shirt pocket */}
                <div className="absolute top-8 left-3 w-6 h-5 border-2 border-[#2563eb] rounded-sm bg-[#3b82f6]/50">
                  <div className="absolute top-0.5 left-1 w-2 h-3 bg-[#fbbf24] rounded-t-sm" />
                </div>
              </div>

              {/* Arms */}
              <motion.div
                className="absolute top-8 -left-6 w-6 h-16 bg-gradient-to-b from-[#3b82f6] to-[#2563eb] rounded-full origin-top-right shadow-md"
                style={{ rotate: 25 }}
                animate={{ rotate: [25, 20, 25] }}
                transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 0.15 }}
              />
              <motion.div
                className="absolute top-8 -right-6 w-6 h-16 bg-gradient-to-b from-[#3b82f6] to-[#2563eb] rounded-full origin-top-left shadow-md"
                style={{ rotate: -25 }}
                animate={{ rotate: [-25, -20, -25] }}
                transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 0.2, delay: 0.1 }}
              />

              {/* Hands with fingers */}
              <motion.div
                className="absolute top-[85px] -left-8 flex flex-col items-center"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 0.1 }}
              >
                {/* Palm */}
                <div className="w-7 h-5 bg-gradient-to-b from-[#fcd9b6] to-[#f5c49c] rounded-lg shadow-sm relative">
                  {/* Thumb */}
                  <div className="absolute -left-1 top-0 w-2.5 h-4 bg-gradient-to-b from-[#fcd9b6] to-[#f5c49c] rounded-full" />
                  {/* Fingers */}
                  <div className="absolute -bottom-3 left-0.5 flex gap-0.5">
                    <div className="w-1.5 h-4 bg-gradient-to-b from-[#f5c49c] to-[#e8b48c] rounded-b-full" />
                    <div className="w-1.5 h-4.5 bg-gradient-to-b from-[#f5c49c] to-[#e8b48c] rounded-b-full" />
                    <div className="w-1.5 h-4 bg-gradient-to-b from-[#f5c49c] to-[#e8b48c] rounded-b-full" />
                    <div className="w-1.5 h-3.5 bg-gradient-to-b from-[#f5c49c] to-[#e8b48c] rounded-b-full" />
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                className="absolute top-[85px] -right-8 flex flex-col items-center"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 0.15, delay: 0.1 }}
              >
                {/* Palm */}
                <div className="w-7 h-5 bg-gradient-to-b from-[#fcd9b6] to-[#f5c49c] rounded-lg shadow-sm relative">
                  {/* Thumb */}
                  <div className="absolute -right-1 top-0 w-2.5 h-4 bg-gradient-to-b from-[#fcd9b6] to-[#f5c49c] rounded-full" />
                  {/* Fingers */}
                  <div className="absolute -bottom-3 left-0.5 flex gap-0.5">
                    <div className="w-1.5 h-3.5 bg-gradient-to-b from-[#f5c49c] to-[#e8b48c] rounded-b-full" />
                    <div className="w-1.5 h-4 bg-gradient-to-b from-[#f5c49c] to-[#e8b48c] rounded-b-full" />
                    <div className="w-1.5 h-4.5 bg-gradient-to-b from-[#f5c49c] to-[#e8b48c] rounded-b-full" />
                    <div className="w-1.5 h-4 bg-gradient-to-b from-[#f5c49c] to-[#e8b48c] rounded-b-full" />
                  </div>
                </div>
              </motion.div>

              {/* Head */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2">
                {/* Neck */}
                <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-6 h-4 bg-gradient-to-b from-[#fcd9b6] to-[#f5c49c] rounded-b-lg" />
                
                {/* Face */}
                <motion.div 
                  className="w-16 h-18 bg-gradient-to-b from-[#fcd9b6] to-[#f5c49c] rounded-[2rem] relative shadow-lg"
                  animate={{ rotate: [-0.5, 0.5, -0.5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Hair */}
                  <div className="absolute -top-2 left-0 right-0 h-10 bg-gradient-to-b from-[#1a1a2e] to-[#2a2a3e] rounded-t-[2rem] overflow-hidden">
                    {/* Hair strands */}
                    <div className="absolute top-1 left-2 w-3 h-6 bg-[#0f0f1a] rounded-full rotate-[-15deg]" />
                    <div className="absolute top-0 left-5 w-3 h-7 bg-[#0f0f1a] rounded-full" />
                    <div className="absolute top-0 right-5 w-3 h-7 bg-[#0f0f1a] rounded-full" />
                    <div className="absolute top-1 right-2 w-3 h-6 bg-[#0f0f1a] rounded-full rotate-[15deg]" />
                  </div>
                  
                  {/* Ears */}
                  <div className="absolute top-7 -left-2 w-3 h-4 bg-gradient-to-l from-[#f5c49c] to-[#e8b48c] rounded-full" />
                  <div className="absolute top-7 -right-2 w-3 h-4 bg-gradient-to-r from-[#f5c49c] to-[#e8b48c] rounded-full" />
                  
                  {/* Glasses */}
                  <div className="absolute top-8 left-1 right-1 flex justify-center items-center gap-1">
                    <motion.div 
                      className="w-6 h-5 border-[2.5px] border-[#374151] rounded-md bg-[#e0f2fe]/20 shadow-sm"
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    >
                      {/* Lens reflection */}
                      <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-white/40 rounded-full" />
                    </motion.div>
                    {/* Bridge */}
                    <div className="w-2 h-1 bg-[#374151] rounded-full" />
                    <motion.div 
                      className="w-6 h-5 border-[2.5px] border-[#374151] rounded-md bg-[#e0f2fe]/20 shadow-sm"
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    >
                      {/* Lens reflection */}
                      <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-white/40 rounded-full" />
                    </motion.div>
                  </div>
                  {/* Glass arms */}
                  <div className="absolute top-9 -left-1.5 w-3 h-0.5 bg-[#374151]" />
                  <div className="absolute top-9 -right-1.5 w-3 h-0.5 bg-[#374151]" />
                  
                  {/* Eyes */}
                  <div className="absolute top-9 left-3.5 flex gap-[18px]">
                    <motion.div 
                      className="w-2.5 h-2.5 bg-[#1a1a2e] rounded-full relative"
                      animate={{ scaleY: [1, 0.15, 1] }}
                      transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 3 }}
                    >
                      {/* Eye highlight */}
                      <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white rounded-full" />
                    </motion.div>
                    <motion.div 
                      className="w-2.5 h-2.5 bg-[#1a1a2e] rounded-full relative"
                      animate={{ scaleY: [1, 0.15, 1] }}
                      transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 3 }}
                    >
                      {/* Eye highlight */}
                      <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white rounded-full" />
                    </motion.div>
                  </div>
                  
                  {/* Nose */}
                  <div className="absolute top-[52px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#e8b48c] rounded-full" />
                  
                  {/* Mouth */}
                  <motion.div 
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 w-5 h-2.5 border-b-[2.5px] border-[#d97706] rounded-b-full"
                    animate={{ scaleX: [1, 1.15, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  />
                  
                  {/* Cheeks */}
                  <div className="absolute bottom-5 left-1 w-3 h-2 bg-[#fca5a5]/30 rounded-full" />
                  <div className="absolute bottom-5 right-1 w-3 h-2 bg-[#fca5a5]/30 rounded-full" />
                </motion.div>
              </div>
            </motion.div>
          </motion.div>

          {/* Coffee Cup with steam */}
          <motion.div
            className="absolute bottom-10 left-16"
            animate={{ y: [0, -1, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.8 }}
          >
            <div className="w-6 h-7 bg-gradient-to-b from-[#f5f5f5] to-[#d4d4d4] rounded-b-lg rounded-t-sm relative shadow-md">
              {/* Cup handle */}
              <div className="absolute -right-2 top-1 w-3 h-4 border-[2.5px] border-[#d4d4d4] rounded-r-full bg-transparent" />
              {/* Coffee inside */}
              <div className="absolute top-1 left-0.5 right-0.5 h-2 bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] rounded-t-sm" />
              {/* Steam */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute -top-4 w-0.5 h-3 bg-white/20 rounded-full"
                  style={{ left: 6 + i * 4 }}
                  animate={{ 
                    opacity: [0, 0.5, 0], 
                    y: [0, -6, -12],
                    x: [0, i % 2 === 0 ? 2 : -2, 0]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    delay: i * 0.4 
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Status Text */}
      <motion.div
        className="absolute bottom-3 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <motion.div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-sm"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          <motion.span
            className="text-base"
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            👨‍💻
          </motion.span>
          <span className="text-[10px] font-medium text-primary">Coding in progress...</span>
        </motion.div>
      </motion.div>

      {/* Floating Elements */}
      <motion.div
        className="absolute top-4 right-6 text-xl"
        animate={{ y: [0, -6, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        ✨
      </motion.div>
      <motion.div
        className="absolute top-8 left-6 text-lg"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
      >
        💻
      </motion.div>
      <motion.div
        className="absolute bottom-16 right-8 text-sm"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        ⚙️
      </motion.div>
      <motion.div
        className="absolute bottom-20 left-8 text-lg"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        🚀
      </motion.div>
    </div>
  );
}
