import { useState } from 'react';
import { MessageSquare, Phone, Users, MapPin, Calendar } from 'lucide-react';

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'sms' | 'call' | 'whatsapp' | 'telegram' | 'contact' | 'location';
  content: string;
  phoneNumber?: string;
  metadata?: any;
}

interface TimelineProps {
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
}

export const Timeline = ({ events, onEventClick }: TimelineProps) => {
  const [filter, setFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month' | 'all'>('all');

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'sms':
      case 'whatsapp':
      case 'telegram':
        return <MessageSquare className="w-5 h-5" />;
      case 'call':
        return <Phone className="w-5 h-5" />;
      case 'contact':
        return <Users className="w-5 h-5" />;
      case 'location':
        return <MapPin className="w-5 h-5" />;
      default:
        return <Calendar className="w-5 h-5" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'sms':
        return 'bg-blue-500';
      case 'whatsapp':
        return 'bg-green-500';
      case 'telegram':
        return 'bg-cyan-500';
      case 'call':
        return 'bg-purple-500';
      case 'contact':
        return 'bg-orange-500';
      case 'location':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const filteredEvents = events.filter(event => {
    if (filter !== 'all' && event.type !== filter) return false;
    
    if (dateRange !== 'all') {
      const eventDate = new Date(event.timestamp);
      const now = new Date();
      const diffTime = now.getTime() - eventDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (dateRange === 'day' && diffDays > 1) return false;
      if (dateRange === 'week' && diffDays > 7) return false;
      if (dateRange === 'month' && diffDays > 30) return false;
    }
    
    return true;
  });

  // Group events by date
  const groupedEvents = filteredEvents.reduce((acc, event) => {
    const date = new Date(event.timestamp).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Event Timeline</h2>
            <p className="text-blue-100 text-sm mt-1">
              {filteredEvents.length} events
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Type Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 bg-white rounded-lg text-sm focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All Types</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
              <option value="call">Calls</option>
              <option value="contact">Contacts</option>
              <option value="location">Locations</option>
            </select>

            {/* Date Range Filter */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-3 py-2 bg-white rounded-lg text-sm focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All Time</option>
              <option value="day">Last 24 Hours</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {Object.keys(groupedEvents).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Calendar className="w-4 h-4" />
                    {date}
                  </div>
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs text-gray-500">{dateEvents.length} events</span>
                </div>

                {/* Events for this date */}
                <div className="relative pl-8 space-y-4">
                  {/* Vertical line */}
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                  {dateEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className="relative cursor-pointer group"
                    >
                      {/* Timeline dot */}
                      <div className={`absolute -left-6 top-2 w-4 h-4 rounded-full ${getEventColor(event.type)} ring-4 ring-white`}></div>

                      {/* Event card */}
                      <div className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition group-hover:bg-white">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${getEventColor(event.type)} text-white`}>
                              {getEventIcon(event.type)}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 capitalize">{event.type}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                          {event.phoneNumber && (
                            <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                              {event.phoneNumber}
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-700 line-clamp-2">{event.content}</p>

                        {event.metadata && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                            {event.metadata.duration && (
                              <span>Duration: {event.metadata.duration}s</span>
                            )}
                            {event.metadata.direction && (
                              <span className="capitalize">• {event.metadata.direction}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No events found</p>
            <p className="text-sm mt-1">Try adjusting the filters</p>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {filteredEvents.length > 0 && (
        <div className="border-t px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-gray-600">First Event:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {new Date(filteredEvents[filteredEvents.length - 1].timestamp).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Last Event:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {new Date(filteredEvents[0].timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
            <button className="text-blue-600 hover:text-blue-700 font-medium">
              Export Timeline
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
