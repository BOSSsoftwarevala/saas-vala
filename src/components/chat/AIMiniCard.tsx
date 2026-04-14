import { useState, useEffect } from 'react';
import { Mic, MessageCircle, Rocket, Wrench, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function AIMiniCard({ onOpenChat, onVoiceClick }: { onOpenChat: () => void; onVoiceClick: () => void }) {
  const [typingText, setTypingText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  
  const texts = ['AI is analyzing...', 'Auto reply ready...', 'System active...'];

  useEffect(() => {
    let charIndex = 0;
    let isDeleting = false;
    
    const type = () => {
      setTypingText(texts[textIndex].substring(0, charIndex));
      
      if (!isDeleting && charIndex < texts[textIndex].length) {
        charIndex++;
        setTimeout(type, 50);
      } else if (isDeleting && charIndex > 0) {
        charIndex--;
        setTimeout(type, 30);
      } else {
        isDeleting = !isDeleting;
        if (!isDeleting) {
          setTextIndex((prev) => (prev + 1) % texts.length);
          charIndex = 0;
        }
        setTimeout(type, isDeleting ? 500 : 2000);
      }
    };
    
    type();
  }, [textIndex]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed top-4 right-4 z-50"
    >
      <motion.div
        animate={{
          boxShadow: [
            '0 0 20px rgba(168, 85, 247, 0.3)',
            '0 0 40px rgba(168, 85, 247, 0.5)',
            '0 0 20px rgba(168, 85, 247, 0.3)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className="relative w-[280px] h-[160px] rounded-3xl overflow-hidden cursor-pointer"
        onClick={onOpenChat}
        style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(236, 72, 153, 0.15) 50%, rgba(59, 130, 246, 0.15) 100%)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Top Section */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">AI Live Assistant</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 w-2 h-2 rounded-full bg-green-400"
                />
              </div>
              <span className="text-xs text-green-300 font-medium">Active</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-300" />
          </div>
        </div>

        {/* Center - Typing Animation */}
        <div className="absolute top-12 left-4 right-12">
          <p className="text-xs text-purple-200/90 font-mono h-4">{typingText}</p>
        </div>

        {/* Bottom - 3 Buttons */}
        <div className="absolute bottom-4 left-4 right-12 flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10"
            onClick={(e) => { e.stopPropagation(); onOpenChat(); }}
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            Ask
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10"
            onClick={(e) => { e.stopPropagation(); onOpenChat(); }}
          >
            <Rocket className="w-3 h-3 mr-1" />
            Deploy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10"
            onClick={(e) => { e.stopPropagation(); onOpenChat(); }}
          >
            <Wrench className="w-3 h-3 mr-1" />
            Fix
          </Button>
        </div>

        {/* Right Side - Mic Icon */}
        <motion.button
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          onClick={(e) => { e.stopPropagation(); onVoiceClick(); }}
          className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Mic className="w-4 h-4 text-white" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
