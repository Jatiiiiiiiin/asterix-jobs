# Asterix Jobs!!

Asterix Jobs is a job discovery and recruitment application with a Vite frontend and a FastAPI-powered AI engine.

## Run Locally!!

**Prerequisites:** Node.js and Python 3.10+

### Frontend

1. Install dependencies:
   `npm install`
2. Set `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key.
3. Start the frontend:
   `npm run dev`

### AI backend!!

In a second terminal:

1. Install the Python dependencies:
   `cd ai-engine`
   `pip install -r requirements.txt`
2. Start the API:
   `uvicorn api:app --reload`
