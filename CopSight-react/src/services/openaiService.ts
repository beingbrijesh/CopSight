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

// System prompt for ARGO float data analysis
const SYSTEM_PROMPT = `You are CopSight AI, an expert assistant for ARGO oceanographic float data analysis. 

Your capabilities:
1. Answer questions about ARGO float data, ocean conditions, temperature, salinity, and marine science
2. Parse user queries to determine if they need visualizations
3. Provide data insights and analysis

When users ask for visualizations like "show me temperature changes from 2023-24" or "float locations in Arabian Sea", respond with:
1. A helpful explanation of what they're asking for
2. Include a special marker in your response: [VISUALIZATION_REQUEST:type:description]

Visualization types:
- MAP: For location-based queries (float positions, regional data)
- CHART: For time-series data (temperature trends, salinity changes)
- GRAPH: For comparative analysis (depth profiles, seasonal variations)

Examples:
- "show me temperature changes from 2023-24" → [VISUALIZATION_REQUEST:CHART:temperature_trends_2023_2024]
- "float locations in Arabian Sea" → [VISUALIZATION_REQUEST:MAP:arabian_sea_floats]
- "salinity depth profile" → [VISUALIZATION_REQUEST:GRAPH:salinity_depth_profile]

Always be helpful, accurate, and focus on oceanographic data analysis.`;

export class OpenAIService {
  async sendMessage(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || 'Sorry, I could not process your request.';
    } catch (error) {
      console.error('OpenAI API Error:', error);
      
      // Fallback to intelligent mock responses when API is unavailable
      return this.getMockResponse(messages[messages.length - 1]?.content || '');
    }
  }

  private getMockResponse(userMessage: string): string {
    const message = userMessage.toLowerCase();
    
    // Temperature-related queries
    if (message.includes('temperature') && (message.includes('2023') || message.includes('2024') || message.includes('trend'))) {
      return `Based on ARGO float data analysis, I can show you temperature trends for the requested period. The data indicates significant warming patterns in the upper ocean layers, with temperature increases of approximately 0.33°C per decade in many regions.

[VISUALIZATION_REQUEST:CHART:temperature_trends_2023_2024]

The visualization shows monthly temperature variations, with notable seasonal patterns and long-term warming trends. Key observations include higher temperatures during summer months and gradual warming over the analyzed period.`;
    }
    
    // Location-based queries
    if (message.includes('float') && message.includes('location')) {
      if (message.includes('arabian')) {
        return `Here are the current ARGO float locations in the Arabian Sea region. This area is particularly important for monitoring monsoon-driven oceanographic changes and the oxygen minimum zone.

[VISUALIZATION_REQUEST:MAP:arabian_sea_floats]

The map shows 4 active floats in the Arabian Sea, with real-time positions and status indicators. These floats are crucial for understanding regional ocean dynamics and climate patterns.`;
      } else {
        return `I'm displaying the global distribution of ARGO floats. Currently, there are over 4,000 active floats worldwide, providing comprehensive ocean monitoring coverage.

[VISUALIZATION_REQUEST:MAP:global_floats]

The visualization shows float locations across all major ocean basins, with color-coded status indicators for active and maintenance floats.`;
      }
    }
    
    // Salinity queries
    if (message.includes('salinity') && (message.includes('depth') || message.includes('profile'))) {
      return `I'll show you a salinity depth profile based on ARGO float measurements. This profile demonstrates how salinity varies with ocean depth, typically showing a halocline where salinity changes rapidly.

[VISUALIZATION_REQUEST:GRAPH:salinity_depth_profile]

The graph displays salinity measurements from surface to 2000m depth, showing the characteristic patterns of surface mixing, thermocline effects, and deep water masses.`;
    }
    
    // General ARGO questions
    if (message.includes('argo') || message.includes('float')) {
      return `ARGO floats are autonomous oceanographic instruments that drift with ocean currents and dive to depths up to 2,000 meters to collect temperature, salinity, and pressure data. Here are some key facts:

• Over 4,000 ARGO floats are currently active worldwide
• Each float completes a 10-day cycle: drift → dive → surface → transmit data
• They provide crucial data for climate research and weather prediction
• The ARGO program has revolutionized our understanding of ocean dynamics

Would you like me to show you specific data visualizations? Try asking about "temperature trends" or "float locations in a specific region".`;
    }
    
    // Default response
    return `Hello! I'm CopSight AI, your ARGO oceanographic data assistant. I can help you analyze ocean data and create visualizations. 

Try asking me about:
• "Show me temperature changes from 2023-24"
• "Float locations in Arabian Sea"
• "Salinity depth profile"
• "What are ARGO floats?"

I'll provide detailed analysis and update the visualization panel with relevant charts, maps, or graphs based on your queries!`;
  }

  async parseVisualizationRequest(response: string): Promise<VisualizationRequest | null> {
    const regex = /\[VISUALIZATION_REQUEST:(\w+):([^\]]+)\]/;
    const match = response.match(regex);
    
    if (match) {
      const [, type, description] = match;
      const data = await this.generateMockData(type.toLowerCase(), description);
      return {
        type: type.toLowerCase() as 'map' | 'chart' | 'graph',
        data: data,
        query: description
      };
    }
    
    return null;
  }

  private async generateMockData(type: string, description: string) {
    try {
      switch (type) {
        case 'map':
          const region = description.includes('arabian') ? 'Arabian Sea' : 'Global';
          const floats = await realErddapService.fetchArgoFloats(region);
          return {
            floats: floats,
            region: region
          };
        
        case 'chart':
          const tempData = await realErddapService.getTemperatureData('2023-01-01', '2024-03-01');
          return tempData;
        
        case 'graph':
          const profileData = await realErddapService.getDepthProfile('2901623');
          return profileData;
        
        default:
          return {};
      }
    } catch (error) {
      console.error('Error generating data:', error);
      // Fallback to static data
      switch (type) {
        case 'map':
          return {
            floats: [
              { id: 2901623, lat: 20.5, lon: 65.2, status: 'active', lastUpdate: '2024-01-15' },
              { id: 2901624, lat: 18.3, lon: 67.8, status: 'active', lastUpdate: '2024-01-15' },
              { id: 2901625, lat: 22.1, lon: 63.5, status: 'maintenance', lastUpdate: '2024-01-14' },
              { id: 2901626, lat: 19.7, lon: 66.1, status: 'active', lastUpdate: '2024-01-15' }
            ],
            region: description.includes('arabian') ? 'Arabian Sea' : 'Global'
          };
        
        case 'chart':
          return {
            labels: ['Jan 2023', 'Mar 2023', 'May 2023', 'Jul 2023', 'Sep 2023', 'Nov 2023', 'Jan 2024', 'Mar 2024'],
            datasets: [{
              label: 'Sea Surface Temperature (°C)',
              data: [24.2, 25.1, 26.8, 28.3, 27.9, 26.1, 24.8, 25.4],
              borderColor: '#f97316',
              backgroundColor: 'rgba(249, 115, 22, 0.1)'
            }]
          };
        
        case 'graph':
          return {
            depths: [0, 50, 100, 200, 500, 1000, 1500, 2000],
            salinity: [35.2, 35.4, 35.6, 35.8, 35.9, 35.7, 35.5, 35.3],
            temperature: [28.5, 26.2, 22.1, 18.7, 12.3, 8.9, 5.2, 3.1]
          };
        
        default:
          return {};
      }
    }
  }
}

export const openaiService = new OpenAIService();
