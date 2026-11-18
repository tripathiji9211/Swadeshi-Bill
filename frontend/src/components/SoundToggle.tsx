import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { tanpuraSynth } from '@/lib/audioSynth';

export const SoundToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [isMuted, setIsMuted] = useState(tanpuraSynth.getMuted());

  useEffect(() => {
    return tanpuraSynth.subscribe((muted) => setIsMuted(muted));
  }, []);

  const handleToggle = () => {
    tanpuraSynth.toggle();
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-[10.5px] font-mono tracking-[0.08em] transition-colors ${
        !isMuted ? 'text-[#FF9933] border-[#FF9933]/40' : 'text-[#656057] hover:text-[#A59E92]'
      } ${className}`}
      title={isMuted ? 'Turn on ambient tanpura drone' : 'Mute ambient audio'}
    >
      {!isMuted ? (
        <>
          <Volume2 className="w-3.5 h-3.5 text-[#FF9933] animate-pulse" />
          <span>SOUND: ON</span>
        </>
      ) : (
        <>
          <VolumeX className="w-3.5 h-3.5" />
          <span>SOUND: OFF</span>
        </>
      )}
    </button>
  );
};

export default SoundToggle;
