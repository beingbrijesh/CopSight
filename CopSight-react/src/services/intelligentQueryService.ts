// Intelligent Query Service - Smart Intent Parsing + GPT for Natural Language
// This service combines local intent detection with GPT for complex natural language understanding

import OpenAI from 'openai';
import { realErddapService } from './realErddapService';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface VisualizationRequest {
  type: 'map' | 'chart' | 'graph';
  data: any;
  query: string;
}

interface QueryIntent {
  isRelevant: boolean;
  type: 'temperature' | 'location' | 'depth' | 'info' | 'greeting' | 'irrelevant';
  confidence: number;
  parameters?: {
    region?: string;
    dateRange?: { start: string; end: string };
    dataType?: string;
  };
}

class IntelligentQueryService {
  
  async processMessage(userMessage: string, chatHistory: ChatMessage[] = []): Promise<{ response: string; visualizationRequest?: VisualizationRequest }> {
    console.log('🧠 Analyzing query intent:', userMessage);
    
    // Step 1: Local Intent Detection (fast, no API call)
    const intent = this.analyzeIntent(userMessage);
    console.log('🎯 Intent detected:', intent);
    
    // Step 2: Handle based on intent
    if (!intent.isRelevant) {
      return this.handleIrrelevantQuery(userMessage);
    }
    
    if (intent.type === 'greeting') {
      return this.handleGreeting();
    }
    
    if (intent.confidence > 0.8) {
      // High confidence - process locally for speed
      console.log('⚡ High confidence - processing locally');
      return await this.processLocallyWithIntent(intent, userMessage);
    } else {
      // Lower confidence - use GPT for better understanding
      console.log('🤖 Lower confidence - using GPT for natural language understanding');
      return await this.processWithGPT(userMessage, chatHistory, intent);
    }
  }

  private analyzeIntent(message: string): QueryIntent {
    const lowerMessage = message.toLowerCase();
    
    // Irrelevant queries (no API call needed)
    const irrelevantPatterns = [
      /^(hi|hello|hey|good morning|good evening)$/,
      /how are you/,
      /what's your name/,
      /who are you/,
      /tell me a joke/,
      /what's the weather/,
      /play music/,
      /^(yes|no|ok|okay|thanks|thank you)$/
    ];
    
    for (const pattern of irrelevantPatterns) {
      if (pattern.test(lowerMessage)) {
        return {
          isRelevant: false,
          type: 'irrelevant',
          confidence: 0.9
        };
      }
    }
    
    // Greeting patterns
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('start')) {
      return {
        isRelevant: true,
        type: 'greeting',
        confidence: 0.9
      };
    }
    
    // Temperature queries
    const tempKeywords = ['temperature', 'temp', 'warming', 'cooling', 'thermal', 'heat'];
    const timeKeywords = ['trend', 'change', 'over time', '2022', '2023', '2024', 'year', 'month'];
    
    if (tempKeywords.some(k => lowerMessage.includes(k)) && timeKeywords.some(k => lowerMessage.includes(k))) {
      return {
        isRelevant: true,
        type: 'temperature',
        confidence: 0.9,
        parameters: {
          dateRange: this.extractDateRange(lowerMessage)
        }
      };
    }
    
    // Location/Float queries
    const locationKeywords = ['float', 'location', 'position', 'where', 'map', 'show me'];
    const regionKeywords = ['arabian', 'pacific', 'atlantic', 'indian', 'sea', 'ocean', 'region'];
    
    if (locationKeywords.some(k => lowerMessage.includes(k))) {
      const confidence = regionKeywords.some(k => lowerMessage.includes(k)) ? 0.9 : 0.7;
      return {
        isRelevant: true,
        type: 'location',
        confidence,
        parameters: {
          region: this.extractRegion(lowerMessage)
        }
      };
    }
    
    // Depth/Profile queries - ENHANCED for salinity
    const depthKeywords = ['depth', 'profile', 'vertical', 'deep', 'surface'];
    const salinityKeywords = ['salinity', 'salt', 'psal'];
    
    // Check for salinity queries specifically
    if (salinityKeywords.some(k => lowerMessage.includes(k))) {
      // If it mentions time periods, it's likely a time series chart, not depth profile
      const timeKeywords = ['past', 'last', 'over', 'years', 'months', 'trend', 'change', '2022', '2023', '2024'];
      if (timeKeywords.some(k => lowerMessage.includes(k))) {
        return {
          isRelevant: true,
          type: 'temperature', // Use temperature type for time series (will be adapted for salinity)
          confidence: 0.9,
          parameters: {
            dateRange: this.extractDateRange(lowerMessage),
            dataType: 'salinity'
          }
        };
      } else {
        // Salinity depth profile
        return {
          isRelevant: true,
          type: 'depth',
          confidence: 0.9,
          parameters: {
            dataType: 'salinity'
          }
        };
      }
    }
    
    // Other depth/profile queries
    if (depthKeywords.some(k => lowerMessage.includes(k))) {
      return {
        isRelevant: true,
        type: 'depth',
        confidence: 0.8
      };
    }
    
    // ARGO info queries
    const infoKeywords = ['what', 'explain', 'tell me about', 'how', 'argo', 'float'];
    
    if (infoKeywords.some(k => lowerMessage.includes(k)) && lowerMessage.includes('argo')) {
      return {
        isRelevant: true,
        type: 'info',
        confidence: 0.8
      };
    }
    
    // If contains oceanographic terms, probably relevant but needs GPT
    const oceanKeywords = ['ocean', 'sea', 'marine', 'water', 'current', 'tide', 'wave', 'climate'];
    if (oceanKeywords.some(k => lowerMessage.includes(k))) {
      return {
        isRelevant: true,
        type: 'temperature', // Default assumption
        confidence: 0.4 // Low confidence - needs GPT
      };
    }
    
    // Default: probably irrelevant
    return {
      isRelevant: false,
      type: 'irrelevant',
      confidence: 0.6
    };
  }

  private handleIrrelevantQuery(message: string): { response: string } {
    return {
      response: `Hi there! I'm CopSight AI, and I specialize in ARGO oceanographic data analysis.

I noticed your message isn't related to ocean data. I can help you explore things like temperature trends, ARGO float locations, ocean depth profiles, and marine science questions.

Try asking me something like "Show me temperature changes in the Arabian Sea" or "Where are the ARGO floats located?" 

What ocean data would you like to explore?`
    };
  }

  private handleGreeting(): { response: string } {
    return {
      response: `Welcome to CopSight AI! I'm your oceanographic data assistant.

I can understand natural language queries and fetch real data from ERDDAP servers worldwide. You can ask me about ocean temperature changes, ARGO float locations, depth profiles, or how these instruments work.

Try asking me something like "How has ocean temperature changed in the last two years?" or "Can you show me where ARGO floats are deployed in the Arabian Sea?"

What would you like to know about ocean data?`
    };
  }

  private async processLocallyWithIntent(intent: QueryIntent, message: string): Promise<{ response: string; visualizationRequest?: VisualizationRequest }> {
    try {
      switch (intent.type) {
        case 'temperature':
          return await this.handleTemperatureQuery(intent, message);
        case 'location':
          return await this.handleLocationQuery(intent, message);
        case 'depth':
          return await this.handleDepthQuery(intent, message);
        case 'info':
          return this.handleInfoQuery();
        default:
          return this.handleGreeting();
      }
    } catch (error) {
      console.error('Error in local processing:', error);
      return {
        response: '⚠️ I encountered an issue processing your request. Please try rephrasing your question.'
      };
    }
  }

  private async processWithGPT(message: string, chatHistory: ChatMessage[], intent: QueryIntent): Promise<{ response: string; visualizationRequest?: VisualizationRequest }> {
    try {
      console.log('🤖 Using GPT for natural language understanding...');
      
      const systemPrompt = `You are CopSight AI, an expert ARGO oceanographic data assistant. 

Your task is to understand the user's natural language query and determine:
1. What type of oceanographic data they want (temperature, float locations, depth profiles)
2. What specific parameters they're interested in (regions, time periods, measurements)
3. How to respond helpfully with real data

When you understand their request, respond with:
1. A helpful explanation of what they're asking for
2. Include a special marker: [VISUALIZATION_REQUEST:type:description]

Types: MAP (locations), CHART (time series), GRAPH (profiles)

Examples:
- "ocean warming trends" → [VISUALIZATION_REQUEST:CHART:temperature_trends_recent]
- "floats in the Indian Ocean" → [VISUALIZATION_REQUEST:MAP:indian_ocean_floats]
- "salinity at different depths" → [VISUALIZATION_REQUEST:GRAPH:salinity_depth_profile]

Be conversational and explain oceanographic concepts clearly.`;

      const response = await openai.chat.completions.create({
        model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory.slice(-4), // Last 4 messages for context
          { role: 'user', content: message }
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      const gptResponse = response.choices[0]?.message?.content || 'I apologize, but I had trouble understanding your request.';
      
      // Parse visualization request
      const visualizationRequest = await this.parseVisualizationRequest(gptResponse, intent);
      
      // Clean response
      const cleanResponse = gptResponse.replace(/\[VISUALIZATION_REQUEST:[^\]]+\]/g, '').trim();
      
      return {
        response: cleanResponse,
        visualizationRequest
      };
      
    } catch (error) {
      console.error('GPT processing error:', error);
      
      // Fallback to local processing
      console.log('🔄 GPT failed, falling back to local processing...');
      return await this.processLocallyWithIntent(intent, message);
    }
  }

  private async parseVisualizationRequest(gptResponse: string, intent: QueryIntent): Promise<VisualizationRequest | null> {
    const regex = /\[VISUALIZATION_REQUEST:(\w+):([^\]]+)\]/;
    const match = gptResponse.match(regex);
    
    if (match) {
      const [, type, description] = match;
      const data = await this.fetchDataForVisualization(type.toLowerCase(), description, intent);
      
      return {
        type: type.toLowerCase() as 'map' | 'chart' | 'graph',
        data: data,
        query: description
      };
    }
    
    return null;
  }

  private async fetchDataForVisualization(type: string, description: string, intent: QueryIntent): Promise<any> {
    try {
      switch (type) {
        case 'map':
          const region = intent.parameters?.region || this.extractRegionFromDescription(description);
          console.log(`🗺️ Fetching ARGO floats for region: ${region}`);
          const floats = await realErddapService.fetchArgoFloats(region);
          return { floats, region };
          
        case 'chart':
          const dateRange = intent.parameters?.dateRange || this.extractDateRangeFromDescription(description);
          console.log(`📈 Fetching temperature data: ${dateRange.start} to ${dateRange.end}`);
          const tempData = await realErddapService.getTemperatureData(dateRange.start, dateRange.end);
          return tempData;
          
        case 'graph':
          console.log('📊 Fetching depth profile data...');
          const profileData = await realErddapService.getDepthProfile('2901623');
          return profileData;
          
        default:
          return {};
      }
    } catch (error) {
      console.error('Error fetching visualization data:', error);
      return {};
    }
  }

  // Helper methods for local processing
  private async handleTemperatureQuery(intent: QueryIntent, message: string): Promise<{ response: string; visualizationRequest: VisualizationRequest }> {
    // Extract date range from the actual message
    const dateRange = intent.parameters?.dateRange || this.extractDateRange(message);
    const dataType = intent.parameters?.dataType || 'temperature';
    
    const startYear = dateRange.start.split('-')[0];
    const endYear = dateRange.end.split('-')[0];
    const yearSpan = parseInt(endYear) - parseInt(startYear) + 1;
    
    let data;
    let response;
    
    if (dataType === 'salinity') {
      // Generate salinity time series data
      data = await realErddapService.getSalinityData(dateRange.start, dateRange.end);
      
      response = `I've analyzed real ARGO float salinity data from ${startYear} to ${endYear} (${yearSpan} years of data).

The analysis reveals ${yearSpan > 5 ? 'long-term' : 'seasonal'} salinity patterns across global ocean basins. ${yearSpan > 5 ? 'Over this extended period, the data shows multi-year salinity variations influenced by evaporation, precipitation, and ocean circulation changes.' : 'The data shows seasonal salinity variations following natural cycles with regional differences due to freshwater inputs and evaporation patterns.'}

The chart displays salinity measurements from autonomous ARGO floats worldwide, showing both ${yearSpan > 5 ? 'long-term oceanographic trends and inter-annual' : 'seasonal cycles and monthly'} variations in ocean salt content.`;
    } else {
      // Temperature data (original functionality)
      data = await realErddapService.getTemperatureData(dateRange.start, dateRange.end);
      
      response = `I've analyzed real ARGO float temperature data from ${startYear} to ${endYear} (${yearSpan} years of data).

The analysis covers ${yearSpan > 5 ? 'long-term' : 'seasonal'} temperature patterns across global ocean basins. ${yearSpan > 5 ? 'Over this extended period, the data reveals climate trends including gradual warming patterns and multi-year oscillations.' : 'The data shows seasonal temperature variations following natural cycles with regional differences across ocean basins.'}

The chart displays temperature measurements from autonomous ARGO floats worldwide, showing both ${yearSpan > 5 ? 'long-term climate trends and inter-annual' : 'seasonal cycles and monthly'} variations.`;
    }
    
    return {
      response,
      visualizationRequest: {
        type: 'chart',
        data,
        query: `${dataType}_analysis_${startYear}_${endYear}`
      }
    };
  }

  private async handleLocationQuery(intent: QueryIntent, message: string): Promise<{ response: string; visualizationRequest: VisualizationRequest }> {
    const region = intent.parameters?.region || 'Global';
    const floats = await realErddapService.fetchArgoFloats(region);
    const activeFloats = floats.filter(f => f.status === 'active').length;
    
    return {
      response: `I've found ${floats.length} ARGO floats in the ${region} region, with ${activeFloats} currently active and transmitting data.

These positions come from live ERDDAP servers at NOAA and Ifremer. The interactive map shows their actual locations with real oceanographic measurements including temperature and salinity data.

You can hover over any float marker to see detailed information about that specific instrument.`,
      visualizationRequest: {
        type: 'map',
        data: { floats, region },
        query: `${region.toLowerCase()}_float_locations`
      }
    };
  }

  private async handleDepthQuery(intent: QueryIntent, message: string): Promise<{ response: string; visualizationRequest: VisualizationRequest }> {
    const profileData = await realErddapService.getDepthProfile('2901623');
    
    return {
      response: `I've generated a comprehensive ocean depth profile showing how temperature and salinity change from the surface down to 2000 meters.

The profile shows the typical oceanographic structure including the thermocline where temperature drops rapidly, and the halocline where salinity changes mark different water mass boundaries. This data is based on actual ARGO measurement patterns.

You can see how both temperature and salinity vary with depth, revealing the layered structure of the ocean.`,
      visualizationRequest: {
        type: 'graph',
        data: profileData,
        query: 'ocean_depth_profile'
      }
    };
  }

  private handleInfoQuery(): { response: string } {
    return {
      response: `ARGO floats are autonomous oceanographic instruments that have revolutionized our understanding of ocean dynamics.

These remarkable devices drift with ocean currents for years, following a 10-day cycle: they drift at depth, then dive down to 2000 meters, rise to the surface, and transmit their data via satellite before diving again. There are over 4,000 active floats worldwide collecting temperature, salinity, and pressure profiles.

They're essential for climate research, helping us understand ocean warming and improve weather prediction models. The floats can operate for 4-6 years on battery power, diving to depths of 2000 meters (some go as deep as 6000m) with incredible accuracy - within 0.002°C for temperature and 0.01 for salinity measurements.

The ARGO program provides continuous, global ocean monitoring that has transformed oceanography and climate science.`
    };
  }

  // Utility methods
  private extractDateRange(message: string): { start: string; end: string } {
    const currentYear = 2024; // Current year
    const lowerMessage = message.toLowerCase();
    
    console.log('🔍 Extracting date range from:', message);
    
    // Extract specific year ranges like "2015-24", "2015-2024", "2015 to 2024"
    const rangeMatch = message.match(/(\d{4})[-\s]?(?:to\s)?(\d{2,4})/);
    if (rangeMatch) {
      const startYear = rangeMatch[1];
      let endYear = rangeMatch[2];
      
      // Handle 2-digit years (e.g., "2015-24" means "2015-2024")
      if (endYear.length === 2) {
        const century = startYear.substring(0, 2);
        endYear = century + endYear;
      }
      
      console.log(`📅 Found year range: ${startYear} to ${endYear}`);
      return { start: `${startYear}-01-01`, end: `${endYear}-12-31` };
    }
    
    // Relative time patterns - MOST IMPORTANT
    if (lowerMessage.includes('past') || lowerMessage.includes('last')) {
      // Extract number of years
      const yearMatch = lowerMessage.match(/(?:past|last)\s+(\d+)\s+years?/);
      if (yearMatch) {
        const numYears = parseInt(yearMatch[1]);
        const startYear = currentYear - numYears;
        console.log(`📅 Found relative range: past ${numYears} years (${startYear} to ${currentYear})`);
        return { start: `${startYear}-01-01`, end: `${currentYear}-12-31` };
      }
      
      // Handle "past decade", "last 10 years"
      if (lowerMessage.includes('decade') || lowerMessage.includes('10')) {
        const startYear = currentYear - 10;
        console.log(`📅 Found decade range: ${startYear} to ${currentYear}`);
        return { start: `${startYear}-01-01`, end: `${currentYear}-12-31` };
      }
      
      // Handle "past 5 years", "last few years"
      if (lowerMessage.includes('5') || lowerMessage.includes('five')) {
        const startYear = currentYear - 5;
        console.log(`📅 Found 5-year range: ${startYear} to ${currentYear}`);
        return { start: `${startYear}-01-01`, end: `${currentYear}-12-31` };
      }
      
      // Default for "past" or "last" without specific number
      const startYear = currentYear - 3;
      console.log(`📅 Default past range: ${startYear} to ${currentYear}`);
      return { start: `${startYear}-01-01`, end: `${currentYear}-12-31` };
    }
    
    // Handle "over the past X years"
    const overPastMatch = lowerMessage.match(/over\s+the\s+past\s+(\d+)\s+years?/);
    if (overPastMatch) {
      const numYears = parseInt(overPastMatch[1]);
      const startYear = currentYear - numYears;
      console.log(`📅 Found "over the past" range: ${startYear} to ${currentYear}`);
      return { start: `${startYear}-01-01`, end: `${currentYear}-12-31` };
    }
    
    // Handle "in recent years", "recently"
    if (lowerMessage.includes('recent') || lowerMessage.includes('lately')) {
      const startYear = currentYear - 3;
      console.log(`📅 Found recent range: ${startYear} to ${currentYear}`);
      return { start: `${startYear}-01-01`, end: `${currentYear}-12-31` };
    }
    
    // Single year patterns
    const singleYearMatch = message.match(/(\d{4})/);
    if (singleYearMatch) {
      const year = singleYearMatch[1];
      console.log(`📅 Found single year: ${year}`);
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
    
    // Default to recent 2 years if nothing else matches
    console.log(`📅 Using default range: ${currentYear - 1} to ${currentYear}`);
    return { start: `${currentYear - 1}-01-01`, end: `${currentYear}-12-31` };
  }

  private extractRegion(message: string): string {
    if (message.includes('arabian')) return 'Arabian Sea';
    if (message.includes('pacific')) return 'Pacific Ocean';
    if (message.includes('atlantic')) return 'Atlantic Ocean';
    if (message.includes('indian')) return 'Indian Ocean';
    return 'Global';
  }

  private extractRegionFromDescription(description: string): string {
    return this.extractRegion(description);
  }

  private extractDateRangeFromDescription(description: string): { start: string; end: string } {
    return this.extractDateRange(description);
  }
}

export const intelligentQueryService = new IntelligentQueryService();
