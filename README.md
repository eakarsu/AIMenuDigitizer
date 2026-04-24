# AI Menu Digitizer

Transform restaurant menus into structured data with AI-powered allergen detection, calorie estimation, and translations.

## Features

- **Menu Digitization**: Upload menu images or paste text to extract structured menu data
- **Allergen Detection**: AI-powered allergen identification for each menu item
- **Calorie Estimation**: Nutritional information estimation using AI
- **Multi-language Translation**: Translate menu items to 15+ languages
- **Full CRUD Operations**: Create, read, update, and delete menus and items

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **AI**: OpenRouter API with Claude Haiku 4.5

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- OpenRouter API key

### Setup

1. Clone the repository and navigate to the project:
```bash
cd AIMenuDigitizer
```

2. Update the `.env` file with your OpenRouter API key:
```env
OPENROUTER_API_KEY=your_actual_api_key_here
```

3. Run the start script:
```bash
./start.sh
```

The script will:
- Clean ports 3000 and 3001
- Setup PostgreSQL database
- Install dependencies
- Seed sample data (45+ menu items with allergens, nutrition, and translations)
- Start backend with hot reload (port 3001)
- Start frontend with hot reload (port 3000)

4. Open http://localhost:3000 in your browser

### Demo Credentials

Click "Fill Demo Credentials" on the login page, or use:
- Email: `demo@menudigitizer.com`
- Password: `demo123456`

## Project Structure

```
AIMenuDigitizer/
├── .env                    # Environment configuration
├── start.sh               # Startup script
├── backend/
│   ├── src/
│   │   ├── db/            # Database setup, migrations, seeds
│   │   ├── middleware/    # Auth middleware
│   │   ├── routes/        # API routes
│   │   ├── services/      # OpenRouter AI service
│   │   └── index.ts       # Express server
│   └── uploads/           # Uploaded files
└── frontend/
    └── src/
        ├── components/    # Reusable components
        ├── context/       # Auth context
        ├── pages/         # Page components
        └── services/      # API client
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/demo-credentials` - Get demo login credentials

### Menus
- `GET /api/menus` - List all menus
- `GET /api/menus/:id` - Get menu with items
- `POST /api/menus` - Create menu
- `PUT /api/menus/:id` - Update menu
- `DELETE /api/menus/:id` - Delete menu

### Menu Items
- `POST /api/menus/:menuId/items` - Create item
- `PUT /api/menus/:menuId/items/:itemId` - Update item
- `DELETE /api/menus/:menuId/items/:itemId` - Delete item

### AI Features
- `POST /api/ai/analyze-text` - Analyze menu text
- `POST /api/ai/analyze-image` - Analyze menu image
- `POST /api/ai/detect-allergens` - Detect allergens
- `POST /api/ai/estimate-calories` - Estimate nutrition
- `POST /api/ai/translate` - Translate menu item

### Allergens, Calories, Translations
- Full CRUD for each feature under `/api/allergens`, `/api/calories`, `/api/translations`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key | Required |
| `OPENROUTER_MODEL` | AI model to use | `anthropic/claude-haiku-4.5` |
| `DATABASE_URL` | PostgreSQL connection string | Local PostgreSQL |
| `JWT_SECRET` | JWT signing secret | Generated |
| `BACKEND_PORT` | Backend server port | `3001` |
| `FRONTEND_PORT` | Frontend server port | `3000` |

## License

MIT
