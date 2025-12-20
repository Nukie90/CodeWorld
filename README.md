#### CodeWorld

## Backend

# Install ENV
1. cd backend
2. python -m venv venv || python3 -m venv venv

# To activate ENV
1. cd backend
2. source venv/bin/activate 
windows -> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
        -> venv\Scripts\activate
3. pip3 install -r requirements.txt

# Environment Variables
Create a `.env` file in the `backend` directory with:
```
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://127.0.0.1:8000/api/auth/github/callback
```

# GitHub OAuth Setup
1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Create a new OAuth App or edit existing one
3. Set **Authorization callback URL** to: `http://127.0.0.1:8000/api/auth/github/callback`
   (Must match exactly the `GITHUB_REDIRECT_URI` in your `.env` file)
4. Copy the Client ID and Client Secret to your `.env` file

# Checking
1. cd backend
2. uvicorn app.main:app --reload

# Next Start JS Server port 3001
1. cd app/js-plugin
2. npm install
3. npm start

## Frontend
1. npm install
2. npm run dev

or using nvm
1. nvm list 
2. nvm use 23
3. npm install
4. npm run dev
