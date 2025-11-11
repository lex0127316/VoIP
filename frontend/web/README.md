Auth configuration
------------------

For local development create `.env.local` with:

```
JWT_SECRET=dev_secret_change_me
DEMO_PASSWORD=changeme
NEXT_PUBLIC_API_BASE_URL=http://localhost:8081
NEXT_PUBLIC_SIGNALING_URL=ws://localhost:8080/ws
```

Before deploying set the production secrets and endpoints (for example via `.env.production` or your hosting provider dashboard):

```
JWT_SECRET=<production jwt secret>
DEMO_PASSWORD=<production demo password>
NEXT_PUBLIC_API_BASE_URL=https://api.voip.example.com
NEXT_PUBLIC_SIGNALING_URL=wss://signaling.voip.example.com/ws
```

Routes:
- POST `/api/auth/login` { email, password }
- GET `/api/auth/session`
- POST `/api/auth/logout`


