# PropHunt

PropHunt is a web application designed to help real estate investors find properties with positive cash flow. The platform provides comprehensive property data, fair market rent analysis, and cashflow projections to help users make informed investment decisions.

## Live Demo

PropHunt Demo: [https://inst-377-final-project-neon.vercel.app/](https://inst-377-final-project-neon.vercel.app/)

## Target Browsers

PropHunt is optimized for use on:
- Chrome (latest version)
- Firefox (latest version)
- Safari (latest version)
- Edge (latest version)

# Developer Manual

## Installation

### Prerequisites

- Modern web browser
- Internet connection
- Basic text editor or IDE (VS Code recommended)

### Setup Instructions

1. Clone the repository
   ```bash
   git clone https://github.com/Izzcc/INST377-Final-Project
   cd INST377-Final-Project
   ```
2. No additional package installation is required as the application uses CDN-hosted dependencies:
   - Bootstrap 5.3
   - Supabase Client

## Running the Application

PropHunt is a web application that integrates multiple data sources (Zillow property listings, HUD government rental data) and processes them through our Supabase backend infrastructure.

### Production Deployment

For production deployment:

1. Configure your environment variables for API connections:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_KEY` - Your Supabase public API key
   - `HUD_API_TOKEN` - Your HUD API authentication token
2. Deploy the application files to your web server of choice (Netlify, Vercel, etc.)
3. The backend data processing occurs through Supabase functions and PostgreSQL stored procedures, which handle:
   - Property data normalization and enrichment
   - Rental market analysis
   - Cashflow calculations
   - User preference storage

## API Documentation

PropHunt interfaces with our Supabase backend through the following API endpoints:

### Property Endpoints

**GET /properties**
- Retrieves property listings with optional filtering parameters
- Parameters:
  - `location`: City or ZIP code to filter by
  - `maxPrice`: Maximum property price
  - `bedrooms`: Minimum number of bedrooms
  - `limit`: Number of results to return (default: 100)
  - `page`: Pagination offset
- Returns: Array of property objects with financial metrics

### Rent Data Endpoints

**GET /rent-data/:county**
- Retrieves HUD Fair Market Rent data for specified county
- Parameters:
  - `county`: FIPS county code
- Returns: Object containing rent data by bedroom count and ZIP code

**GET /rent-data/zip/:zipcode**
- Retrieves HUD Fair Market Rent data for specified ZIP code
- Parameters:
  - `zipcode`: 5-digit ZIP code
- Returns: Object containing rent data by bedroom count

### User Data Endpoints

**POST /favorites**
- Saves a property to user's favorites
- Parameters:
  - `propertyId`: ID of property to save
  - `notes`: Optional user notes about the property
- Authentication Required: Yes
- Returns: Success status and saved property object

## Data Sources and API Integration

The application integrates multiple data sources through a sophisticated backend architecture:

1. **Property Data API**
   - Property listings are sourced from Zillow's dataset and stored in our Supabase database
   - Data is normalized and enhanced with additional metadata through custom processing functions
   - Properties are regularly updated to ensure market relevance

2. **HUD Fair Market Rent API**
   - Rental price estimates use the official HUD Fair Market Rent dataset
   - County and ZIP code level data allows for precise rental estimates
   - API requests are cached and optimized to minimize latency

3. **Financial Calculation Engine**
   - Custom mortgage calculation algorithms based on current market interest rates
   - Cashflow projections factor in typical expenses, vacancy rates, and maintenance costs
   - Investment metrics calculation (ROI, cap rate, etc.)

4. **Supabase Backend**
   - PostgreSQL database stores and indexes property data for efficient querying
   - Realtime API provides instant updates when new properties matching criteria become available
   - Serverless functions handle data processing and enrichment workflows

## Application Structure

### Frontend

- **house-search.html** - Main property search interface and listing display
- **house-search.js** - Core application logic including:
  - Property filtering and search algorithms
  - Data visualization components
  - API integration with backend services
  - Mortgage and cashflow calculation engine
- **about.html** - Information about the PropHunt service and team
- **rent-chart.html** - Interactive visualization of rent data by location

### Backend (Supabase)

- Database schema for property storage and indexing
- RESTful endpoints for property querying and filtering
- Authentication system for user accounts (in development)
- Serverless functions for data processing pipelines

## Known Issues and Limitations

1. **Performance Optimization**:
   - The current implementation retrieves a large property dataset, causing initial loading delays
   - Planned solution: Implement server-side pagination and more efficient filtering algorithms

2. **Data Freshness**:
   - Property data updates occur weekly rather than in real-time
   - Planned solution: Implement daily update pipeline and eventually real-time MLS integration

3. **Mobile Responsiveness**:
   - The interface requires further optimization for smaller mobile screens
   - Planned solution: Implement responsive design improvements and touch-friendly controls

4. **Calculation Accuracy**:
   - Financial calculations use standardized assumptions that may vary by location
   - Planned solution: Allow user customization of calculation parameters

## Future Development Roadmap

1. **Short-term improvements**:
   - Optimize data loading performance
   - Add more filtering options (property type, square footage)
   - Implement saved searches for users

2. **Medium-term goals**:
   - User authentication and saved favorites
   - Detailed property analytics dashboard
   - Comparative market analysis tools

3. **Long-term vision**:
   - Portfolio management tools
   - Investment return projections
   - Mobile application development

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [HUD User API Documentation](https://www.huduser.gov/portal/dataset/fmr-api.html)
- [Bootstrap Documentation](https://getbootstrap.com/docs/5.3/getting-started/introduction/)
