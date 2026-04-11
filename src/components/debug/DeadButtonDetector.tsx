import { useEffect, useState } from 'react';

export function DeadButtonDetector() {
  const [deadButtons, setDeadButtons] = useState<string[]>([]);
  
  useEffect(() => {
    // Find all buttons without onClick handlers
    const buttons = document.querySelectorAll('button');
    const dead: string[] = [];
    
    buttons.forEach((button, index) => {
      const hasOnClick = button.hasAttribute('onclick');
      const text = button.textContent?.trim() || `Button ${index}`;
      
      if (!hasOnClick && !button.disabled) {
        dead.push(text);
      }
    });
    
    if (dead.length > 0) {
      console.log('🚨 DEAD BUTTONS FOUND:', dead);
      setDeadButtons(dead);
    }
  }, []);
  
  if (deadButtons.length === 0) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'red',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <div>🚨 {deadButtons.length} Dead Buttons Found</div>
      <ul style={{margin: '5px 0', paddingLeft: '20px'}}>
        {deadButtons.slice(0, 5).map((btn, i) => (
          <li key={i}>{btn}</li>
        ))}
        {deadButtons.length > 5 && <li>...and {deadButtons.length - 5} more</li>}
      </ul>
    </div>
  );
}
