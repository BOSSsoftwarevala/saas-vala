import { X, Hash } from 'lucide-react';

interface Props {
  messageId: string;
  onClose: () => void;
}

export function SupportThreadPanel({ messageId, onClose }: Props) {
  return (
    <div className="w-[340px] flex-shrink-0 border-l bg-white flex flex-col">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-gray-400" />
          <span className="font-bold text-[15px] text-gray-900">Thread</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thread content */}
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm px-4 text-center">
        <div>
          <p className="font-medium text-gray-500">Thread replies</p>
          <p className="text-xs mt-1">Threaded conversations coming soon</p>
        </div>
      </div>
    </div>
  );
}
