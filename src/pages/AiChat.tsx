import React, { useState } from 'react';
import { InternalChat } from '@/components/InternalChat';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Search, 
  Users,
  Archive,
  Settings,
  Settings2,
  Mic,
  CheckCheck
} from 'lucide-react';

const AiChat: React.FC = () => {
  const [activeView, setActiveView] = useState<'chat' | 'dashboard'>('dashboard');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);

  // Mock chat data for dashboard
  const mockChats = [
    {
      id: '1',
      name: 'Team Development',
      avatar: null,
      lastMessage: 'Server deployment complete ✅',
      time: '2:30 PM',
      unread: 3,
      online: true,
      isGroup: true
    },
    {
      id: '2', 
      name: 'Alex Johnson',
      avatar: null,
      lastMessage: 'API integration working',
      time: '1:45 PM',
      unread: 0,
      online: true,
      isGroup: false
    },
    {
      id: '3',
      name: 'Project Updates',
      avatar: null,
      lastMessage: 'New features deployed',
      time: '12:20 PM',
      unread: 5,
      online: false,
      isGroup: true
    },
    {
      id: '4',
      name: 'Sarah Wilson',
      avatar: null,
      lastMessage: 'Thanks for the help!',
      time: '11:30 AM',
      unread: 0,
      online: false,
      isGroup: false
    }
  ];

  const renderDashboard = () => (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Chat List */}
      <div className="w-80 border-r flex flex-col bg-gray-50">
        {/* Header */}
        <div className="p-4 bg-green-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">Internal Chat</h1>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-green-700">
                <Users className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-green-700">
                <Settings2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-200 w-4 h-4" />
            <input
              type="text"
              placeholder="Search chats..."
              className="w-full pl-10 pr-4 py-2 bg-green-700 text-white placeholder-green-200 rounded-lg outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          {mockChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                setSelectedChat(chat.id);
                setActiveView('chat');
              }}
              className="flex items-center p-4 hover:bg-gray-100 cursor-pointer border-b border-gray-200 transition-colors"
            >
              <div className="relative">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className={chat.isGroup ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}>
                    {chat.isGroup ? (
                      <Users className="w-6 h-6" />
                    ) : (
                      chat.name.split(' ').map(n => n[0]).join('')
                    )}
                  </AvatarFallback>
                </Avatar>
                {chat.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              
              <div className="flex-1 min-w-0 ml-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {chat.name}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {chat.time}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate">
                    {chat.lastMessage}
                  </p>
                  {chat.unread > 0 && (
                    <Badge className="bg-green-600 text-white text-xs ml-2">
                      {chat.unread}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-around">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-green-600">
              <Archive className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-green-600">
              <Settings className="w-5 h-5" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setActiveView('chat')}
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              New Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Right Side - Welcome/Empty State */}
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-12 h-12 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome to Internal Chat
          </h2>
          
          <p className="text-gray-600 mb-6">
            Send messages, share files, and collaborate with your team in real-time. 
            Built-in translation and voice support included.
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Team Chat</h3>
              <p className="text-xs text-gray-600">Connect with your team instantly</p>
            </div>
            
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Mic className="w-4 h-4 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Voice Messages</h3>
              <p className="text-xs text-gray-600">Send and receive voice notes</p>
            </div>
            
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Settings2 className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Auto Translate</h3>
              <p className="text-xs text-gray-600">Break language barriers</p>
            </div>
            
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCheck className="w-4 h-4 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Read Receipts</h3>
              <p className="text-xs text-gray-600">Know when messages are read</p>
            </div>
          </div>
          
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white px-8"
            onClick={() => setActiveView('chat')}
          >
            Start Chatting
          </Button>
        </div>
      </div>
    </div>
  );

  const renderChatView = () => (
    <div className="h-screen">
      <InternalChat />
    </div>
  );

  return (
    <>
      {activeView === 'dashboard' ? renderDashboard() : renderChatView()}
    </>
  );
};

export default AiChat;
