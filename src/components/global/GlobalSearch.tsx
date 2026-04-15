// Global Search Component - Search across all entities
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, Package, Key, Server, User, ShoppingBag, MessageSquare, FileText, Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { globalSearchService, SearchResult } from '@/services/global-search.service';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeIcons: Record<SearchResult['type'], React.ReactNode> = {
  product: <Package className="w-4 h-4" />,
  key: <Key className="w-4 h-4" />,
  server: <Server className="w-4 h-4" />,
  user: <User className="w-4 h-4" />,
  order: <ShoppingBag className="w-4 h-4" />,
  ticket: <MessageSquare className="w-4 h-4" />,
  apk: <FileText className="w-4 h-4" />,
};

const typeLabels: Record<SearchResult['type'], string> = {
  product: 'Product',
  key: 'Key',
  server: 'Server',
  user: 'User',
  order: 'Order',
  ticket: 'Ticket',
  apk: 'APK',
};

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    setHistory(globalSearchService.getHistory());
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter' && results.length > 0) {
        event.preventDefault();
        handleResultClick(results[selectedIndex]);
      } else if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (query.trim()) {
        setLoading(true);
        const searchResults = await globalSearchService.search(query);
        setResults(searchResults);
        setSelectedIndex(0);
        setLoading(false);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    globalSearchService.addToHistory(query);
    navigate(result.url);
    onClose();
    setQuery('');
    setResults([]);
  };

  const handleHistoryClick = (historyItem: string) => {
    setQuery(historyItem);
  };

  const clearHistory = () => {
    globalSearchService.clearHistory();
    setHistory([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-24 z-50 p-4">
      <div
        ref={searchRef}
        className="w-full max-w-3xl bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-700">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search products, keys, servers, users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <span className="text-xs text-slate-400">ESC</span>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : query.trim() ? (
            results.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No results found</h3>
                <p className="text-slate-400">Try adjusting your search terms</p>
              </div>
            ) : (
              <div className="p-2">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                      index === selectedIndex ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                    )}
                  >
                    <div className="p-2 rounded-lg bg-slate-800">
                      {typeIcons[result.type]}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{result.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                          {typeLabels[result.type]}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-1">{result.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : history.length > 0 ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-400">Recent Searches</h3>
                <button
                  onClick={clearHistory}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2">
                {history.map((historyItem, index) => (
                  <button
                    key={index}
                    onClick={() => handleHistoryClick(historyItem)}
                    className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
                  >
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">{historyItem}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Zap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Start typing to search</h3>
              <p className="text-sm text-slate-400">
                Search across products, keys, servers, users, and more
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">↑↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">↵</kbd>
              to select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">ESC</kbd>
              to close
            </span>
          </div>
          <span className="text-xs text-slate-500">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </span>
        </div>
      </div>
    </div>
  );
}
