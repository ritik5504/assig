# Deployment Guide

This guide details the step-by-step instructions for deploying the **Truck Route Planner & FMCSA ELD Application** using cloud platforms.

We deploy the application in a decoupled architecture:
1. **Django REST Backend** deployed to [Render](https://render.com/) (Web Service).
2. **React Frontend** deployed to [Vercel](https://vercel.com/) (Static Site).

---

## 1. Django REST Backend (Render)

Render offers a free tier Web Service that automatically runs Python applications.

### Steps to Deploy:
1. Sign in to [Render](https://render.com/).
2. Click **New** > **Web Service**.
3. Connect your GitHub repository (`https://github.com/ritik5504/assig.git`).
4. Configure the Web Service settings:
   - **Name**: `truck-route-planner-backend` (or similar)
   - **Environment**: `Python 3`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - **Start Command**: `gunicorn core.wsgi:application`
5. In the **Environment** tab, add the following Environment Variables:
   - `DEBUG`: `False`
   - `SECRET_KEY`: *[A long secure random string]*
   - `ALLOWED_HOSTS`: *[Your Render Web Service URL without protocol, e.g., `truck-route-planner-backend.onrender.com`]*
   - `DATABASE_URL`: *(Optional) If you want a persistent PostgreSQL database, create a PostgreSQL instance on Render (or Neon/Supabase) and paste its URL here. If you leave this blank, the app will fall back to SQLite, but note that SQLite data will be lost on service restarts.*
   - `OPENROUTE_API_KEY`: *(Optional) Your OpenRouteService API key if you want live routing.*
6. Click **Create Web Service**.

Once deployed, copy your backend URL (e.g., `https://truck-route-planner-backend.onrender.com`). You will need this for the frontend configuration.

---

## 2. Vite React Frontend (Vercel)

Vercel provides high-performance static hosting perfect for React applications.

### Steps to Deploy:
1. Sign in to [Vercel](https://vercel.com/).
2. Click **Add New** > **Project**.
3. Import your GitHub repository (`assig`).
4. Configure the project settings:
   - **Framework Preset**: `Vite` (Vercel should detect this automatically)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://[your-backend-app].onrender.com/api` (Make sure to include the `/api` suffix and use your actual Render backend URL)
6. Click **Deploy**.

---

## 3. Post-Deployment Verification

1. Access your Vercel deployment URL.
2. Verify that the UI loads and is responsive.
3. Try calculating a route (e.g., from "Chicago, IL" to "Kansas City, MO"). It should fetch routing information from the deployed backend and render the timeline and log sheets.
4. Try saving the trip to verify database connection (read/write).
